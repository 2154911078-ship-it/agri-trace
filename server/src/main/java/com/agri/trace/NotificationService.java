package com.agri.trace;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
  private final JdbcTemplate jdbc;

  public NotificationService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void notify(long userId, String title, String content, String category, String level,
                     List<String> channels, String link) {
    for (String ch : channels) {
      if (!List.of("INBOX", "SMS", "WECOM").contains(ch)) continue;
      jdbc.update("""
          INSERT INTO notification (user_id, title, content, category, level, channel, status, link)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)
          """, userId, title, content, category, level, ch, link);
    }
  }

  public Map<String, Object> page(long userId, Integer status, String channel, Integer page, Integer size) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT id, title, content, category, level, channel, status, link, escalated,
               DATE_FORMAT(create_time, '%Y-%m-%d %H:%i') AS createTime,
               DATE_FORMAT(read_at, '%Y-%m-%d %H:%i') AS readAt
        FROM notification WHERE user_id = ?
          AND (? IS NULL OR status = ?) AND (? = '' OR channel = ?)
        ORDER BY status, create_time DESC, id DESC
        """, userId, status, status, channel == null ? "" : channel, channel == null ? "" : channel);
    int total = rows.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? rows : rows.subList(from, Math.min(total, from + sz));
    int unread = (int) rows.stream().filter(r -> Common.num(r.get("status")) == 0).count();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("unread", unread);
    return out;
  }

  public int unread(long userId) {
    Integer n = jdbc.queryForObject(
        "SELECT COUNT(*) FROM notification WHERE user_id = ? AND status = 0", Integer.class, userId);
    return n == null ? 0 : n;
  }

  public void read(long userId, long id) {
    jdbc.update("UPDATE notification SET status = 1, read_at = NOW() WHERE id = ? AND user_id = ?", id, userId);
  }

  public int readAll(long userId) {
    return jdbc.update("UPDATE notification SET status = 1, read_at = NOW() WHERE user_id = ? AND status = 0", userId);
  }

  public int escalateOverdue() {
    List<Map<String, Object>> alerts = jdbc.queryForList("""
        SELECT a.id, a.message, a.target_id AS batchId, b.batch_no AS batchNo
        FROM alert a LEFT JOIN batch b ON b.id = a.target_id
        WHERE a.status = 0 AND a.escalated = 0 AND a.create_time < DATE_SUB(NOW(), INTERVAL 2 HOUR)
        """);
    for (Map<String, Object> a : alerts) {
      jdbc.update("UPDATE alert SET escalated = 1 WHERE id = ?", a.get("id"));
      notify(1, "超时升级：" + Common.str(a.get("batchNo")),
          "预警「" + Common.str(a.get("message")) + "」超过 2 小时未处理，已升级。",
          "超时升级", "alert", List.of("INBOX", "WECOM"), "/alerts");
      jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '预警', '超时升级', ?, '127.0.0.1')",
          "alert#" + a.get("id"));
    }
    return alerts.size();
  }
}
