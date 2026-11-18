package com.agri.trace;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InputService {
  private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private final JdbcTemplate jdbc;
  private final BatchStateService states;

  public InputService(JdbcTemplate jdbc, BatchStateService states) {
    this.jdbc = jdbc;
    this.states = states;
  }

  public Map<String, Object> items() {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT i.id, i.name, i.type, i.active_ingredient AS ingredient, i.safety_interval_days AS safeDays,
               i.max_dosage AS maxDosage, i.dosage_unit AS unit, i.license_no AS licenseNo,
               COALESCE(SUM(CASE WHEN l.type = 'PURCHASE' THEN l.quantity ELSE -l.quantity END), 0) AS stock,
               COALESCE(SUM(CASE WHEN l.type = 'PURCHASE' THEN l.quantity ELSE 0 END), 0) AS purchased,
               COALESCE(SUM(CASE WHEN l.type = 'USE' THEN l.quantity ELSE 0 END), 0) AS used
        FROM input_item i LEFT JOIN input_ledger l ON l.item_id = i.id
        GROUP BY i.id, i.name, i.type, i.active_ingredient, i.safety_interval_days,
                 i.max_dosage, i.dosage_unit, i.license_no
        ORDER BY i.id
        """);
    for (Map<String, Object> r : rows) {
      double stock = Double.parseDouble(String.valueOf(r.get("stock")));
      double purchased = Double.parseDouble(String.valueOf(r.get("purchased")));
      r.put("lowStock", stock <= purchased * 0.15);
    }
    double totalStock = rows.stream().mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("stock")))).sum();
    long low = rows.stream().filter(r -> Boolean.TRUE.equals(r.get("lowStock"))).count();
    return Common.map("records", rows, "total", rows.size(), "stock", Math.round(totalStock), "lowStock", low);
  }

  public Map<String, Object> ledger(String kw, Long farmId, Integer page, Integer size) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT l.id, l.type, l.quantity, l.unit, l.operator, l.note,
               DATE_FORMAT(l.happen_time, '%Y-%m-%d %H:%i') AS happenTime,
               i.name AS itemName, i.type AS itemType, i.safety_interval_days AS safeDays,
               b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, f.name AS farmName
        FROM input_ledger l
        JOIN input_item i ON i.id = l.item_id
        LEFT JOIN batch b ON b.id = l.batch_id
        LEFT JOIN plot p ON p.id = b.plot_id
        LEFT JOIN farm f ON f.id = b.farm_id
        WHERE (? = 0 OR f.id = ?)
        ORDER BY l.happen_time DESC, l.id DESC
        """, fid, fid);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = rows.stream().filter(r ->
        k.isEmpty() || (Common.str(r.get("itemName")) + Common.str(r.get("batchNo"))).toLowerCase().contains(k)).toList();
    int total = filtered.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? filtered : filtered.subList(from, Math.min(total, from + sz));
    return Common.map("records", pageRows, "total", total,
        "purchaseQty", Math.round(rows.stream().filter(r -> "PURCHASE".equals(r.get("type")))
            .mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("quantity")))).sum()),
        "useQty", Math.round(rows.stream().filter(r -> "USE".equals(r.get("type")))
            .mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("quantity")))).sum()));
  }

  @Transactional
  public Map<String, Object> purchase(Map<String, Object> body) {
    long itemId = Common.num(body.get("itemId"));
    double qty = Double.parseDouble(String.valueOf(body.getOrDefault("quantity", 0)));
    if (qty <= 0) throw new ApiException("采购数量必须大于 0");
    Map<String, Object> item = item(itemId);
    String time = time(body);
    jdbc.update("""
        INSERT INTO input_ledger (item_id, batch_id, type, quantity, unit, operator, happen_time, note)
        VALUES (?, NULL, 'PURCHASE', ?, ?, ?, ?, ?)
        """, itemId, qty, item.get("unit"), Common.str(body.getOrDefault("operator", "王敏")), time,
        Common.str(body.get("note")));
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '农资', '采购入库', ?, '127.0.0.1')",
        item.get("name") + " " + qty + item.get("unit"));
    return Common.map("itemId", itemId, "quantity", qty, "unit", item.get("unit"), "stockAfter", stockOf(itemId));
  }

  @Transactional
  public Map<String, Object> use(Map<String, Object> body) {
    long itemId = Common.num(body.get("itemId"));
    long batchId = Common.num(body.get("batchId"));
    double qty = Double.parseDouble(String.valueOf(body.getOrDefault("quantity", 0)));
    if (qty <= 0) throw new ApiException("领用数量必须大于 0");
    Map<String, Object> item = item(itemId);
    List<Map<String, Object>> batch = jdbc.queryForList("""
        SELECT b.id, b.batch_no AS batchNo, p.manager_id FROM batch b JOIN plot p ON p.id = b.plot_id WHERE b.id = ?
        """, batchId);
    if (batch.isEmpty()) throw new ApiException("批次不存在");
    if (stockOf(itemId) < qty) throw new ApiException("库存不足，当前可用 " + stockOf(itemId));
    String time = time(body);
    String operator = Common.str(body.getOrDefault("operator", "张耕"));
    jdbc.update("""
        INSERT INTO input_ledger (item_id, batch_id, type, quantity, unit, operator, happen_time, note)
        VALUES (?, ?, 'USE', ?, ?, ?, ?, ?)
        """, itemId, batchId, qty, item.get("unit"), operator, time, Common.str(body.get("note")));
    String itemType = Common.str(item.get("type"));
    String produceType = "农药".equals(itemType) ? "打药" : "化肥".equals(itemType) ? "施肥" : "其他";
    int safeDays = Common.num(item.get("safeDays"));
    String detail = item.get("name") + " " + qty + Common.str(item.get("unit"))
        + (safeDays > 0 ? "，安全间隔 " + safeDays + " 天" : "")
        + (body.get("note") == null ? "" : "；" + Common.str(body.get("note")));
    Integer opId = jdbc.query("SELECT id FROM sys_user WHERE real_name = ? LIMIT 1",
        rs -> rs.next() ? rs.getInt(1) : null, operator);
    if (opId == null) opId = Common.num(batch.get(0).get("manager_id"));
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    int finalOp = opId;
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO production_record (batch_id, type, quantity_kg, operator_id, happen_time, remark)
          VALUES (?, ?, NULL, ?, ?, ?)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      ps.setString(2, produceType);
      ps.setInt(3, finalOp);
      ps.setString(4, time);
      ps.setString(5, detail);
      return ps;
    }, key);
    long produceId = key.getKey().longValue();
    states.refresh(batchId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '农资', '领用出库', ?, '127.0.0.1')",
        batch.get(0).get("batchNo") + " · " + item.get("name") + " " + qty);
    return Common.map("itemId", itemId, "batchId", batchId, "quantity", qty,
        "stockAfter", stockOf(itemId), "safeDays", safeDays, "produceId", produceId, "detail", detail);
  }

  private Map<String, Object> item(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT id, name, type, safety_interval_days AS safeDays, dosage_unit AS unit FROM input_item WHERE id = ?
        """, id);
    if (rows.isEmpty()) throw new ApiException("农资不存在", 404);
    return rows.get(0);
  }

  private double stockOf(long itemId) {
    Double s = jdbc.queryForObject("""
        SELECT COALESCE(SUM(CASE WHEN type = 'PURCHASE' THEN quantity ELSE -quantity END), 0)
        FROM input_ledger WHERE item_id = ?
        """, Double.class, itemId);
    return s == null ? 0 : s;
  }

  private String time(Map<String, Object> body) {
    String t = Common.str(body.get("happenTime"));
    if (t == null || t.isBlank()) return LocalDateTime.now().format(DT);
    return t.length() == 16 ? t + ":00" : t;
  }
}
