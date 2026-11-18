package com.agri.trace;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PlotService {
  private final JdbcTemplate jdbc;
  private final BatchService batches;
  private final ObjectMapper json = new ObjectMapper();

  public PlotService(JdbcTemplate jdbc, BatchService batches) {
    this.jdbc = jdbc;
    this.batches = batches;
  }

  private static final String BASE_SELECT = """
      SELECT p.id, p.farm_id AS farmId, p.plot_no AS plotNo, p.name, c.name AS cropName, c.variety, p.status,
             p.area_mu AS areaMu, u.real_name AS manager, b.batch_no AS batchNo, f.name AS farmName,
             p.center_lng AS centerLng, p.center_lat AS centerLat, p.polygon_json AS polygonJson,
             p.crop_id AS cropId, p.soil_type AS soilType,
             DATE_FORMAT(b.sow_date, '%Y-%m-%d') AS plantDate,
             CASE WHEN b.sow_date IS NULL THEN 0 ELSE DATEDIFF(?, b.sow_date) END AS growthDays,
             CASE WHEN p.status = 3 THEN 0
                  WHEN b.sow_date IS NULL THEN 0
                  ELSE LEAST(1, GREATEST(0, DATEDIFF(?, b.sow_date) / c.cycle_days)) END AS progress,
             c.yield_per_mu AS yieldPerMu
      FROM plot p
      LEFT JOIN crop c ON c.id = p.crop_id
      LEFT JOIN batch b ON b.id = p.current_batch_id
      LEFT JOIN farm f ON f.id = p.farm_id
      LEFT JOIN sys_user u ON u.id = p.manager_id
      """;

  public List<Map<String, Object>> overview(Long farmId) {
    String sql = BASE_SELECT + (farmId == null ? "" : " WHERE p.farm_id = ?") + " ORDER BY p.id";
    List<Map<String, Object>> rows = farmId == null
        ? jdbc.queryForList(sql, Common.today(), Common.today())
        : jdbc.queryForList(sql, Common.today(), Common.today(), farmId);
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : rows) out.add(toOverview(r));
    return out;
  }

  private Map<String, Object> toOverview(Map<String, Object> row) {
    Map<String, Object> m = new LinkedHashMap<>(row);
    m.remove("polygonJson");
    m.remove("cropId");
    m.remove("soilType");
    m.remove("plantDate");
    m.remove("growthDays");
    m.remove("yieldPerMu");
    Object poly = null;
    try {
      Object coords = json.readValue(String.valueOf(row.get("polygonJson")), Object.class);
      poly = Common.map("type", "Polygon", "coordinates", coords);
    } catch (Exception ignored) {
    }
    m.put("polygon", poly);
    return m;
  }

  public Map<String, Object> page(Integer page, Integer size, Integer status, String crop, String kw, Long farmId) {
    List<Map<String, Object>> rows = jdbc.queryForList(BASE_SELECT + " ORDER BY p.id", Common.today(), Common.today());
    List<Map<String, Object>> filtered = new ArrayList<>();
    String k = kw == null ? "" : kw.trim().toLowerCase();
    for (Map<String, Object> r : rows) {
      if (farmId != null && Common.num(r.get("farmId")) != farmId) continue;
      int st = Common.num(r.get("status"));
      String cropName = Common.str(r.get("cropName"));
      String plotNo = Common.str(r.get("plotNo"));
      String name = Common.str(r.get("name"));
      if (status != null && st != status) continue;
      if (crop != null && !crop.isBlank() && !crop.equals(cropName)) continue;
      if (!k.isEmpty()
          && !plotNo.toLowerCase().contains(k)
          && !name.contains(kw)
          && !cropName.contains(kw)) continue;
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("id", r.get("id"));
      item.put("plotNo", plotNo);
      item.put("name", name);
      item.put("cropName", cropName);
      item.put("variety", r.get("variety"));
      item.put("areaMu", r.get("areaMu"));
      item.put("status", st);
      item.put("batchNo", r.get("batchNo"));
      item.put("manager", r.get("manager"));
      Object last = jdbc.queryForObject("""
          SELECT DATE_FORMAT(MAX(happen_time), '%Y-%m-%d %H:%i')
          FROM production_record WHERE batch_id = (SELECT current_batch_id FROM plot WHERE id = ?)
          """, String.class, r.get("id"));
      item.put("lastRecordAt", last);
      filtered.add(item);
    }
    int p = page == null || page < 1 ? 1 : page;
    int s = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(filtered.size(), (p - 1) * s);
    int to = Math.min(filtered.size(), from + s);
    Map<String, Object> counts = statusCounts(farmId);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", filtered.subList(from, to));
    out.put("total", filtered.size());
    out.put("growing", counts.get("growing"));
    out.put("alerted", counts.get("alert"));
    out.put("counts", counts);
    return out;
  }

  private Map<String, Object> statusCounts(Long farmId) {
    Map<String, Object> c = new LinkedHashMap<>();
    String sql = """
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status = 1), 0) AS growing,
               COALESCE(SUM(status = 2), 0) AS harvest,
               COALESCE(SUM(status = 3), 0) AS fallow,
               COALESCE(SUM(status = 4), 0) AS alert
        FROM plot
        """ + (farmId == null ? "" : " WHERE farm_id = ?");
    List<Map<String, Object>> r = farmId == null ? jdbc.queryForList(sql) : jdbc.queryForList(sql, farmId);
    Map<String, Object> row = r.get(0);
    c.put("all", row.get("total"));
    c.put("growing", row.get("growing"));
    c.put("harvest", row.get("harvest"));
    c.put("fallow", row.get("fallow"));
    c.put("alert", row.get("alert"));
    return c;
  }

  public Map<String, Object> detail(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList(BASE_SELECT + " WHERE p.id = ?", Common.today(), Common.today(), id);
    if (rows.isEmpty()) throw new ApiException("地块不存在", 404);
    Map<String, Object> r = rows.get(0);
    Map<String, Object> m = toOverview(r);
    m.put("soilType", r.get("soilType"));
    m.put("plantDate", r.get("plantDate"));
    m.put("growthDays", r.get("growthDays"));
    m.put("progress", r.get("progress"));
    double area = Double.parseDouble(String.valueOf(r.get("areaMu")));
    double ypm = Double.parseDouble(String.valueOf(r.get("yieldPerMu") == null ? 0 : r.get("yieldPerMu")));
    m.put("expectYieldKg", Math.round(area * ypm));
    List<Map<String, Object>> records = jdbc.queryForList("""
        SELECT pr.id, pr.type, DATE_FORMAT(pr.happen_time, '%Y-%m-%d %H:%i') AS happenTime,
               pr.remark AS detail, u.real_name AS operator
        FROM production_record pr LEFT JOIN sys_user u ON u.id = pr.operator_id
        WHERE pr.batch_id = (SELECT current_batch_id FROM plot WHERE id = ?)
        ORDER BY pr.happen_time DESC
        """, id);
    m.put("records", records);
    return m;
  }

  public Map<String, Object> batchOfPlot(long plotId) {
    List<Map<String, Object>> rows = jdbc.queryForList(
        "SELECT current_batch_id AS bid FROM plot WHERE id = ?", plotId);
    if (rows.isEmpty()) throw new ApiException("地块不存在", 404);
    Object bid = rows.get(0).get("bid");
    if (bid == null) return null;
    return batches.summary(Common.num(bid));
  }

  /* ------------------------------ 概览 ------------------------------ */

  public Map<String, Object> dashboard(Long farmId) {
    long fid = farmId == null ? 0 : farmId;
    Map<String, Object> counts = statusCounts(farmId);
    double area = Double.parseDouble(String.valueOf(jdbc.queryForObject(
        "SELECT COALESCE(SUM(area_mu), 0) FROM plot WHERE (? = 0 OR farm_id = ?)", Object.class, fid, fid)));
    int plotCount = Common.num(counts.get("all"));
    int pendingHarvest = jdbc.queryForObject("""
        SELECT COUNT(*) FROM batch b JOIN plot p ON p.id = b.plot_id
        WHERE b.status = 'PENDING_HARVEST' AND (? = 0 OR p.farm_id = ?)
        """, Integer.class, fid, fid);
    int activeBatches = jdbc.queryForObject("""
        SELECT COUNT(*) FROM batch b JOIN plot p ON p.id = b.plot_id
        WHERE b.status <> 'SHIPPED' AND (? = 0 OR p.farm_id = ?)
        """, Integer.class, fid, fid);

    Map<String, Object> pass = jdbc.queryForMap("""
        SELECT COUNT(*) AS done, COALESCE(SUM(qi.result = 1), 0) AS passed
        FROM quality_inspect qi
        JOIN batch b ON b.id = qi.batch_id
        JOIN plot p ON p.id = b.plot_id
        WHERE qi.inspect_date <= ? AND qi.inspect_date >= DATE_SUB(?, INTERVAL 30 DAY)
          AND (? = 0 OR p.farm_id = ?)
        """, Common.today(), Common.today(), fid, fid);
    int done = Common.num(pass.get("done"));
    int passed = Common.num(pass.get("passed"));
    double passRate = done == 0 ? 100 : Math.round(passed * 1000.0 / done) / 10.0;

    Integer todayScan = jdbc.queryForObject("""
        SELECT COUNT(*) FROM scan_log sl
        JOIN trace_code tc ON tc.code = sl.code
        JOIN batch b ON b.id = tc.batch_id
        JOIN plot p ON p.id = b.plot_id
        WHERE DATE(sl.scan_time) = ? AND (? = 0 OR p.farm_id = ?)
        """, Integer.class, Common.today(), fid, fid);

    List<Map<String, Object>> alertPlots = jdbc.queryForList("""
        SELECT p.plot_no AS plotNo, p.name, a.message, a.level,
               DATE_FORMAT(a.create_time, '%H:%i') AS time, a.id AS alertId
        FROM alert a
        JOIN batch b ON b.id = a.target_id
        JOIN plot p ON p.id = b.plot_id
        WHERE a.status IN (0, 1) AND (? = 0 OR p.farm_id = ?)
        ORDER BY a.level DESC, a.id DESC LIMIT 2
        """, fid, fid);
    List<Map<String, Object>> harvestPlots = jdbc.queryForList("""
        SELECT p.plot_no AS plotNo, p.area_mu AS areaMu, c.name AS cropName, c.yield_per_mu AS yieldPerMu,
               b.id AS batchId
        FROM plot p
        JOIN crop c ON c.id = p.crop_id
        JOIN batch b ON b.id = p.current_batch_id
        WHERE p.status = 2 AND (? = 0 OR p.farm_id = ?) ORDER BY p.id LIMIT 2
        """, fid, fid);

    List<Map<String, Object>> todos = new ArrayList<>();
    for (int i = 0; i < alertPlots.size(); i++) {
      Map<String, Object> p = alertPlots.get(i);
      int lv = Common.num(p.get("level"));
      todos.add(Common.map("id", 100 + i, "level", lv >= 3 ? "alert" : lv == 2 ? "warn" : "info",
          "time", p.get("time"),
          "title", p.get("plotNo") + " " + p.get("name") + " 异常预警",
          "desc", p.get("message"), "to", "/alerts"));
    }
    List<Map<String, Object>> coldAlerts = jdbc.queryForList("""
        SELECT lo.ship_no AS shipNo, lo.carrier, lo.plate_no AS plateNo,
               DATE_FORMAT(lo.start_time, '%H:%i') AS time
        FROM logistics_order lo
        WHERE lo.status = 4 AND (? = 0 OR EXISTS (
          SELECT 1 FROM batch b JOIN plot p ON p.id = b.plot_id
          WHERE FIND_IN_SET(b.id, lo.batch_ids) AND p.farm_id = ?
        ))
        ORDER BY lo.id DESC LIMIT 1
        """, fid, fid);
    for (Map<String, Object> c : coldAlerts) {
      todos.add(Common.map("id", 2, "level", "warn", "time", c.get("time") == null ? "09:12" : c.get("time"),
          "title", "冷链温度超限 · " + c.get("shipNo"),
          "desc", c.get("carrier") + " " + c.get("plateNo") + " 温控超限，请复核后签收",
          "to", "/ship"));
    }
    String[] harvestTimes = {"10:40", "11:15"};
    for (int i = 0; i < harvestPlots.size(); i++) {
      Map<String, Object> p = harvestPlots.get(i);
      double a = Double.parseDouble(String.valueOf(p.get("areaMu")));
      double y = Double.parseDouble(String.valueOf(p.get("yieldPerMu")));
      todos.add(Common.map("id", 200 + i, "level", "info", "time", harvestTimes[i],
          "title", p.get("plotNo") + " " + p.get("cropName") + " 已到采收期",
          "desc", "预计产量 " + String.format("%,d", Math.round(a * y)) + " kg，待开检测单",
          "to", "/batch/" + p.get("batchId")));
    }
    while (todos.size() > 6) todos.remove(todos.size() - 1);

    List<Map<String, Object>> cats = jdbc.queryForList("""
        SELECT c.name, SUM(p.area_mu) AS area FROM plot p JOIN crop c ON c.id = p.crop_id
        WHERE (? = 0 OR p.farm_id = ?)
        GROUP BY c.name ORDER BY area DESC
        """, fid, fid);
    double sum = cats.stream().mapToDouble(x -> Double.parseDouble(String.valueOf(x.get("area")))).sum();
    double todayHarvest = Double.parseDouble(String.valueOf(jdbc.queryForObject("""
        SELECT COALESCE(SUM(pr.quantity_kg), 0) FROM production_record pr
        JOIN batch b ON b.id = pr.batch_id JOIN plot p ON p.id = b.plot_id
        WHERE DATE(pr.happen_time) = ? AND pr.type IN ('采收', '测产') AND (? = 0 OR p.farm_id = ?)
        """, Object.class, Common.today(), fid, fid)));
    List<Map<String, Object>> trendRows = jdbc.queryForList("""
        SELECT DATE_FORMAT(pr.happen_time, '%Y-%m') AS m, COALESCE(SUM(pr.quantity_kg), 0) AS v
        FROM production_record pr JOIN batch b ON b.id = pr.batch_id JOIN plot p ON p.id = b.plot_id
        WHERE pr.type IN ('采收', '测产') AND pr.happen_time >= DATE_SUB(?, INTERVAL 11 MONTH)
          AND (? = 0 OR p.farm_id = ?)
        GROUP BY m ORDER BY m
        """, Common.today(), fid, fid);
    Map<String, Integer> trendMap = new LinkedHashMap<>();
    for (Map<String, Object> tr : trendRows) trendMap.put(String.valueOf(tr.get("m")), Common.num(tr.get("v")));
    List<String> trendLabels = new ArrayList<>();
    List<Integer> trendData = new ArrayList<>();
    YearMonth nowYm = YearMonth.now();
    for (int k = 11; k >= 0; k--) {
      YearMonth ym = nowYm.minusMonths(k);
      trendLabels.add(String.format("%02d", ym.getMonthValue()));
      trendData.add(trendMap.getOrDefault(ym.toString(), 0));
    }
    List<Map<String, Object>> category = new ArrayList<>();
    for (Map<String, Object> c : cats) {
      category.add(Common.map("name", c.get("name"),
          "pct", Math.round(Double.parseDouble(String.valueOf(c.get("area"))) / sum * 100)));
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("areaMu", Math.round(area * 10) / 10.0);
    out.put("pendingHarvest", pendingHarvest);
    out.put("todayHarvest", Math.round(todayHarvest));
    out.put("passRate", passRate);
    out.put("todayScan", todayScan);
    out.put("farmCount", farmId == null ? 3 : 1);
    out.put("plotCount", plotCount);
    out.put("activeBatches", activeBatches);
    out.put("todos", todos);
    out.put("trend", Common.map("labels", trendLabels, "data", trendData));
    out.put("category", category);
    return out;
  }
}
