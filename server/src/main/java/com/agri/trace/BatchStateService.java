package com.agri.trace;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class BatchStateService {
  private final JdbcTemplate jdbc;

  public BatchStateService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public String compute(long batchId) {
    Integer blocking = jdbc.queryForObject("""
        SELECT COUNT(*) FROM alert WHERE type = 'QUALITY_FAIL' AND status IN (0, 1) AND target_id = ?
        """, Integer.class, batchId);
    if (blocking != null && blocking > 0) return "BLOCKED";

    Integer orders = jdbc.queryForObject("""
        SELECT COUNT(*) FROM logistics_order WHERE FIND_IN_SET(?, batch_ids)
        """, Integer.class, batchId);
    if (orders != null && orders > 0) return "SHIPPED";

    Integer activeCodes = jdbc.queryForObject("""
        SELECT COUNT(*) FROM trace_code WHERE batch_id = ? AND level = 2 AND status IN (1, 2)
        """, Integer.class, batchId);
    Integer plotStatus = jdbc.queryForObject("""
        SELECT p.status FROM plot p JOIN batch b ON p.id = b.plot_id WHERE b.id = ?
        """, Integer.class, batchId);
    if (plotStatus != null && plotStatus == 4) return "BLOCKED";
    if (plotStatus != null && plotStatus == 2) return "PENDING_HARVEST";
    if (activeCodes != null && activeCodes > 0) return "CODED";

    List<Map<String, Object>> ins = jdbc.queryForList("""
        SELECT result FROM quality_inspect WHERE batch_id = ?
        ORDER BY (inspect_date <= ?) DESC, inspect_date DESC, id DESC LIMIT 1
        """, batchId, Common.today());
    if (!ins.isEmpty()) {
      int result = Common.num(ins.get(0).get("result"));
      if (result == 2) return "BLOCKED";
      if (result == 1) return "INSPECTED";
    }

    Integer harvest = jdbc.queryForObject("""
        SELECT COUNT(*) FROM production_record WHERE batch_id = ? AND type IN ('采收', '测产')
        """, Integer.class, batchId);
    if (harvest != null && harvest > 0) return "HARVESTED";

    List<Map<String, Object>> dates = jdbc.queryForList("""
        SELECT DATE_FORMAT(harvest_date, '%Y-%m-%d') AS harvestDate FROM batch WHERE id = ?
        """, batchId);
    if (!dates.isEmpty() && dates.get(0).get("harvestDate") != null
        && String.valueOf(dates.get(0).get("harvestDate")).compareTo(Common.today()) <= 0) {
      return "PENDING_HARVEST";
    }
    return "GROWING";
  }

  public void refresh(long batchId) {
    String state = compute(batchId);
    jdbc.update("UPDATE batch SET status = ? WHERE id = ?", state, batchId);
  }

  public int refreshAll() {
    List<Long> ids = jdbc.queryForList("SELECT id FROM batch", Long.class);
    for (Long id : ids) refresh(id);
    return ids.size();
  }

  public void restorePlot(long batchId) {
    Integer plotStatus = jdbc.queryForObject("""
        SELECT CASE WHEN harvest_date IS NOT NULL AND harvest_date <= ? THEN 2 ELSE 1 END
        FROM batch WHERE id = ?
        """, Integer.class, Common.today(), batchId);
    jdbc.update("""
        UPDATE plot SET status = ? WHERE status = 4
          AND id = (SELECT plot_id FROM batch WHERE id = ?)
        """, plotStatus == null ? 1 : plotStatus, batchId);
    refresh(batchId);
  }

  public static String today() {
    return LocalDate.now().toString();
  }
}
