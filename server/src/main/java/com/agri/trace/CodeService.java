package com.agri.trace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CodeService {
  private final JdbcTemplate jdbc;
  private final BatchStateService states;

  public CodeService(JdbcTemplate jdbc, BatchStateService states) {
    this.jdbc = jdbc;
    this.states = states;
  }

  public Map<String, Object> page(String kw, String status, Long farmId, Integer page, Integer size) {
    List<Map<String, Object>> raw = jdbc.queryForList("""
        SELECT s.id, s.batch_id AS batchId, s.prefix, s.frozen AS frozen, b.batch_no AS batchNo, p.plot_no AS plotNo,
               c.name AS cropName, f.name AS farmName, f.id AS farmId,
               COUNT(tc.id) AS cnt,
               COALESCE(SUM(tc.status IN (1, 2)), 0) AS activated,
               COALESCE(SUM(tc.status = 2), 0) AS scanned,
               COALESCE(SUM(tc.status = 3), 0) AS voided,
               DATE_FORMAT(MIN(tc.create_time), '%Y-%m-%d %H:%i') AS createdAt,
               DATE_FORMAT(MAX(tc.first_scan), '%Y-%m-%d %H:%i') AS lastScanAt,
               DATE_FORMAT(s.update_time, '%Y-%m-%d %H:%i') AS updatedAt
        FROM trace_code_segment s
        JOIN batch b ON b.id = s.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id
        JOIN farm f ON f.id = b.farm_id
        LEFT JOIN trace_code tc ON tc.segment_id = s.id
        GROUP BY s.id, s.batch_id, s.prefix, s.frozen, b.batch_no, p.plot_no, c.name, f.name, s.update_time
        ORDER BY s.id
        """);
    if (farmId != null) {
      long fid = farmId;
      raw = raw.stream().filter(x -> Common.num(x.get("farmId")) == fid).toList();
    }
    String k = kw == null ? "" : kw.trim().toLowerCase();
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Map<String, Object> r : raw) {
      Map<String, Object> seg = toSegment(r);
      if (status != null && !status.isBlank() && !status.equals(seg.get("status"))) continue;
      if (!k.isEmpty()) {
        String hay = (Common.str(r.get("batchNo")) + Common.str(r.get("plotNo"))
            + Common.str(r.get("cropName")) + Common.str(r.get("prefix"))).toLowerCase();
        if (!hay.contains(k)) continue;
      }
      rows.add(seg);
    }
    int codes = 0, active = 0, scanned = 0, voided = 0;
    int activeCnt = 0, exhaustedCnt = 0, voidCnt = 0;
    for (Map<String, Object> r : raw) {
      Map<String, Object> seg = toSegment(r);
      codes += Common.num(seg.get("count"));
      active += Common.num(seg.get("activated"));
      scanned += Common.num(seg.get("scanned"));
      switch (String.valueOf(seg.get("status"))) {
        case "void" -> {
          voided += Common.num(seg.get("count"));
          voidCnt++;
        }
        case "exhausted" -> exhaustedCnt++;
        default -> activeCnt++;
      }
    }
    Map<String, Object> statusCounts = new LinkedHashMap<>();
    statusCounts.put("all", raw.size());
    statusCounts.put("active", activeCnt);
    statusCounts.put("exhausted", exhaustedCnt);
    statusCounts.put("void", voidCnt);
    int total = rows.size();
    int pg = page == null || page < 1 ? 1 : page;
    int sz = size == null || size < 1 ? 20 : Math.min(size, 200);
    int from = Math.min(total, (pg - 1) * sz);
    java.util.List<Map<String, Object>> pageRows = page == null && size == null ? rows : rows.subList(from, Math.min(total, from + sz));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("records", pageRows);
    out.put("total", total);
    out.put("codes", codes);
    out.put("active", active);
    out.put("scanned", scanned);
    out.put("voided", voided);
    out.put("statusCounts", statusCounts);
    return out;
  }

  private Map<String, Object> toSegment(Map<String, Object> r) {
    int count = Common.num(r.get("cnt"));
    int activated = Common.num(r.get("activated"));
    int scanned = Common.num(r.get("scanned"));
    int voidedCnt = Common.num(r.get("voided"));
    String status = count > 0 && voidedCnt >= count ? "void"
        : count > 0 && scanned >= count ? "exhausted" : "active";
    String prefix = Common.str(r.get("prefix"));
    Map<String, Object> seg = new LinkedHashMap<>();
    seg.put("id", r.get("id"));
    seg.put("batchId", r.get("batchId"));
    seg.put("batchNo", r.get("batchNo"));
    seg.put("plotNo", r.get("plotNo"));
    seg.put("cropName", r.get("cropName"));
    seg.put("farmName", r.get("farmName"));
    seg.put("prefix", prefix);
    seg.put("startNo", 1);
    seg.put("endNo", count);
    seg.put("count", count);
    seg.put("activated", status.equals("void") ? 0 : activated);
    seg.put("scanned", scanned);
    seg.put("createdAt", r.get("createdAt") == null ? r.get("updatedAt") : r.get("createdAt"));
    seg.put("lastScanAt", r.get("lastScanAt"));
    seg.put("status", status);
    seg.put("frozen", Common.num(r.get("frozen")) == 1);
    seg.put("sampleCode", prefix + "000001");
    return seg;
  }

  @Transactional
  public Map<String, Object> generate(Map<String, Object> body) {
    long batchId = Common.num(body.get("batchId"));
    List<Map<String, Object>> batch = jdbc.queryForList("SELECT id, status FROM batch WHERE id = ?", batchId);
    if (batch.isEmpty()) throw new ApiException("批次不存在");
    if ("BLOCKED".equals(String.valueOf(batch.get(0).get("status"))))
      throw new ApiException("批次处于预警锁定状态，请先解除预警");
    int count = Math.max(1, Math.min(20000, Common.num(body.get("count"))));
    GeneratedKeyHolder key = new GeneratedKeyHolder();
    jdbc.update(con -> {
      var ps = con.prepareStatement(
          "INSERT INTO trace_code_segment (batch_id, prefix, next_seq) VALUES (?, '', 1)",
          java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setLong(1, batchId);
      return ps;
    }, key);
    long segId = key.getKey().longValue();
    String prefix = "AG34012201" + Common.today().substring(2).replace("-", "")
        + String.format("%02d", batchId) + String.format("%02d", segId);
    jdbc.update("UPDATE trace_code_segment SET prefix = ? WHERE id = ?", prefix, segId);
    List<Object[]> batchArgs = new ArrayList<>();
    for (int i = 1; i <= count; i++) {
      batchArgs.add(new Object[] {prefix + String.format("%06d", i), batchId, segId, i});
    }
    jdbc.batchUpdate("""
        INSERT INTO trace_code (code, batch_id, segment_id, seq, level, status, scan_count)
        VALUES (?, ?, ?, ?, 2, 0, 0)
        """, batchArgs);
    jdbc.update("UPDATE trace_code_segment SET next_seq = ? WHERE id = ?", count + 1, segId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '赋码', '生成追溯码段', ?, '127.0.0.1')",
        batchId + " · " + count + " 枚");
    return segmentOf(segId);
  }

  @Transactional
  public Map<String, Object> activate(long segId) {
    Map<String, Object> seg = segmentOf(segId);
    String prefix = Common.str(seg.get("prefix"));
    jdbc.update("""
        UPDATE trace_code SET status = 1 WHERE status = 0 AND segment_id = ?
        """, segId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '赋码', '激活码段', ?, '127.0.0.1')",
        prefix);
    states.refresh(Common.num(seg.get("batchId")));
    return segmentOf(segId);
  }

  @Transactional
  public Map<String, Object> voidSegment(long segId) {
    Map<String, Object> seg = segmentOf(segId);
    String prefix = Common.str(seg.get("prefix"));
    jdbc.update("UPDATE trace_code SET status = 3 WHERE segment_id = ?", segId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '赋码', '作废码段', ?, '127.0.0.1')",
        prefix);
    states.refresh(Common.num(seg.get("batchId")));
    return segmentOf(segId);
  }

  public Map<String, Object> codes(long segId, Integer limit) {
    Map<String, Object> seg = segmentOf(segId);
    int n = limit == null ? 40 : Math.max(1, Math.min(60, limit));
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT code, seq, status, scan_count AS scanCount
        FROM trace_code WHERE segment_id = ? AND status <> 3 ORDER BY seq LIMIT ?
        """, segId, n);
    Map<String, Object> batch = jdbc.queryForMap("""
        SELECT b.batch_no AS batchNo, c.name AS cropName, c.variety, f.name AS farmName,
               p.plot_no AS plotNo, DATE_FORMAT(b.harvest_date, '%Y-%m-%d') AS harvestDate
        FROM batch b JOIN crop c ON c.id = b.crop_id JOIN farm f ON f.id = b.farm_id
        JOIN plot p ON p.id = b.plot_id WHERE b.id = ?
        """, seg.get("batchId"));
    return Common.map("segment", seg, "batch", batch, "codes", rows, "total", rows.size());
  }

  @Transactional
  public Map<String, Object> freeze(long segId, boolean frozen) {
    segmentOf(segId);
    jdbc.update("UPDATE trace_code_segment SET frozen = ? WHERE id = ?", frozen ? 1 : 0, segId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '赋码', ?, ?, '127.0.0.1')",
        frozen ? "冻结码段" : "解冻码段", "segment#" + segId);
    return segmentOf(segId);
  }

  private Map<String, Object> segmentOf(long segId) {
    java.util.List<java.util.Map<String, Object>> rows = jdbc.queryForList("""
        SELECT s.id, s.batch_id AS batchId, s.prefix, s.frozen AS frozen, b.batch_no AS batchNo, p.plot_no AS plotNo,
               c.name AS cropName, f.name AS farmName, f.id AS farmId,
               COUNT(tc.id) AS cnt,
               COALESCE(SUM(tc.status IN (1, 2)), 0) AS activated,
               COALESCE(SUM(tc.status = 2), 0) AS scanned,
               COALESCE(SUM(tc.status = 3), 0) AS voided,
               DATE_FORMAT(MIN(tc.create_time), '%Y-%m-%d %H:%i') AS createdAt,
               DATE_FORMAT(MAX(tc.first_scan), '%Y-%m-%d %H:%i') AS lastScanAt,
               DATE_FORMAT(s.update_time, '%Y-%m-%d %H:%i') AS updatedAt
        FROM trace_code_segment s
        JOIN batch b ON b.id = s.batch_id
        JOIN plot p ON p.id = b.plot_id
        JOIN crop c ON c.id = b.crop_id
        JOIN farm f ON f.id = b.farm_id
        LEFT JOIN trace_code tc ON tc.segment_id = s.id
        WHERE s.id = ?
        GROUP BY s.id, s.batch_id, s.prefix, s.frozen, b.batch_no, p.plot_no, c.name, f.name, s.update_time
        """, segId);
    if (rows.isEmpty()) throw new ApiException("码段不存在", 404);
    return toSegment(rows.get(0));
  }
}
