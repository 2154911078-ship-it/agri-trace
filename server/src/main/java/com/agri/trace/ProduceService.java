package com.agri.trace;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProduceService {
  private static final Pattern SAFE = Pattern.compile("安全间隔\\s*(\\d+)\\s*天");
  private final JdbcTemplate jdbc;
  private final BatchStateService states;

  public ProduceService(JdbcTemplate jdbc, BatchStateService states) {
    this.jdbc = jdbc;
    this.states = states;
  }

  private static final String BASE = """
      SELECT pr.id, b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, p.name AS plotName,
             c.name AS cropName, c.variety, f.name AS farmName, f.id AS farmId, pr.type,
             DATE_FORMAT(pr.happen_time, '%Y-%m-%d %H:%i') AS happenTime, pr.remark AS detail,
             pr.quantity_kg AS quantityKg,
             u.real_name AS operator
      FROM production_record pr
      JOIN batch b ON b.id = pr.batch_id
      JOIN plot p ON p.id = b.plot_id
      JOIN crop c ON c.id = b.crop_id
      JOIN farm f ON f.id = b.farm_id
      LEFT JOIN sys_user u ON u.id = pr.operator_id
      """;

  public Map<String, Object> page(String kw, String type, Long batchId, Long farmId, Integer page, Integer size) {
    List<Map<String, Object>> all = decorated();
    if (farmId != null) {
      long fid = farmId;
      all = all.stream().filter(x -> Common.num(x.get("farmId")) == fid).toList();
    }
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Map<String, Object> r : all) {
      String t = Common.str(r.get("type"));
      if (batchId != null && Common.num(r.get("batchId")) != batchId) continue;
      if (type != null && !type.isBlank() && !"all".equals(type)) {
        boolean hit = switch (type) {
          case "fertilize" -> "施肥".equals(t);
          case "spray" -> "打药".equals(t);
          case "irrigate" -> "灌溉".equals(t);
          case "harvest" -> "采收".equals(t) || "测产".equals(t);
          default -> !List.of("施肥", "打药", "灌溉", "采收", "测产").contains(t);
        };
        if (!hit) continue;
      }
      if (!k.isEmpty()) {
        String hay = (Common.str(r.get("batchNo")) + Common.str(r.get("plotNo")) + Common.str(r.get("plotName"))
            + Common.str(r.get("cropName")) + t + Common.str(r.get("operator"))).toLowerCase();
        if (!hay.contains(k)) continue;
      }
      rows.add(r);
    }
    Map<String, Object> counts = new LinkedHashMap<>();
    counts.put("all", all.size());
    counts.put("fertilize", all.stream().filter(x -> "施肥".equals(x.get("type"))).count());
    counts.put("spray", all.stream().filter(x -> "打药".equals(x.get("type"))).count());
    counts.put("irrigate", all.stream().filter(x -> "灌溉".equals(x.get("type"))).count());
    counts.put("harvest", all.stream().filter(x -> List.of("采收", "测产").contains(x.get("type"))).count());
    counts.put("other", all.size() - Common.num(counts.get("fertilize")) - Common.num(counts.get("spray"))
        - Common.num(counts.get("irrigate")) - Common.num(counts.get("harvest")));

    LocalDate today = LocalDate.parse(Common.today());
    long todayCnt = all.stream().filter(x -> Common.str(x.get("happenTime")).startsWith(Common.today())).count();
    long week = all.stream().filter(x -> {
      LocalDate d = LocalDate.parse(Common.str(x.get("happenTime")).substring(0, 10));
      long diff = java.time.temporal.ChronoUnit.DAYS.between(d, today);
      return diff >= 0 && diff <= 7;
    }).count();
    long safety = all.stream().filter(x -> x.get("safeDate") != null
        && Common.str(x.get("safeDate")).compareTo(Common.today()) > 0).count();

    int total = rows.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? rows : rows.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("today", todayCnt);
    out.put("week", week);
    out.put("safetyAlerts", safety);
    out.put("counts", counts);
    return out;
  }

  private List<Map<String, Object>> decorated() {
    List<Map<String, Object>> rows = jdbc.queryForList(BASE + " ORDER BY pr.happen_time DESC");
    for (Map<String, Object> r : rows) addSafe(r);
    return rows;
  }

  private void addSafe(Map<String, Object> r) {
    int days = 0;
    if ("打药".equals(r.get("type"))) {
      Matcher m = SAFE.matcher(Common.str(r.get("detail")) == null ? "" : Common.str(r.get("detail")));
      if (m.find()) days = Integer.parseInt(m.group(1));
    }
    if (days > 0) {
      LocalDate d = LocalDate.parse(Common.str(r.get("happenTime")).substring(0, 10)).plusDays(days);
      r.put("safeDays", days);
      r.put("safeDate", d.format(DateTimeFormatter.ISO_LOCAL_DATE));
    } else {
      r.remove("safeDays");
      r.remove("safeDate");
    }
  }

  @Transactional
  public Map<String, Object> create(Map<String, Object> body) {
    long batchId = Common.num(body.get("batchId"));
    List<Map<String, Object>> found = jdbc.queryForList("""
        SELECT b.id, b.batch_no, b.plot_id, p.name AS plotName, p.manager_id
        FROM batch b JOIN plot p ON p.id = b.plot_id WHERE b.id = ?
        """, batchId);
    if (found.isEmpty()) throw new ApiException("批次不存在");
    Map<String, Object> batch = found.get(0);
    String type = Common.str(body.get("type"));
    if (type == null || type.isBlank()) throw new ApiException("请选择农事类型");
    String happen = Common.str(body.get("happenTime"));
    if (happen == null || happen.length() < 10) throw new ApiException("请选择发生时间");
    String operator = Common.str(body.get("operator"));
    Integer opId = jdbc.query("SELECT id FROM sys_user WHERE real_name = ? LIMIT 1",
        rs -> rs.next() ? rs.getInt(1) : null, operator);
    if (opId == null) opId = Common.num(batch.get("manager_id"));
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    int op = opId;
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO production_record (batch_id, type, quantity_kg, operator_id, happen_time, remark)
          VALUES (?, ?, ?, ?, ?, ?)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      ps.setString(2, type);
      Double quantity = null;
      if ("采收".equals(type) || "测产".equals(type)) {
        Object qv = body.get("quantityKg");
        if (qv != null && !"".equals(qv)) {
          try { quantity = Double.parseDouble(String.valueOf(qv)); } catch (Exception ignored) {}
        }
        if (quantity == null) {
          java.util.regex.Matcher m = java.util.regex.Pattern.compile("([\\d,]+)\\s*kg")
              .matcher(Common.str(body.get("detail")) == null ? "" : Common.str(body.get("detail")));
          if (m.find()) quantity = Double.parseDouble(m.group(1).replace(",", ""));
        }
      }
      if (quantity == null) ps.setNull(3, java.sql.Types.DECIMAL);
      else ps.setDouble(3, quantity);
      ps.setInt(4, op);
      ps.setString(5, happen.length() == 16 ? happen + ":00" : happen);
      ps.setString(6, Common.str(body.get("detail")));
      return ps;
    }, key);
    long id = key.getKey() == null ? 0 : key.getKey().longValue();
    Map<String, Object> r = jdbc.queryForMap(BASE + " WHERE pr.id = ?", id);
    addSafe(r);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (?, '生产', '新增农事记录', ?, '127.0.0.1')",
        op, Common.str(batch.get("batch_no")) + " · " + type);
    states.refresh(batchId);
    return r;
  }
}
