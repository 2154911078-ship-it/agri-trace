package com.agri.trace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertService {
  private final JdbcTemplate jdbc;
  private final BatchStateService states;
  private final NotificationService notifications;

  public AlertService(JdbcTemplate jdbc, BatchStateService states, NotificationService notifications) {
    this.jdbc = jdbc;
    this.states = states;
    this.notifications = notifications;
  }

  private static final Map<String, String> TYPE_NAME = Map.of(
      "COLD_CHAIN", "冷链异常", "QUALITY_FAIL", "质检不合格", "SAFETY_INTERVAL", "安全间隔");

  public Map<String, Object> page(String kw, Integer status, Long farmId, Integer page, Integer size) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT a.id, a.type, a.level, a.target_id AS batchId, a.message, a.status,
               DATE_FORMAT(a.create_time, '%Y-%m-%d %H:%i') AS createTime,
               DATE_FORMAT(a.ack_time, '%Y-%m-%d %H:%i') AS ackTime,
               DATE_FORMAT(a.resolve_time, '%Y-%m-%d %H:%i') AS resolveTime,
               a.resolve_note AS resolveNote, a.escalated,
               ua.real_name AS ackUser, ur.real_name AS resolveUser,
               b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName, f.name AS farmName
        FROM alert a
        LEFT JOIN batch b ON b.id = a.target_id
        LEFT JOIN plot p ON p.id = b.plot_id
        LEFT JOIN farm f ON f.id = p.farm_id
        LEFT JOIN sys_user ua ON ua.id = a.handler_id
        LEFT JOIN sys_user ur ON ur.id = a.resolver_id
        WHERE (? = 0 OR p.farm_id = ?)
        ORDER BY a.status, a.level DESC, a.create_time DESC, a.id DESC
        """, fid, fid);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = new ArrayList<>();
    int pending = 0, acked = 0, resolved = 0;
    for (Map<String, Object> r : rows) {
      int st = Common.num(r.get("status"));
      if (st == 0) pending++;
      else if (st == 1) acked++;
      else resolved++;
      if (status != null && st != status) continue;
      if (!k.isEmpty()) {
        String hay = (Common.str(r.get("message")) + Common.str(r.get("batchNo")) + Common.str(r.get("plotNo"))).toLowerCase();
        if (!hay.contains(k)) continue;
      }
      Map<String, Object> m = new LinkedHashMap<>(r);
      int level = Common.num(r.get("level"));
      m.put("levelName", level >= 3 ? "严重" : level == 2 ? "警告" : "提示");
      m.put("typeName", TYPE_NAME.getOrDefault(String.valueOf(r.get("type")), "预警"));
      m.put("statusName", st == 0 ? "待处理" : st == 1 ? "处理中" : "已解除");
      m.put("escalated", Common.num(r.get("escalated")) == 1);
      filtered.add(m);
    }
    int p = page == null || page < 1 ? 1 : page;
    int s = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(filtered.size(), (p - 1) * s);
    int to = Math.min(filtered.size(), from + s);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", filtered.subList(from, to));
    out.put("total", filtered.size());
    out.put("pending", pending);
    out.put("acked", acked);
    out.put("resolved", resolved);
    return out;
  }

  @Transactional
  public Map<String, Object> acknowledge(long id, long userId) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT status FROM alert WHERE id = ?", id);
    if (rows.isEmpty()) throw new ApiException("预警不存在", 404);
    int st = Common.num(rows.get(0).get("status"));
    if (st == 0) {
      jdbc.update("UPDATE alert SET status = 1, handler_id = ?, ack_time = NOW() WHERE id = ?", userId, id);
      log(userId, "认领预警", String.valueOf(id));
    }
    return detail(id);
  }

  @Transactional
  public Map<String, Object> resolve(long id, long userId, String note) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT type, target_id, status FROM alert WHERE id = ?", id);
    if (rows.isEmpty()) throw new ApiException("预警不存在", 404);
    Map<String, Object> a = rows.get(0);
    int st = Common.num(a.get("status"));
    if (st != 2) {
      long batchId = Common.num(a.get("target_id"));
      if ("QUALITY_FAIL".equals(String.valueOf(a.get("type"))) && batchId > 0) {
        List<Map<String, Object>> latest = jdbc.queryForList("""
            SELECT result, disposal FROM quality_inspect WHERE batch_id = ?
            ORDER BY (inspect_date <= ?) DESC, inspect_date DESC, id DESC LIMIT 1
            """, batchId, Common.today());
        if (!latest.isEmpty() && Common.num(latest.get(0).get("result")) == 2
            && latest.get(0).get("disposal") == null) {
          throw new ApiException("该批次最新检测仍不合格，请先提交复检合格或完成不合格品处置");
        }
      }
      jdbc.update("""
          UPDATE alert SET status = 2, resolver_id = ?, resolve_time = NOW(), resolve_note = ?,
                 handler_id = COALESCE(handler_id, ?), ack_time = COALESCE(ack_time, NOW())
          WHERE id = ?
          """, userId, note, userId, id);
      if ("QUALITY_FAIL".equals(String.valueOf(a.get("type"))) && batchId > 0) {
        states.refresh(batchId);
        Integer others = jdbc.queryForObject("""
            SELECT COUNT(*) FROM alert WHERE type = 'QUALITY_FAIL' AND target_id = ? AND status IN (0, 1) AND id <> ?
            """, Integer.class, batchId, id);
        if (others == null || others == 0) states.restorePlot(batchId);
      }
      log(userId, "解除预警", id + " " + (note == null ? "" : note));
    }
    return detail(id);
  }

  @Transactional
  public Map<String, Object> assign(long id, long assigneeId, long operatorId) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT a.message, a.status, p.farm_id AS farmId
        FROM alert a LEFT JOIN batch b ON b.id = a.target_id LEFT JOIN plot p ON p.id = b.plot_id
        WHERE a.id = ?
        """, id);
    if (rows.isEmpty()) throw new ApiException("预警不存在", 404);
    Object farmId = rows.get(0).get("farmId");
    if (farmId != null && assigneeId != 1) {
      Integer member = jdbc.queryForObject(
          "SELECT COUNT(*) FROM sys_user_farm WHERE user_id = ? AND farm_id = ?",
          Integer.class, assigneeId, Common.num(farmId));
      if (member == null || member == 0) throw new ApiException("只能指派给该预警所属农场的成员");
    }
    jdbc.update("""
        UPDATE alert SET handler_id = ?, status = 1, ack_time = COALESCE(ack_time, NOW()) WHERE id = ?
        """, assigneeId, id);
    notifications.notify(assigneeId, "您有一条预警待处置",
        Common.str(rows.get(0).get("message")), "预警指派", "warn",
        List.of("INBOX", "SMS"), "/alerts");
    log(operatorId, "指派预警", "alert#" + id + " -> user#" + assigneeId);
    return detail(id);
  }

  private void log(long userId, String action, String target) {
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (?, '预警', ?, ?, '127.0.0.1')",
        userId, action, target);
  }

  private Map<String, Object> detail(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT a.id, a.type, a.level, a.target_id AS batchId, a.message, a.status,
               DATE_FORMAT(a.create_time, '%Y-%m-%d %H:%i') AS createTime,
               DATE_FORMAT(a.ack_time, '%Y-%m-%d %H:%i') AS ackTime,
               DATE_FORMAT(a.resolve_time, '%Y-%m-%d %H:%i') AS resolveTime,
               a.resolve_note AS resolveNote, a.escalated,
               ua.real_name AS ackUser, ur.real_name AS resolveUser,
               b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName, f.name AS farmName
        FROM alert a
        LEFT JOIN batch b ON b.id = a.target_id
        LEFT JOIN plot p ON p.id = b.plot_id
        LEFT JOIN farm f ON f.id = p.farm_id
        LEFT JOIN sys_user ua ON ua.id = a.handler_id
        LEFT JOIN sys_user ur ON ur.id = a.resolver_id
        WHERE a.id = ? LIMIT 1
        """, id);
    if (rows.isEmpty()) throw new ApiException("预警不存在", 404);
    Map<String, Object> m = new LinkedHashMap<>(rows.get(0));
    int level = Common.num(m.get("level"));
    int st = Common.num(m.get("status"));
    m.put("levelName", level >= 3 ? "严重" : level == 2 ? "警告" : "提示");
    m.put("typeName", TYPE_NAME.getOrDefault(String.valueOf(m.get("type")), "预警"));
    m.put("statusName", st == 0 ? "待处理" : st == 1 ? "处理中" : "已解除");
    m.put("escalated", Common.num(m.get("escalated")) == 1);
    return m;
  }
}
