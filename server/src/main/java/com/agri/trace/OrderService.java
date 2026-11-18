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
public class OrderService {
  private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private final JdbcTemplate jdbc;
  private final BatchStateService states;

  public OrderService(JdbcTemplate jdbc, BatchStateService states) {
    this.jdbc = jdbc;
    this.states = states;
  }

  public List<Map<String, Object>> customers(String kw) {
    String k = kw == null ? "" : kw.trim().toLowerCase();
    return jdbc.queryForList("""
        SELECT c.id, c.name, c.type, c.contact, c.phone, c.address, c.note,
               COUNT(o.id) AS orderCount,
               COALESCE(SUM(o.amount), 0) AS totalAmount
        FROM customer c LEFT JOIN sales_order o ON o.customer_id = c.id
        GROUP BY c.id, c.name, c.type, c.contact, c.phone, c.address, c.note
        ORDER BY c.id
        """).stream().filter(r -> k.isEmpty()
        || (Common.str(r.get("name")) + Common.str(r.get("contact"))).toLowerCase().contains(k)).toList();
  }

  @Transactional
  public Map<String, Object> createCustomer(Map<String, Object> body) {
    String name = Common.str(body.get("name"));
    if (name == null || name.isBlank()) throw new ApiException("客户名称必填");
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO customer (name, type, contact, phone, address, note) VALUES (?, ?, ?, ?, ?, ?)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, name);
      ps.setString(2, Common.str(body.getOrDefault("type", "经销商")));
      ps.setString(3, Common.str(body.get("contact")));
      ps.setString(4, Common.str(body.get("phone")));
      ps.setString(5, Common.str(body.get("address")));
      ps.setString(6, Common.str(body.get("note")));
      return ps;
    }, key);
    long id = key.getKey().longValue();
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '销售', '新增客户', ?, '127.0.0.1')", name);
    return jdbc.queryForMap("SELECT id, name, type, contact, phone, address, note FROM customer WHERE id = ?", id);
  }

  public Map<String, Object> orders(String status, String kw, Long farmId, Integer page, Integer size) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT o.id, o.order_no AS orderNo, o.qty_kg AS qtyKg, o.price, o.amount, o.status,
               DATE_FORMAT(o.order_time, '%Y-%m-%d %H:%i') AS orderTime,
               DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS deliveryDate, o.note,
               c.id AS customerId, c.name AS customerName, c.phone AS customerPhone,
               b.id AS batchId, b.batch_no AS batchNo, p.plot_no AS plotNo, f.name AS farmName,
               cr.name AS cropName,
               lo.ship_no AS shipNo, lo.status AS shipStatus,
               COALESCE((SELECT SUM(sr.qty_kg) FROM sales_return sr WHERE sr.order_id = o.id), 0) AS returnQty
        FROM sales_order o
        JOIN customer c ON c.id = o.customer_id
        JOIN batch b ON b.id = o.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id
        JOIN crop cr ON cr.id = b.crop_id
        LEFT JOIN logistics_order lo ON lo.id = (
          SELECT MAX(lo2.id) FROM logistics_order lo2 WHERE FIND_IN_SET(o.batch_id, lo2.batch_ids))
        WHERE (? = 0 OR f.id = ?) AND (? = '' OR o.status = ?)
        ORDER BY o.order_time DESC, o.id DESC
        """, fid, fid, status == null ? "" : status, status == null ? "" : status);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> filtered = rows.stream().filter(r -> k.isEmpty()
        || (Common.str(r.get("orderNo")) + Common.str(r.get("customerName")) + Common.str(r.get("batchNo")))
        .toLowerCase().contains(k)).toList();
    int total = filtered.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? filtered : filtered.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    for (String st : List.of("PENDING", "CONFIRMED", "SHIPPED", "SETTLED", "RETURNED")) {
      out.put(st.toLowerCase(), rows.stream().filter(r -> st.equals(r.get("status"))).count());
    }
    out.put("amount", Math.round(rows.stream().mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("amount")))).sum()));
    out.put("qtyKg", Math.round(rows.stream().mapToDouble(r -> Double.parseDouble(String.valueOf(r.get("qtyKg")))).sum()));
    return out;
  }

  @Transactional
  public Map<String, Object> createOrder(Map<String, Object> body) {
    long customerId = Common.num(body.get("customerId"));
    long batchId = Common.num(body.get("batchId"));
    double qty = Double.parseDouble(String.valueOf(body.getOrDefault("qtyKg", 0)));
    double price = Double.parseDouble(String.valueOf(body.getOrDefault("price", 0)));
    if (qty <= 0 || price <= 0) throw new ApiException("数量和单价必须大于 0");
    if (jdbc.queryForObject("SELECT COUNT(*) FROM customer WHERE id = ?", Integer.class, customerId) == 0)
      throw new ApiException("客户不存在");
    List<Map<String, Object>> batch = jdbc.queryForList("SELECT id, batch_no FROM batch WHERE id = ?", batchId);
    if (batch.isEmpty()) throw new ApiException("批次不存在");
    ensureSellable(batchId);
    String now = LocalDateTime.now().format(DT);
    String no = "SO" + now.replaceAll("\\D", "").substring(0, 14) + String.format("%03d", batchId);
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO sales_order (order_no, customer_id, batch_id, qty_kg, price, amount, status,
                                   order_time, delivery_date, note)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, no);
      ps.setLong(2, customerId);
      ps.setLong(3, batchId);
      ps.setDouble(4, qty);
      ps.setDouble(5, price);
      ps.setDouble(6, qty * price);
      ps.setString(7, now);
      String delivery = Common.str(body.get("deliveryDate"));
      ps.setString(8, delivery == null || delivery.isBlank() ? null : delivery);
      ps.setString(9, Common.str(body.get("note")));
      return ps;
    }, key);
    long id = key.getKey().longValue();
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '销售', '创建订单', ?, '127.0.0.1')",
        no + " · " + batch.get(0).get("batch_no"));
    return detail(id);
  }

  @Transactional
  public Map<String, Object> move(long id, String action, Map<String, Object> body) {
    Map<String, Object> order = jdbc.queryForMap(
        "SELECT batch_id AS batchId, status, qty_kg AS qty, price FROM sales_order WHERE id = ?", id);
    long batchId = Common.num(order.get("batchId"));
    String st = Common.str(order.get("status"));
    String target;
    switch (action) {
      case "confirm" -> {
        if (!"PENDING".equals(st)) throw new ApiException("只有待确认订单可以确认");
        ensureSellable(batchId);
        target = "CONFIRMED";
      }
      case "ship" -> {
        if (!"CONFIRMED".equals(st)) throw new ApiException("只有已确认订单可以发货");
        ensureSellable(batchId);
        Integer shipCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM logistics_order WHERE FIND_IN_SET(?, batch_ids)", Integer.class, batchId);
        if (shipCount == null || shipCount == 0)
          throw new ApiException("该批次尚未创建运输单，请先到「物流发运」创建");
        target = "SHIPPED";
      }
      case "settle" -> {
        if (!"SHIPPED".equals(st)) throw new ApiException("只有已发货订单可以结算");
        target = "SETTLED";
      }
      case "return" -> {
        if (!List.of("CONFIRMED", "SHIPPED", "SETTLED").contains(st)) throw new ApiException("当前状态不能退货");
        double qty = body != null && body.get("qtyKg") != null
            ? Double.parseDouble(String.valueOf(body.get("qtyKg")))
            : Double.parseDouble(String.valueOf(order.get("qty")));
        if (qty <= 0) throw new ApiException("退货数量必须大于 0");
        double price = Double.parseDouble(String.valueOf(order.get("price")));
        jdbc.update("INSERT INTO sales_return (order_id, qty_kg, amount, reason) VALUES (?, ?, ?, ?)",
            id, qty, qty * price, body == null ? null : Common.str(body.get("reason")));
        target = "RETURNED";
      }
      default -> throw new ApiException("不支持的订单操作");
    }
    jdbc.update("UPDATE sales_order SET status = ? WHERE id = ?", target, id);
    if ("ship".equals(action)) states.refresh(batchId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '销售', ?, ?, '127.0.0.1')",
        switch (action) {
          case "confirm" -> "确认订单";
          case "ship" -> "订单发货";
          case "settle" -> "订单结算";
          default -> "订单退货";
        }, "order#" + id);
    return detail(id);
  }

  private void ensureSellable(long batchId) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT b.status, p.status AS plotStatus FROM batch b JOIN plot p ON p.id = b.plot_id WHERE b.id = ?
        """, batchId);
    if (rows.isEmpty()) throw new ApiException("批次不存在");
    Integer blocking = jdbc.queryForObject("""
        SELECT COUNT(*) FROM alert WHERE type = 'QUALITY_FAIL' AND status IN (0, 1) AND target_id = ?
        """, Integer.class, batchId);
    if ("BLOCKED".equals(String.valueOf(rows.get(0).get("status")))
        || Common.num(rows.get(0).get("plotStatus")) == 4 || (blocking != null && blocking > 0)) {
      throw new ApiException("批次处于预警锁定状态，暂不能下单或发货");
    }
  }

  private Map<String, Object> detail(long id) {
    return jdbc.queryForMap("""
        SELECT o.id, o.order_no AS orderNo, o.qty_kg AS qtyKg, o.price, o.amount, o.status,
               DATE_FORMAT(o.order_time, '%Y-%m-%d %H:%i') AS orderTime,
               DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS deliveryDate, o.note,
               c.name AS customerName, b.batch_no AS batchNo,
               lo.ship_no AS shipNo, lo.status AS shipStatus,
               COALESCE((SELECT SUM(sr.qty_kg) FROM sales_return sr WHERE sr.order_id = o.id), 0) AS returnQty
        FROM sales_order o JOIN customer c ON c.id = o.customer_id JOIN batch b ON b.id = o.batch_id
        LEFT JOIN logistics_order lo ON lo.id = (
          SELECT MAX(lo2.id) FROM logistics_order lo2 WHERE FIND_IN_SET(o.batch_id, lo2.batch_ids))
        WHERE o.id = ?
        """, id);
  }
}
