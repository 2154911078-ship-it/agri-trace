package com.agri.trace;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InspectService {
  private final JdbcTemplate jdbc;
  private final BatchStateService states;
  private final NotificationService notifications;

  public InspectService(JdbcTemplate jdbc, BatchStateService states, NotificationService notifications) {
    this.jdbc = jdbc;
    this.states = states;
    this.notifications = notifications;
  }

  public Map<String, Object> page(String kw, Integer result, Long farmId, Integer page, Integer size) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT qi.id, b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName,
               c.name AS cropName, c.variety, f.name AS farmName, f.id AS farmId,
               DATE_FORMAT(qi.inspect_date, '%Y-%m-%d') AS inspectDate, qi.org_name AS org,
               qi.result AS dbResult, qi.detect_no AS reportNo, qi.report_url AS reportUrl,
               qi.source_inspect_id AS sourceInspectId, qi.disposal, qi.disposal_note AS disposalNote,
               DATE_FORMAT(qi.dispose_time, '%Y-%m-%d %H:%i') AS disposeTime
        FROM quality_inspect qi
        JOIN batch b ON b.id = qi.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id
        JOIN farm f ON f.id = b.farm_id
        ORDER BY qi.inspect_date DESC, qi.id DESC
        """);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = new ArrayList<>();
    for (Map<String, Object> r : rows) {
      if (farmId != null && Common.num(r.get("farmId")) != farmId) continue;
      Map<String, Object> row = toRow(r);
      String inspectDate = Common.str(row.get("inspectDate"));
      int res = inspectDate.compareTo(Common.today()) > 0 ? 0 : Common.num(r.get("dbResult"));
      row.put("result", res);
      row.put("locked", res == 2);
      if (result != null && res != result) continue;
      if (!k.isEmpty()) {
        String hay = (Common.str(row.get("batchNo")) + Common.str(row.get("plotNo"))
            + Common.str(row.get("cropName")) + Common.str(row.get("org"))).toLowerCase();
        if (!hay.contains(k)) continue;
      }
      filtered.add(row);
    }
    List<Map<String, Object>> scoped = new ArrayList<>();
    for (Map<String, Object> r : rows) {
      if (farmId != null && Common.num(r.get("farmId")) != farmId) continue;
      scoped.add(r);
    }
    List<Map<String, Object>> all = new ArrayList<>();
    for (Map<String, Object> r : scoped) {
      int res = Common.str(r.get("inspectDate")).compareTo(Common.today()) > 0 ? 0 : Common.num(r.get("dbResult"));
      all.add(Common.map("result", res));
    }
    int pending = (int) all.stream().filter(x -> Common.num(x.get("result")) == 0).count();
    int passed = (int) all.stream().filter(x -> Common.num(x.get("result")) == 1).count();
    int failed = (int) all.stream().filter(x -> Common.num(x.get("result")) == 2).count();
    int doneN = passed + failed;
    int total = filtered.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    java.util.List<Map<String, Object>> pageRows = page == null && size == null ? filtered : filtered.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("pending", pending);
    out.put("passed", passed);
    out.put("failed", failed);
    out.put("passRate", doneN == 0 ? 100 : Math.round(passed * 1000.0 / doneN) / 10.0);
    return out;
  }

  private Map<String, Object> toRow(Map<String, Object> r) {
    Map<String, Object> row = new LinkedHashMap<>();
    long inspectId = Common.num(r.get("id"));
    row.put("id", inspectId);
    row.put("batchId", r.get("batchId"));
    row.put("batchNo", r.get("batchNo"));
    row.put("plotNo", r.get("plotNo"));
    row.put("plotName", r.get("plotName"));
    row.put("cropName", r.get("cropName"));
    row.put("variety", r.get("variety"));
    row.put("farmName", r.get("farmName"));
    row.put("inspectDate", r.get("inspectDate"));
    row.put("org", r.get("org"));
    row.put("itemCount", jdbc.queryForObject(
        "SELECT COUNT(*) FROM inspect_result WHERE inspect_id = ?", Integer.class, inspectId));
    row.put("items", jdbc.queryForList("""
        SELECT code, name, limit_value AS `limit`, value, is_bad AS bad
        FROM inspect_result WHERE inspect_id = ? ORDER BY id
        """, inspectId));
    row.put("reportUrl", r.get("reportUrl"));
    row.put("reportNo", r.get("reportNo"));
    row.put("sourceInspectId", r.get("sourceInspectId"));
    row.put("disposal", r.get("disposal"));
    row.put("disposalNote", r.get("disposalNote"));
    row.put("disposeTime", r.get("disposeTime"));
    return row;
  }

  @Transactional
  public Map<String, Object> create(Map<String, Object> body) {
    long batchId = Common.num(body.get("batchId"));
    List<Map<String, Object>> batch = jdbc.queryForList(
        "SELECT id, batch_no AS batchNo FROM batch WHERE id = ?", batchId);
    if (batch.isEmpty()) throw new ApiException("批次不存在");
    String org = Common.str(body.get("org"));
    String date = Common.str(body.get("inspectDate"));
    if (org == null || org.isBlank()) throw new ApiException("请填写检测机构");
    if (date == null || date.length() < 10) throw new ApiException("请选择检测日期");
    List<?> inputs = (List<?>) body.getOrDefault("items", List.of());
    long templateId = Common.num(body.getOrDefault("templateId", 1));
    if (templateId <= 0) templateId = 1;
    final long finalTemplateId = templateId;
    List<Map<String, Object>> template = jdbc.queryForList(
        "SELECT code, name, limit_value AS `limit` FROM inspect_template_item WHERE template_id = ? ORDER BY id",
        templateId);
    List<Map<String, Object>> items = new ArrayList<>();
    boolean bad = false;
    for (Map<String, Object> t : template) {
      Object v = null;
      for (Object o : inputs) {
        if (o instanceof Map<?, ?> m && String.valueOf(m.get("code")).equals(String.valueOf(t.get("code")))) {
          v = m.get("value");
          break;
        }
      }
      Double value = null;
      if (v != null && !"".equals(v)) {
        try {
          value = Double.parseDouble(String.valueOf(v));
        } catch (Exception ignored) {
        }
      }
      boolean isBad = value != null && value > Double.parseDouble(String.valueOf(t.get("limit")));
      if (isBad) bad = true;
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("code", t.get("code"));
      item.put("name", t.get("name"));
      item.put("limit", t.get("limit"));
      item.put("value", value);
      item.put("bad", isBad);
      items.add(item);
    }
    int result = bad ? 2 : 1;
    String detectNo = "HF2026-" + date.replace("-", "").substring(4) + "-" + String.format("%04d", batchId);
    org.springframework.jdbc.support.GeneratedKeyHolder key = new org.springframework.jdbc.support.GeneratedKeyHolder();
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO quality_inspect (batch_id, template_id, inspect_date, org_name, org_code, detect_no,
                                       result, report_url, report_size, archive_status)
          VALUES (?, ?, ?, ?, 'HF-NJ-01', ?, ?, NULL, NULL, 0)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      ps.setLong(2, finalTemplateId);
      ps.setString(3, date);
      ps.setString(4, org);
      ps.setString(5, detectNo);
      ps.setInt(6, result);
      return ps;
    }, key);
    long inspectId = key.getKey().longValue();
    for (Map<String, Object> it : items) {
      jdbc.update("""
          INSERT INTO inspect_result (inspect_id, code, name, limit_value, value, is_bad)
          VALUES (?, ?, ?, ?, ?, ?)
          """, inspectId, it.get("code"), it.get("name"), it.get("limit"), it.get("value"),
          Boolean.TRUE.equals(it.get("bad")) ? 1 : 0);
    }
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '质检', '提交检测单', ?, '127.0.0.1')",
        batch.get(0).get("batchNo") + " · " + (result == 1 ? "合格" : "不合格"));
    if (result == 2) {
      jdbc.update("""
          UPDATE plot SET status = 4
          WHERE id = (SELECT plot_id FROM batch WHERE id = ?)
          """, batchId);
      jdbc.update("UPDATE batch SET status = 'BLOCKED' WHERE id = ?", batchId);
      jdbc.update("""
          INSERT INTO alert (type, level, target_id, message) VALUES ('QUALITY_FAIL', 3, ?, ?)
          """, batchId, batch.get(0).get("batchNo") + " 检测不合格，已暂停采收");
      notifications.notify(1, "质检不合格：" + batch.get(0).get("batchNo"),
          batch.get(0).get("batchNo") + " 检测不合格，已暂停采收", "质检不合格", "alert",
          List.of("INBOX", "SMS"), "/alerts");
    }
    states.refresh(batchId);
    Map<String, Object> fresh = jdbc.queryForMap("""
        SELECT qi.id, b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName,
               c.name AS cropName, c.variety, f.name AS farmName,
               DATE_FORMAT(qi.inspect_date, '%Y-%m-%d') AS inspectDate, qi.org_name AS org,
               qi.result AS dbResult, qi.detect_no AS reportNo, qi.report_url AS reportUrl,
               qi.source_inspect_id AS sourceInspectId, qi.disposal, qi.disposal_note AS disposalNote,
               DATE_FORMAT(qi.dispose_time, '%Y-%m-%d %H:%i') AS disposeTime
        FROM quality_inspect qi
        JOIN batch b ON b.id = qi.batch_id JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id JOIN farm f ON f.id = b.farm_id
        WHERE qi.id = ?
        """, inspectId);
    Map<String, Object> row = toRow(fresh);
    row.put("result", result);
    row.put("locked", result == 2);
    return row;
  }

  public List<Map<String, Object>> templates() {
    List<Map<String, Object>> list = jdbc.queryForList("SELECT id, name FROM inspect_template ORDER BY id");
    for (Map<String, Object> t : list) {
      t.put("items", jdbc.queryForList("""
          SELECT code, name, limit_value AS `limit` FROM inspect_template_item
          WHERE template_id = ? ORDER BY id
          """, t.get("id")));
    }
    return list;
  }

  @Transactional
  public Map<String, Object> createTemplate(Map<String, Object> body) {
    String name = Common.str(body.get("name"));
    if (name == null || name.isBlank()) throw new ApiException("模板名称必填");
    List<?> items = (List<?>) body.getOrDefault("items", List.of());
    if (items.isEmpty()) throw new ApiException("请至少配置一个检测项");
    org.springframework.jdbc.support.GeneratedKeyHolder key = new org.springframework.jdbc.support.GeneratedKeyHolder();
    jdbc.update(con -> {
      var ps = con.prepareStatement("INSERT INTO inspect_template (name) VALUES (?)",
          java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, name);
      return ps;
    }, key);
    long id = key.getKey().longValue();
    for (Object o : items) {
      if (!(o instanceof Map<?, ?> m)) continue;
      jdbc.update("""
          INSERT INTO inspect_template_item (template_id, code, name, limit_value, method)
          VALUES (?, ?, ?, ?, 'GB 23200.8')
          """, id, Common.str(m.get("code")), Common.str(m.get("name")),
          Double.parseDouble(String.valueOf(m.get("limit") == null ? "0.01" : m.get("limit"))));
    }
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '质检', '新增检测模板', ?, '127.0.0.1')", name);
    return Common.map("id", id, "name", name, "items", jdbc.queryForList("""
        SELECT code, name, limit_value AS `limit` FROM inspect_template_item WHERE template_id = ? ORDER BY id
        """, id));
  }

  @Transactional
  public Map<String, Object> recheck(long sourceId, Map<String, Object> body) {
    List<Map<String, Object>> src = jdbc.queryForList("""
        SELECT qi.batch_id AS batchId, b.batch_no AS batchNo, qi.template_id AS templateId, qi.org_name AS org
        FROM quality_inspect qi JOIN batch b ON b.id = qi.batch_id WHERE qi.id = ?
        """, sourceId);
    if (src.isEmpty()) throw new ApiException("检测单不存在", 404);
    long batchId = Common.num(src.get(0).get("batchId"));
    long templateId = Common.num(body.getOrDefault("templateId", src.get(0).get("templateId")));
    if (templateId <= 0) templateId = 1;
    String org = Common.str(body.getOrDefault("org", src.get(0).get("org")));
    String date = Common.str(body.getOrDefault("inspectDate", Common.today()));
    if (org == null || org.isBlank()) throw new ApiException("请填写检测机构");
    List<?> inputs = (List<?>) body.getOrDefault("items", List.of());
    List<Map<String, Object>> template = jdbc.queryForList("""
        SELECT code, name, limit_value AS `limit` FROM inspect_template_item WHERE template_id = ? ORDER BY id
        """, templateId);
    List<Map<String, Object>> items = new ArrayList<>();
    boolean bad = false;
    for (Map<String, Object> t : template) {
      Object v = null;
      for (Object o : inputs) {
        if (o instanceof Map<?, ?> m && String.valueOf(m.get("code")).equals(String.valueOf(t.get("code")))) {
          v = m.get("value");
          break;
        }
      }
      Double value = null;
      if (v != null && !"".equals(v)) {
        try {
          value = Double.parseDouble(String.valueOf(v));
        } catch (Exception ignored) {
        }
      }
      boolean isBad = value != null && value > Double.parseDouble(String.valueOf(t.get("limit")));
      if (isBad) bad = true;
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("code", t.get("code"));
      item.put("name", t.get("name"));
      item.put("limit", t.get("limit"));
      item.put("value", value);
      item.put("bad", isBad);
      items.add(item);
    }
    int result = bad ? 2 : 1;
    String detectNo = "HF2026-" + date.replace("-", "").substring(4) + "-" + String.format("%04d", batchId)
        + "R" + (System.currentTimeMillis() % 1000);
    org.springframework.jdbc.support.GeneratedKeyHolder key = new org.springframework.jdbc.support.GeneratedKeyHolder();
    int finalResult = result;
    long finalTemplate = templateId;
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO quality_inspect (batch_id, template_id, inspect_date, org_name, org_code, detect_no,
                                       result, source_inspect_id, archive_status)
          VALUES (?, ?, ?, ?, 'HF-NJ-01', ?, ?, ?, 0)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      ps.setLong(2, finalTemplate);
      ps.setString(3, date);
      ps.setString(4, org);
      ps.setString(5, detectNo);
      ps.setInt(6, finalResult);
      ps.setLong(7, sourceId);
      return ps;
    }, key);
    long inspectId = key.getKey().longValue();
    for (Map<String, Object> it : items) {
      jdbc.update("""
          INSERT INTO inspect_result (inspect_id, code, name, limit_value, value, is_bad)
          VALUES (?, ?, ?, ?, ?, ?)
          """, inspectId, it.get("code"), it.get("name"), it.get("limit"), it.get("value"),
          Boolean.TRUE.equals(it.get("bad")) ? 1 : 0);
    }
    if (result == 1) {
      jdbc.update("""
          UPDATE alert SET status = 2, resolver_id = 1, resolve_time = NOW(),
                 resolve_note = '复检合格，自动解除'
          WHERE type = 'QUALITY_FAIL' AND target_id = ? AND status IN (0, 1)
          """, batchId);
      states.restorePlot(batchId);
      jdbc.update("UPDATE plot SET status = CASE WHEN status = 4 THEN 2 ELSE status END WHERE status = 4 AND id = (SELECT plot_id FROM batch WHERE id = ?)", batchId);
    } else {
      jdbc.update("UPDATE plot SET status = 4 WHERE id = (SELECT plot_id FROM batch WHERE id = ?)", batchId);
      jdbc.update("UPDATE batch SET status = 'BLOCKED' WHERE id = ?", batchId);
      jdbc.update("""
          INSERT INTO alert (type, level, target_id, message) VALUES ('QUALITY_FAIL', 3, ?, ?)
          """, batchId, src.get(0).get("batchNo") + " 复检仍不合格，请处置");
      notifications.notify(1, "复检不合格：" + src.get(0).get("batchNo"),
          src.get(0).get("batchNo") + " 复检仍不合格，请处置", "质检不合格", "alert",
          List.of("INBOX", "SMS"), "/alerts");
    }
    states.refresh(batchId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '质检', '提交复检', ?, '127.0.0.1')",
        src.get(0).get("batchNo") + " · " + (result == 1 ? "合格" : "不合格"));
    Map<String, Object> row = toRow(jdbc.queryForMap("""
        SELECT qi.id, b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName,
               c.name AS cropName, c.variety, f.name AS farmName,
               DATE_FORMAT(qi.inspect_date, '%Y-%m-%d') AS inspectDate, qi.org_name AS org,
               qi.result AS dbResult, qi.detect_no AS reportNo, qi.report_url AS reportUrl,
               qi.source_inspect_id AS sourceInspectId, qi.disposal, qi.disposal_note AS disposalNote,
               DATE_FORMAT(qi.dispose_time, '%Y-%m-%d %H:%i') AS disposeTime
        FROM quality_inspect qi
        JOIN batch b ON b.id = qi.batch_id JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id JOIN farm f ON f.id = b.farm_id
        WHERE qi.id = ?
        """, inspectId));
    row.put("result", result);
    row.put("locked", result == 2);
    return row;
  }

  @Transactional
  public Map<String, Object> dispose(long inspectId, Map<String, Object> body) {
    String action = Common.str(body.get("action"));
    if (!List.of("RETURN", "DESTROY", "DOWNGRADE").contains(action))
      throw new ApiException("处置方式仅支持 RETURN / DESTROY / DOWNGRADE");
    int updated = jdbc.update("""
        UPDATE quality_inspect SET disposal = ?, disposal_note = ?, dispose_user = 1, dispose_time = NOW()
        WHERE id = ?
        """, action, Common.str(body.get("note")), inspectId);
    if (updated == 0) throw new ApiException("检测单不存在", 404);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '质检', '处置不合格品', ?, '127.0.0.1')",
        "inspect#" + inspectId + " " + action);
    return jdbc.queryForMap("""
        SELECT qi.id, b.batch_no AS batchNo, qi.disposal, qi.disposal_note AS disposalNote,
               DATE_FORMAT(qi.dispose_time, '%Y-%m-%d %H:%i') AS disposeTime
        FROM quality_inspect qi JOIN batch b ON b.id = qi.batch_id WHERE qi.id = ?
        """, inspectId);
  }
}
