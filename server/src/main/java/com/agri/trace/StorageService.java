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
public class StorageService {
  private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private final JdbcTemplate jdbc;
  private final NotificationService notifications;

  public StorageService(JdbcTemplate jdbc, NotificationService notifications) {
    this.jdbc = jdbc;
    this.notifications = notifications;
  }

  public List<Map<String, Object>> warehouses() {
    List<Map<String, Object>> list = jdbc.queryForList("""
        SELECT w.id, w.name, w.type, w.location, w.temp_min AS tempMin, w.temp_max AS tempMax,
               w.capacity_kg AS capacityKg, w.manager,
               COALESCE((SELECT SUM(CASE WHEN type = 'IN' THEN quantity_kg ELSE -quantity_kg END)
                         FROM storage_ledger l WHERE l.warehouse_id = w.id), 0) AS stockKg,
               COALESCE((SELECT SUM(quantity_kg) FROM storage_ledger l
                         WHERE l.warehouse_id = w.id AND l.type = 'IN'), 0) AS inKg,
               COALESCE((SELECT SUM(quantity_kg) FROM storage_ledger l
                         WHERE l.warehouse_id = w.id AND l.type = 'OUT'), 0) AS outKg,
               COALESCE((SELECT SUM(quantity_kg) FROM storage_ledger l
                         WHERE l.warehouse_id = w.id AND l.type = 'LOSS'), 0) AS lossKg,
               (SELECT temp FROM warehouse_temperature t WHERE t.warehouse_id = w.id
                  ORDER BY record_time DESC LIMIT 1) AS latestTemp,
               (SELECT humidity FROM warehouse_temperature t WHERE t.warehouse_id = w.id
                  ORDER BY record_time DESC LIMIT 1) AS latestHumidity,
               (SELECT DATE_FORMAT(record_time, '%Y-%m-%d %H:%i') FROM warehouse_temperature t
                  WHERE t.warehouse_id = w.id ORDER BY record_time DESC LIMIT 1) AS lastRecordAt
        FROM warehouse w ORDER BY w.id
        """);
    for (Map<String, Object> w : list) {
      double stock = Double.parseDouble(String.valueOf(w.get("stockKg")));
      double cap = w.get("capacityKg") == null ? 0 : Double.parseDouble(String.valueOf(w.get("capacityKg")));
      w.put("utilization", cap == 0 ? 0 : Math.round(stock / cap * 100));
    }
    return list;
  }

  public Map<String, Object> inventory(Long farmId) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT b.id AS batchId, b.batch_no AS batchNo, c.name AS cropName, p.plot_no AS plotNo,
               f.name AS farmName,
               SUM(CASE WHEN l.type = 'IN' THEN l.quantity_kg ELSE 0 END) AS inKg,
               SUM(CASE WHEN l.type = 'OUT' THEN l.quantity_kg ELSE 0 END) AS outKg,
               SUM(CASE WHEN l.type = 'LOSS' THEN l.quantity_kg ELSE 0 END) AS lossKg,
               SUM(CASE WHEN l.type = 'IN' THEN l.quantity_kg ELSE -l.quantity_kg END) AS stockKg,
               GROUP_CONCAT(DISTINCT w.name ORDER BY w.id SEPARATOR ' / ') AS warehouses,
               DATE_FORMAT(MAX(l.happen_time), '%Y-%m-%d %H:%i') AS lastAt
        FROM storage_ledger l
        JOIN batch b ON b.id = l.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id
        JOIN crop c ON c.id = b.crop_id
        JOIN warehouse w ON w.id = l.warehouse_id
        WHERE (? = 0 OR f.id = ?)
        GROUP BY b.id, b.batch_no, c.name, p.plot_no, f.name
        HAVING stockKg > 0
        ORDER BY stockKg DESC
        """, fid, fid);
    double total = rows.stream().mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("stockKg")))).sum();
    return Common.map("records", rows, "total", rows.size(), "stockKg", Math.round(total));
  }

  public Map<String, Object> ledger(String type, String kw, Long farmId, Integer page, Integer size) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT l.id, l.type, l.quantity_kg AS quantityKg, l.operator, l.note,
               DATE_FORMAT(l.happen_time, '%Y-%m-%d %H:%i') AS happenTime,
               b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, f.name AS farmName,
               c.name AS cropName, w.name AS warehouseName
        FROM storage_ledger l
        JOIN batch b ON b.id = l.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id
        JOIN crop c ON c.id = b.crop_id
        JOIN warehouse w ON w.id = l.warehouse_id
        WHERE (? = 0 OR f.id = ?) AND (? = '' OR l.type = ?)
        ORDER BY l.happen_time DESC, l.id DESC
        """, fid, fid, type == null ? "" : type, type == null ? "" : type);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = rows.stream().filter(r ->
        k.isEmpty() || (Common.str(r.get("batchNo")) + Common.str(r.get("cropName")) + Common.str(r.get("warehouseName")))
            .toLowerCase().contains(k)).toList();
    int total = filtered.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? filtered : filtered.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("inKg", Math.round(rows.stream().filter(r -> "IN".equals(r.get("type"))).mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("quantityKg")))).sum()));
    out.put("outKg", Math.round(rows.stream().filter(r -> "OUT".equals(r.get("type"))).mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("quantityKg")))).sum()));
    out.put("lossKg", Math.round(rows.stream().filter(r -> "LOSS".equals(r.get("type"))).mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("quantityKg")))).sum()));
    return out;
  }

  @Transactional
  public Map<String, Object> inbound(Map<String, Object> body) {
    return save(body, "IN");
  }

  @Transactional
  public Map<String, Object> outbound(Map<String, Object> body) {
    String type = "LOSS".equals(Common.str(body.get("type"))) ? "LOSS" : "OUT";
    long batchId = Common.num(body.get("batchId"));
    long warehouseId = Common.num(body.get("warehouseId"));
    double qty = Double.parseDouble(String.valueOf(body.getOrDefault("quantityKg", 0)));
    if (qty <= 0) throw new ApiException("数量必须大于 0");
    Double stock = jdbc.queryForObject("""
        SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity_kg ELSE -quantity_kg END), 0)
        FROM storage_ledger WHERE batch_id = ? AND warehouse_id = ?
        """, Double.class, batchId, warehouseId);
    if (stock == null || stock < qty) throw new ApiException("库存不足，当前可用 " + (stock == null ? 0 : stock) + " kg");
    return save(body, type);
  }

  private Map<String, Object> save(Map<String, Object> body, String type) {
    long batchId = Common.num(body.get("batchId"));
    long warehouseId = Common.num(body.get("warehouseId"));
    double qty = Double.parseDouble(String.valueOf(body.getOrDefault("quantityKg", 0)));
    if (qty <= 0) throw new ApiException("数量必须大于 0");
    List<Map<String, Object>> batch = jdbc.queryForList("SELECT id FROM batch WHERE id = ?", batchId);
    if (batch.isEmpty()) throw new ApiException("批次不存在");
    List<Map<String, Object>> wh = jdbc.queryForList("SELECT id FROM warehouse WHERE id = ?", warehouseId);
    if (wh.isEmpty()) throw new ApiException("库房不存在");
    String time = Common.str(body.get("happenTime"));
    if (time == null || time.isBlank()) time = LocalDateTime.now().format(DT);
    String operator = Common.str(body.getOrDefault("operator", "张耕"));
    String note = Common.str(body.get("note"));
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    String finalTime = time;
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO storage_ledger (batch_id, warehouse_id, type, quantity_kg, happen_time, operator, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      ps.setLong(2, warehouseId);
      ps.setString(3, type);
      ps.setDouble(4, qty);
      ps.setString(5, finalTime.length() == 16 ? finalTime + ":00" : finalTime);
      ps.setString(6, operator);
      ps.setString(7, note);
      return ps;
    }, key);
    long id = key.getKey().longValue();
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '仓储', ?, ?, '127.0.0.1')",
        "IN".equals(type) ? "入库" : "LOSS".equals(type) ? "报损" : "出库", "batch#" + batchId + " " + qty + "kg");
    return jdbc.queryForMap("""
        SELECT l.id, l.type, l.quantity_kg AS quantityKg, l.operator, l.note,
               DATE_FORMAT(l.happen_time, '%Y-%m-%d %H:%i') AS happenTime,
               b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, f.name AS farmName,
               c.name AS cropName, w.name AS warehouseName
        FROM storage_ledger l
        JOIN batch b ON b.id = l.batch_id JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id JOIN crop c ON c.id = b.crop_id
        JOIN warehouse w ON w.id = l.warehouse_id WHERE l.id = ?
        """, id);
  }

  public Map<String, Object> recordTemperature(Map<String, Object> body) {
    long warehouseId = Common.num(body.get("warehouseId"));
    List<Map<String, Object>> whs = jdbc.queryForList(
        "SELECT name, temp_min AS min, temp_max AS max FROM warehouse WHERE id = ?", warehouseId);
    if (whs.isEmpty()) throw new ApiException("库房不存在", 404);
    double temp = Double.parseDouble(String.valueOf(body.getOrDefault("temp", 0)));
    Object humidity = body.get("humidity");
    jdbc.update("""
        INSERT INTO warehouse_temperature (warehouse_id, temp, humidity, record_time) VALUES (?, ?, ?, NOW())
        """, warehouseId, temp, humidity);
    double min = Double.parseDouble(String.valueOf(whs.get(0).get("min")));
    double max = Double.parseDouble(String.valueOf(whs.get(0).get("max")));
    if (temp < min || temp > max) {
      notifications.notify(1, "库房温度异常：" + whs.get(0).get("name"),
          "当前 " + temp + "℃，超出 " + min + "–" + max + "℃ 区间", "仓储温控", "warn",
          List.of("INBOX", "WECOM"), "/warehouse");
    }
    return Common.map("warehouseId", warehouseId, "temp", temp, "humidity", humidity,
        "time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
  }
}
