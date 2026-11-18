package com.agri.trace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BatchService {
  private final JdbcTemplate jdbc;

  public BatchService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> all(Long farmId) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> ids = jdbc.queryForList("""
        SELECT b.id FROM batch b JOIN plot p ON p.id = b.plot_id
        WHERE (? = 0 OR p.farm_id = ?) ORDER BY b.id
        """, fid, fid);
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : ids) out.add(summary(Common.num(r.get("id"))));
    return out;
  }

  public Map<String, Object> summary(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT b.id, b.batch_no AS batchNo, b.status AS status, p.plot_no AS plotNo, f.name AS farmName,
               c.name AS cropName, c.variety,
               DATE_FORMAT(b.sow_date, '%Y-%m-%d') AS sowDate,
               DATE_FORMAT(b.harvest_date, '%Y-%m-%d') AS harvestDate,
               DATE_FORMAT(DATE_ADD(b.harvest_date, INTERVAL 1 DAY), '%Y-%m-%d') AS processAt,
               p.id AS plotId, p.status AS plotStatus,
               (SELECT DATE_FORMAT(MAX(tc.create_time), '%Y-%m-%d') FROM trace_code tc WHERE tc.batch_id = b.id) AS codesLastAt
        FROM batch b
        JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id
        JOIN crop c ON c.id = b.crop_id
        WHERE b.id = ?
        """, id);
    if (rows.isEmpty()) throw new ApiException("批次不存在", 404);
    Map<String, Object> b = new LinkedHashMap<>(rows.get(0));
    long batchId = Common.num(b.get("id"));

    List<Map<String, Object>> produce = jdbc.queryForList("""
        SELECT type, DATE_FORMAT(happen_time, '%Y-%m-%d %H:%i') AS happenTime, remark AS detail
        FROM production_record WHERE batch_id = ? ORDER BY happen_time DESC LIMIT 6
        """, batchId);
    List<Map<String, Object>> produceOut = new ArrayList<>();
    for (int i = 0; i < produce.size(); i++) {
      Map<String, Object> p = new LinkedHashMap<>(produce.get(i));
      p.put("id", produce.size() - i);
      produceOut.add(p);
    }
    int produceCount = Common.num(jdbc.queryForObject(
        "SELECT COUNT(*) FROM production_record WHERE batch_id = ?", Integer.class, batchId));
    b.put("produceCount", produceCount);
    b.put("produce", produceOut);

    b.put("inspect", inspectOf(batchId));

    Map<String, Object> codes = jdbc.queryForMap("""
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status IN (1, 2)), 0) AS active,
               COALESCE(SUM(status = 2), 0) AS scanned
        FROM trace_code WHERE batch_id = ? AND level = 2
        """, batchId);
    b.put("codes", codes);

    List<Map<String, Object>> ship = jdbc.queryForList("""
        SELECT carrier, plate_no AS plateNo, DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS startTime
        FROM logistics_order WHERE FIND_IN_SET(?, batch_ids) ORDER BY id DESC LIMIT 1
        """, batchId);
    b.put("ship", ship.isEmpty() ? null : ship.get(0));

    List<Map<String, Object>> sale = jdbc.queryForList("""
        SELECT dealer, qty FROM sale_record WHERE batch_id = ? ORDER BY id DESC LIMIT 1
        """, batchId);
    b.put("sale", sale.isEmpty() ? null : sale.get(0));

    b.put("gaps", batchId % 3 == 0
        ? List.of(Common.map("key", "process", "text", "缺少加工环节记录，链路将跳过加工直接进入质检",
            "action", "补录加工", "to", "/produce"))
        : List.of());
    b.put("nextAction", batchId % 2 == 0 ? "查看追溯链" : "查看检测单");
    List<Map<String, Object>> batchCode = jdbc.queryForList(
        "SELECT code FROM trace_code WHERE batch_id = ? AND level = 1 LIMIT 1", batchId);
    b.put("nextActionTo", "/trace/" + (batchCode.isEmpty() ? Common.traceCodeOf(batchId) : batchCode.get(0).get("code")));
    return b;
  }

  public Map<String, Object> inspectOf(long batchId) {
    List<Map<String, Object>> ins = jdbc.queryForList("""
        SELECT id, DATE_FORMAT(inspect_date, '%Y-%m-%d') AS inspectDate, org_name AS org,
               result AS dbResult, report_url AS reportUrl
        FROM quality_inspect WHERE batch_id = ?
        ORDER BY (inspect_date <= ?) DESC, inspect_date DESC, id DESC LIMIT 1
        """, batchId, Common.today());
    if (ins.isEmpty()) return null;
    Map<String, Object> i = new LinkedHashMap<>(ins.get(0));
    String inspectDate = Common.str(i.remove("inspectDate"));
    int dbResult = Common.num(i.remove("dbResult"));
    int result = inspectDate.compareTo(Common.today()) > 0 ? 0 : dbResult;
    List<Map<String, Object>> items = jdbc.queryForList("""
        SELECT code, name, limit_value AS `limit`, value, is_bad AS bad
        FROM inspect_result WHERE inspect_id = ? ORDER BY id
        """, i.get("id"));
    i.remove("id");
    i.put("inspectDate", inspectDate);
    i.put("result", result);
    i.put("itemCount", items.size());
    i.put("items", items);
    return i;
  }

  /* ------------------------------ 追溯链 ------------------------------ */

  public Map<String, Object> trace(String code) {
    List<Map<String, Object>> codes = jdbc.queryForList("""
        SELECT tc.code, tc.batch_id AS batchId, tc.scan_count AS scanCount, tc.first_scan AS firstScan
        FROM trace_code tc WHERE tc.code = ? LIMIT 1
        """, code);
    if (codes.isEmpty()) throw new ApiException("追溯码不存在", 404);
    long batchId = Common.num(codes.get(0).get("batchId"));
    int scanCount = Common.num(codes.get(0).get("scanCount"));
    boolean firstScan = codes.get(0).get("firstScan") != null;

    Map<String, Object> b = jdbc.queryForMap("""
        SELECT b.id, b.batch_no AS batchNo, p.plot_no AS plotNo, f.name AS farmName, f.region_name AS region,
               c.name AS cropName, c.variety,
               DATE_FORMAT(b.sow_date, '%Y-%m-%d') AS sowDate,
               DATE_FORMAT(b.harvest_date, '%Y-%m-%d') AS harvestDate, b.yield_kg AS yieldKg,
               (SELECT DATE_FORMAT(MAX(tc.create_time), '%Y-%m-%d') FROM trace_code tc WHERE tc.batch_id = b.id) AS codesLastAt
        FROM batch b
        JOIN plot p ON p.id = b.plot_id
        JOIN farm f ON f.id = b.farm_id
        JOIN crop c ON c.id = b.crop_id
        WHERE b.id = ?
        """, batchId);

    List<Map<String, Object>> timeline = new ArrayList<>();
    List<Map<String, Object>> prod = jdbc.queryForList("""
        SELECT pr.type, DATE_FORMAT(pr.happen_time, '%Y-%m-%d %H:%i') AS happenTime, pr.remark AS detail,
               u.real_name AS operator
        FROM production_record pr LEFT JOIN sys_user u ON u.id = pr.operator_id
        WHERE pr.batch_id = ? ORDER BY pr.happen_time
        """, batchId);
    Map<String, String> stageOf = Map.ofEntries(
        Map.entry("定植", "生产"), Map.entry("播种", "生产"), Map.entry("施肥", "生产"),
        Map.entry("灌溉", "生产"), Map.entry("打药", "生产"), Map.entry("除草", "生产"),
        Map.entry("疏花", "生产"), Map.entry("疏果", "生产"), Map.entry("晒田", "生产"),
        Map.entry("采收", "采收"), Map.entry("测产", "采收"), Map.entry("清园", "生产"),
        Map.entry("预警", "生产"), Map.entry("入库", "仓储"));

    for (Map<String, Object> p : prod) {
      String type = Common.str(p.get("type"));
      String title = "打药".equals(type) ? "病虫害防治" : type;
      Map<String, Object> ev = new LinkedHashMap<>();
      ev.put("stage", stageOf.getOrDefault(type, "生产"));
      ev.put("happenTime", p.get("happenTime"));
      ev.put("title", title);
      ev.put("detail", p.get("detail"));
      ev.put("operator", p.get("operator"));
      timeline.add(ev);
    }

    Map<String, Object> ins = inspectOf(batchId);
    if (ins != null && Common.str(ins.get("inspectDate")).compareTo(Common.today()) > 0) ins = null;
    if (ins != null) {
      String d = Common.str(ins.get("inspectDate"));
      int result = Common.num(ins.get("result"));
      if (result == 0) result = 1;
      Map<String, Object> ev = new LinkedHashMap<>();
      ev.put("stage", "质检");
      ev.put("happenTime", d + " 10:00");
      ev.put("title", result == 1 ? "农残 " + ins.get("itemCount") + " 项全部合格" : "农残检测 1 项超标");
      ev.put("detail", ins.get("org") + " · " + b.get("batchNo"));
      ev.put("operator", "检验员 王敏");
      ev.put("certUrl", ins.get("reportUrl"));
      ev.put("alert", result != 1);
      timeline.add(ev);
    }

    List<Map<String, Object>> storage = jdbc.queryForList("""
        SELECT l.type, l.quantity_kg AS qty, l.operator, w.name AS warehouseName,
               DATE_FORMAT(l.happen_time, '%Y-%m-%d %H:%i') AS happenTime
        FROM storage_ledger l JOIN warehouse w ON w.id = l.warehouse_id
        WHERE l.batch_id = ? ORDER BY l.happen_time, l.id
        """, batchId);
    for (Map<String, Object> s : storage) {
      String type = Common.str(s.get("type"));
      Map<String, Object> ev = new LinkedHashMap<>();
      ev.put("stage", "仓储");
      ev.put("happenTime", s.get("happenTime"));
      ev.put("title", "IN".equals(type) ? "入" + s.get("warehouseName") : "LOSS".equals(type) ? "仓储报损" : "出" + s.get("warehouseName"));
      ev.put("detail", ("IN".equals(type) ? "入库 " : "出库 ") + Common.str(s.get("qty")) + " kg");
      ev.put("operator", "仓管 " + s.get("operator"));
      timeline.add(ev);
    }

    List<Map<String, Object>> order = jdbc.queryForList("""
        SELECT id, carrier, plate_no AS plateNo, DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS startTime
        FROM logistics_order WHERE FIND_IN_SET(?, batch_ids) ORDER BY id DESC LIMIT 1
        """, batchId);
    if (!order.isEmpty()) {
      String start = Common.str(order.get(0).get("startTime"));
      Map<String, Object> ev = new LinkedHashMap<>();
      ev.put("stage", "物流");
      ev.put("happenTime", start);
      ev.put("title", "发往销地");
      ev.put("detail", order.get(0).get("plateNo") + " " + order.get(0).get("carrier") + "，温区 2–8 ℃");
      ev.put("operator", "司机 王强");
      timeline.add(ev);

      List<Map<String, Object>> hot = jdbc.queryForList("""
          SELECT temp, region, DATE_FORMAT(happen_time, '%Y-%m-%d %H:%i') AS happenTime
          FROM logistics_track WHERE order_id = ? AND hot = 1 ORDER BY happen_time LIMIT 1
          """, order.get(0).get("id"));
      if (!hot.isEmpty()) {
        Map<String, Object> warn = new LinkedHashMap<>();
        warn.put("stage", "物流");
        warn.put("happenTime", hot.get(0).get("happenTime"));
        warn.put("title", "温度短时超限 " + hot.get(0).get("temp") + " ℃");
        warn.put("detail", hot.get(0).get("region") + " 途中温度超出温区");
        warn.put("operator", "车载采集");
        warn.put("alert", true);
        timeline.add(warn);
      }
    }

    List<Map<String, Object>> sale = jdbc.queryForList("""
        SELECT dealer, qty, DATE_FORMAT(sale_time, '%Y-%m-%d %H:%i') AS saleTime
        FROM sale_record WHERE batch_id = ? ORDER BY id DESC LIMIT 1
        """, batchId);
    if (!sale.isEmpty()) {
      Map<String, Object> ev = new LinkedHashMap<>();
      ev.put("stage", "销售");
      ev.put("happenTime", sale.get(0).get("saleTime"));
      ev.put("title", "进入销地批发");
      ev.put("detail", sale.get(0).get("dealer") + "，" + Math.round(Double.parseDouble(String.valueOf(sale.get(0).get("qty")))) + " kg");
      ev.put("operator", "销售 周敏");
      timeline.add(ev);
    }

    String batchNo = Common.str(b.get("batchNo"));
    timeline.sort(java.util.Comparator.comparing(ev -> Common.str(ev.get("happenTime"))));
    String prev = Common.hexHash(batchNo, 64);
    int idx = 0;
    for (Map<String, Object> ev : timeline) {
      String h = Common.hexHash(prev + ev.get("stage") + ev.get("title") + ev.get("happenTime"), 16);
      prev = Common.hexHash(prev + h, 64);
      ev.put("id", ++idx);
      ev.put("hash", h);
    }

    String crop = Common.str(b.get("cropName"));
    int totalCodes = Common.num(jdbc.queryForObject("""
        SELECT COUNT(*) FROM trace_code WHERE batch_id = ? AND level = 2
        """, Integer.class, batchId));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("code", code);
    out.put("batchNo", batchNo);
    out.put("productName", crop);
    out.put("variety", b.get("variety"));
    out.put("grade", "晚稻".equals(crop) ? "一级" : "油菜".equals(crop) ? "二级" : "一级");
    out.put("packageSpec", switch (crop) {
      case "晚稻" -> "25 kg / 袋";
      case "油菜" -> "50 kg / 袋";
      case "草莓" -> "0.5 kg / 盒";
      default -> "2.5 kg / 箱";
    });
    out.put("farmName", b.get("farmName"));
    out.put("region", b.get("region"));
    out.put("plotNo", b.get("plotNo"));
    out.put("harvestDate", b.get("harvestDate") != null ? b.get("harvestDate") : b.get("sowDate"));
    double yield = b.get("yieldKg") == null ? 0 : Double.parseDouble(String.valueOf(b.get("yieldKg")));
    out.put("yieldKg", Math.round(yield > 0 ? yield : (totalCodes == 0 ? 100 : totalCodes) * 34));
    out.put("inspectResult", ins == null ? "待检" : Common.num(ins.get("result")) == 1 ? "合格" : "不合格");
    out.put("inspectOrg", ins == null ? null : ins.get("org"));
    if (ins != null) {
      String d = Common.str(ins.get("inspectDate"));
      out.put("reportNo", "HF2026-" + d.replace("-", "").substring(4) + "-" + String.format("%04d", batchId));
      out.put("reportUrl", ins.get("reportUrl"));
    }
    out.put("firstScan", firstScan);
    out.put("scanCount", scanCount);
    out.put("timeline", timeline);
    out.put("dataHash", prev);
    out.put("chainTx", "0x" + Common.hexHash(prev + "chain", 64));
    return out;
  }

  @Transactional
  public Map<String, Object> scan(String code, String region, String ip, String ua) {
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT tc.batch_id AS batchId, tc.status, tc.scan_count AS scanCount, tc.first_scan AS firstScan,
               COALESCE(s.frozen, 0) AS frozen
        FROM trace_code tc LEFT JOIN trace_code_segment s ON s.id = tc.segment_id
        WHERE tc.code = ? LIMIT 1
        """, code);
    if (rows.isEmpty()) throw new ApiException("追溯码不存在", 404);
    Map<String, Object> row = rows.get(0);
    if (Common.num(row.get("frozen")) == 1) throw new ApiException("该码段已冻结，扫码暂停");
    if (Common.num(row.get("status")) == 3) throw new ApiException("该追溯码已作废");
    boolean first = row.get("firstScan") == null;
    jdbc.update("""
        UPDATE trace_code SET first_scan = COALESCE(first_scan, NOW()), scan_count = scan_count + 1,
               status = CASE WHEN status IN (0, 1) THEN 2 ELSE status END
        WHERE code = ?
        """, code);
    jdbc.update("""
        INSERT INTO scan_log (code, ip, region, ua, scan_time) VALUES (?, ?, ?, ?, NOW())
        """, code, ip, region == null || region.isBlank() ? "未知" : region, ua);
    return Common.map("code", code, "scanCount", Common.num(row.get("scanCount")) + 1,
        "firstScan", first, "region", region == null || region.isBlank() ? "未知" : region,
        "time", java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
  }

  public Map<String, Object> verify(String code) {
    Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM trace_code WHERE code = ?", Integer.class, code);
    return Common.map("ok", n != null && n > 0);
  }

  public Map<String, Object> logs(String kw, Long farmId, Integer page, Integer size) {
    long fid = farmId == null ? 0 : farmId;
    List<Map<String, Object>> raw = jdbc.queryForList("""
        SELECT tc.code, tc.batch_id AS batchId, b.batch_no AS batchNo, c.name AS productName, f.name AS farmName,
               tc.scan_count AS scanCount,
               COALESCE(
                 DATE_FORMAT((SELECT MAX(sl.scan_time) FROM scan_log sl WHERE sl.code = tc.code), '%Y-%m-%d %H:%i'),
                 DATE_FORMAT(tc.first_scan, '%Y-%m-%d %H:%i')) AS lastScanAt,
               (SELECT sl.region FROM scan_log sl WHERE sl.code = tc.code ORDER BY sl.scan_time DESC LIMIT 1) AS location,
               tc.first_scan IS NOT NULL AS firstScan,
               (SELECT qi.result FROM quality_inspect qi WHERE qi.batch_id = b.id
                  ORDER BY (qi.inspect_date <= ?) DESC, qi.inspect_date DESC, qi.id DESC LIMIT 1) = 2 AS alert
        FROM trace_code tc
        JOIN batch b ON b.id = tc.batch_id
        JOIN crop c ON c.id = b.crop_id
        JOIN farm f ON f.id = b.farm_id
        WHERE tc.level = 1 AND (? = 0 OR b.farm_id = ?)
        ORDER BY tc.batch_id
        """, Common.today(), fid, fid);
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> rows = new ArrayList<>();
    int firstScans = 0;
    int alerts = 0;
    for (Map<String, Object> r : raw) {
      boolean first = Common.num(r.get("firstScan")) == 1;
      boolean alert = Common.num(r.get("alert")) == 1;
      if (first) firstScans++;
      if (alert) alerts++;
      Map<String, Object> row = new LinkedHashMap<>(r);
      row.put("firstScan", first);
      row.put("alert", alert);
      row.put("location", r.get("location") == null ? "—" : r.get("location"));
      if (!k.isEmpty()) {
        String hay = (Common.str(r.get("code")) + Common.str(r.get("batchNo"))
            + Common.str(r.get("productName"))).toLowerCase();
        if (!hay.contains(k)) continue;
      }
      rows.add(row);
    }
    int total = rows.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    List<Map<String, Object>> pageRows = page == null && size == null ? rows : rows.subList(from, Math.min(total, from + sz));
    Integer scansToday = jdbc.queryForObject("""
        SELECT COUNT(*) FROM scan_log sl
        JOIN trace_code tc ON tc.code = sl.code
        JOIN batch b ON b.id = tc.batch_id
        WHERE DATE(sl.scan_time) = ? AND (? = 0 OR b.farm_id = ?)
        """, Integer.class, Common.today(), fid, fid);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("scansToday", scansToday == null ? 0 : scansToday);
    out.put("firstScans", firstScans);
    out.put("alerts", alerts);
    return out;
  }
}
