package com.agri.trace;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShipService {
  private static final DateTimeFormatter MIN = DateTimeFormatter.ofPattern("HH:mm");
  private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
  private final JdbcTemplate jdbc;
  private final BatchStateService states;

  public ShipService(JdbcTemplate jdbc, BatchStateService states) {
    this.jdbc = jdbc;
    this.states = states;
  }

  public Map<String, Object> page(String kw, String status, Long farmId, Integer page, Integer size) {
    List<Map<String, Object>> rows = all(farmId);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = new ArrayList<>();
    for (Map<String, Object> r : rows) {
      if (status != null && !status.isBlank() && !status.equals(r.get("status"))) continue;
      if (!k.isEmpty()) {
        String hay = (Common.str(r.get("batchNo")) + Common.str(r.get("plotNo")) + Common.str(r.get("cropName"))
            + Common.str(r.get("carrier")) + Common.str(r.get("plateNo")) + Common.str(r.get("dealer")))
            .toLowerCase();
        if (!hay.contains(k)) continue;
      }
      filtered.add(r);
    }
    int total = filtered.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    java.util.List<Map<String, Object>> pageRows = page == null && size == null ? filtered : filtered.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("pending", rows.stream().filter(x -> "pending".equals(x.get("status"))).count());
    out.put("transit", rows.stream().filter(x -> "transit".equals(x.get("status"))).count());
    out.put("delivered", rows.stream().filter(x -> "delivered".equals(x.get("status"))).count());
    out.put("alerts", rows.stream().filter(x -> "alert".equals(x.get("status"))).count());
    return out;
  }

  private List<Map<String, Object>> all(Long farmId) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> base = jdbc.queryForList("""
        SELECT b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, c.name AS cropName,
               f.name AS farmName, f.id AS farmId, o.id AS orderId, o.carrier, o.plate_no AS plateNo,
               DATE_FORMAT(o.start_time, '%Y-%m-%d %H:%i') AS startTime, o.status AS ostatus,
               DATE_FORMAT(o.sign_time, '%Y-%m-%d %H:%i') AS signAt, o.signer AS signBy,
               o.from_addr AS fromAddr, o.to_addr AS toAddr,
               (SELECT dealer FROM sale_record s WHERE s.batch_id = b.id ORDER BY s.id DESC LIMIT 1) AS dealer,
               (SELECT qty FROM sale_record s WHERE s.batch_id = b.id ORDER BY s.id DESC LIMIT 1) AS qty
        FROM batch b
        JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id
        JOIN farm f ON f.id = b.farm_id
        LEFT JOIN logistics_order o ON o.id = (
          SELECT MAX(o2.id) FROM logistics_order o2 WHERE FIND_IN_SET(b.id, o2.batch_ids))
        WHERE (? = 0 OR f.id = ?)
        ORDER BY b.id
        """, fid, fid);
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : base) out.add(toRow(r));
    return out;
  }

  private Map<String, Object> toRow(Map<String, Object> r) {
    long batchId = Common.num(r.get("batchId"));
    String ost = r.get("ostatus") == null ? null : String.valueOf(Common.num(r.get("ostatus")));
    String status = ost == null ? "pending" : switch (ost) {
      case "3" -> "delivered";
      case "4" -> "alert";
      default -> "transit";
    };
    String start = Common.str(r.get("startTime"));
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", batchId);
    row.put("batchId", batchId);
    row.put("batchNo", r.get("batchNo"));
    row.put("plotNo", r.get("plotNo"));
    row.put("cropName", r.get("cropName"));
    row.put("farmName", r.get("farmName"));
    row.put("carrier", r.get("carrier") == null ? "" : r.get("carrier"));
    row.put("plateNo", r.get("plateNo") == null ? "" : r.get("plateNo"));
    row.put("startTime", start == null ? "" : start);
    row.put("dealer", r.get("dealer"));
    row.put("qty", r.get("qty"));
    row.put("status", status);
    row.put("from", r.get("fromAddr") == null ? r.get("farmName") : r.get("fromAddr"));
    row.put("to", r.get("toAddr") == null ? "待分配" : r.get("toAddr"));
    row.put("temp", ost == null ? List.of() : tempSeriesOf(r.get("orderId"), status.equals("alert"), batchId));
    row.put("points", ost == null ? List.of() : points(r, status, start, batchId));
    if (r.get("signAt") != null) {
      row.put("signAt", r.get("signAt"));
      row.put("signBy", r.get("signBy"));
    }
    return row;
  }

  private List<Map<String, Object>> tempSeriesOf(Object orderId, boolean alert, long batchId) {
    if (orderId != null) {
      List<Map<String, Object>> tracks = jdbc.queryForList("""
          SELECT DATE_FORMAT(happen_time, '%H:%i') AS time, temp FROM logistics_track
          WHERE order_id = ? AND temp IS NOT NULL ORDER BY happen_time
          """, orderId);
      if (!tracks.isEmpty()) return tracks;
    }
    return tempSeries(batchId, alert);
  }

  private List<Map<String, Object>> tempSeries(long id, boolean alert) {
    List<Map<String, Object>> list = new ArrayList<>();
    LocalDateTime base = LocalDateTime.now().withHour(6).withMinute(40).withSecond(0).withNano(0);
    for (int i = 0; i < 12; i++) {
      double value = 4.1 + Math.sin(i * 0.7 + id) * 0.8 + (id % 3) * 0.15;
      if (alert && i == 6) value = 9.1;
      list.add(Common.map("time", base.plusMinutes(30L * i).format(MIN),
          "value", Math.round(value * 10) / 10.0));
    }
    return list;
  }

  private List<Map<String, Object>> points(Map<String, Object> r, String status, String start, long batchId) {
    List<Map<String, Object>> tracks = jdbc.queryForList("""
        SELECT DATE_FORMAT(happen_time, '%Y-%m-%d %H:%i') AS time, region AS place,
               temp, hot
        FROM logistics_track WHERE order_id = ? ORDER BY happen_time
        """, r.get("orderId"));
    List<Map<String, Object>> pts = new ArrayList<>();
    for (int i = 0; i < tracks.size(); i++) {
      Map<String, Object> t = tracks.get(i);
      String label = Common.num(t.get("hot")) == 1 ? "温度异常"
          : i == 0 ? "装车发运" : "途中巡检";
      pts.add(Common.map("time", t.get("time"), "place", t.get("place"), "status", label, "temp", t.get("temp")));
    }
    if ("delivered".equals(status) && r.get("signAt") != null) {
      pts.add(Common.map("time", r.get("signAt"), "place", r.get("toAddr"), "status", "签收完成", "temp", 5.6));
    }
    return pts;
  }

  @Transactional
  public Map<String, Object> create(Map<String, Object> body) {
    long batchId = Common.num(body.get("batchId"));
    List<Map<String, Object>> found = jdbc.queryForList("""
        SELECT b.id, b.batch_no AS batchNo, b.status AS status, f.name AS farmName, p.plot_no AS plotNo
        FROM batch b JOIN farm f ON f.id = b.farm_id JOIN plot p ON p.id = b.plot_id
        WHERE b.id = ?
        """, batchId);
    if (found.isEmpty()) throw new ApiException("批次不存在");
    Map<String, Object> batch = found.get(0);
    if ("BLOCKED".equals(String.valueOf(batch.get("status"))))
      throw new ApiException("批次处于预警锁定状态，请先解除预警");
    Integer existing = jdbc.queryForObject(
        "SELECT COUNT(*) FROM logistics_order WHERE FIND_IN_SET(?, batch_ids)", Integer.class, batchId);
    if (existing != null && existing > 0) throw new ApiException("该批次已有运输单");
    String carrier = Common.str(body.get("carrier"));
    String plate = Common.str(body.get("plateNo"));
    String dealer = Common.str(body.get("dealer"));
    int qty = Common.num(body.get("qty"));
    if (carrier == null || carrier.isBlank()) throw new ApiException("请填写承运商");
    if (plate == null || plate.isBlank()) throw new ApiException("请填写车牌号");
    if (dealer == null || dealer.isBlank()) throw new ApiException("请填写经销商");
    String now = LocalDateTime.now().format(DT);
    String shipNo = "SH" + now.replaceAll("\\D", "").substring(0, 12) + String.format("%03d", batchId);
    jdbc.update("""
        INSERT INTO logistics_order (ship_no, batch_ids, carrier, plate_no, driver, phone, from_addr, to_addr,
                                     start_time, eta_time, min_temp, max_temp, status)
        VALUES (?, ?, ?, ?, '王强', '13800008888', ?, ?, ?, DATE_ADD(?, INTERVAL 6 HOUR), 2.0, 8.0, 2)
        """, shipNo, String.valueOf(batchId), carrier, plate, batch.get("farmName"), dealer, now, now);
    Long orderId = jdbc.queryForObject("SELECT id FROM logistics_order WHERE ship_no = ?", Long.class, shipNo);
    jdbc.update("""
        INSERT INTO logistics_track (order_id, lng, lat, region, temp, happen_time, hot)
        VALUES (?, 117.4700, 31.8800, ?, 4.2, ?, 0)
        """, orderId, batch.get("farmName"), now);
    jdbc.update("""
        INSERT INTO sale_record (batch_id, dealer, dealer_no, qty, unit, price, sale_time)
        VALUES (?, ?, 'NJ-ZC-LOCAL', ?, '千克', 168.00, ?)
        """, batchId, dealer, qty, now);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (2, '物流', '创建运输单', ?, '127.0.0.1')",
        batch.get("batchNo") + " · " + carrier);
    states.refresh(batchId);
    return rowOfBatch(batchId);
  }

  @Transactional
  public Map<String, Object> sign(long batchId, String by) {
    long id = batchId;
    List<Map<String, Object>> orders = jdbc.queryForList("""
        SELECT id, status, to_addr AS toAddr, batch_ids FROM logistics_order
        WHERE FIND_IN_SET(?, batch_ids) ORDER BY id DESC LIMIT 1
        """, id);
    if (orders.isEmpty()) throw new ApiException("运单不存在", 404);
    Map<String, Object> order = orders.get(0);
    if (Common.num(order.get("status")) == 3) throw new ApiException("运单已签收");
    String now = LocalDateTime.now().format(DT);
    jdbc.update("UPDATE logistics_order SET status = 3, sign_time = ?, signer = ? WHERE id = ?",
        now, by == null || by.isBlank() ? "经销商" : by, order.get("id"));
    jdbc.update("""
        INSERT INTO logistics_track (order_id, lng, lat, region, temp, happen_time, hot)
        VALUES (?, 118.8200, 32.0200, ?, 5.6, ?, 0)
        """, order.get("id"), order.get("toAddr"), now);
    Map<String, Object> batch = jdbc.queryForMap("SELECT batch_no AS batchNo FROM batch WHERE id = ?", id);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (2, '物流', '运单签收', ?, '127.0.0.1')",
        batch.get("batchNo"));
    states.refresh(id);
    return rowOfBatch(id);
  }

  private Map<String, Object> rowOfBatch(long batchId) {
    for (Map<String, Object> r : all(null)) if (Common.num(r.get("batchId")) == batchId) return r;
    throw new ApiException("运单不存在", 404);
  }
}
