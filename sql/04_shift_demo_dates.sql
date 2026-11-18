-- ============================================================
-- 将演示业务日期平移到“运行当天”
-- 种子数据的基准日：2026-11-01
-- 用法：导入 01_schema.sql + 02_seed.sql（或完整 dump）后执行本脚本
-- 幂等：重复执行不会重复平移；重新导入 seed 后可再次执行
-- ============================================================
USE agri_trace_app;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS demo_meta (
  k VARCHAR(64) PRIMARY KEY,
  v VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO demo_meta (k, v) VALUES ('date_baseline', '2026-11-01');
SET @shift = DATEDIFF(CURDATE(), (SELECT v FROM demo_meta WHERE k = 'date_baseline'));

UPDATE batch SET
  sow_date = DATE_ADD(sow_date, INTERVAL @shift DAY),
  harvest_date = DATE_ADD(harvest_date, INTERVAL @shift DAY)
WHERE sow_date IS NOT NULL OR harvest_date IS NOT NULL;

UPDATE production_record SET happen_time = DATE_ADD(happen_time, INTERVAL @shift DAY)
WHERE happen_time IS NOT NULL;

UPDATE quality_inspect SET
  inspect_date = DATE_ADD(inspect_date, INTERVAL @shift DAY),
  keep_until = DATE_ADD(keep_until, INTERVAL @shift DAY),
  archive_at = DATE_ADD(archive_at, INTERVAL @shift DAY),
  dispose_time = DATE_ADD(dispose_time, INTERVAL @shift DAY)
WHERE inspect_date IS NOT NULL;

UPDATE trace_code SET
  first_scan = DATE_ADD(first_scan, INTERVAL @shift DAY),
  create_time = DATE_ADD(create_time, INTERVAL @shift DAY)
WHERE create_time IS NOT NULL;

UPDATE trace_code_segment SET update_time = DATE_ADD(update_time, INTERVAL @shift DAY)
WHERE update_time IS NOT NULL;

UPDATE scan_log SET scan_time = DATE_ADD(scan_time, INTERVAL @shift DAY)
WHERE scan_time IS NOT NULL;

UPDATE storage_ledger SET happen_time = DATE_ADD(happen_time, INTERVAL @shift DAY)
WHERE happen_time IS NOT NULL;

-- 温度记录：seed 使用 NOW() 相对时间（导入当天），dump 中是固定时间。
-- 只平移不晚于基准日的记录，避免把刚生成的当天温度推到未来。
UPDATE warehouse_temperature SET record_time = DATE_ADD(record_time, INTERVAL @shift DAY)
WHERE record_time IS NOT NULL
  AND DATE(record_time) <= (SELECT v FROM demo_meta WHERE k = 'date_baseline');

UPDATE input_ledger SET happen_time = DATE_ADD(happen_time, INTERVAL @shift DAY)
WHERE happen_time IS NOT NULL;

UPDATE logistics_order SET
  start_time = DATE_ADD(start_time, INTERVAL @shift DAY),
  eta_time = DATE_ADD(eta_time, INTERVAL @shift DAY),
  sign_time = DATE_ADD(sign_time, INTERVAL @shift DAY)
WHERE start_time IS NOT NULL;

UPDATE logistics_track SET happen_time = DATE_ADD(happen_time, INTERVAL @shift DAY)
WHERE happen_time IS NOT NULL;

UPDATE sale_record SET sale_time = DATE_ADD(sale_time, INTERVAL @shift DAY)
WHERE sale_time IS NOT NULL;

UPDATE sales_order SET
  order_time = DATE_ADD(order_time, INTERVAL @shift DAY),
  delivery_date = DATE_ADD(delivery_date, INTERVAL @shift DAY)
WHERE order_time IS NOT NULL;

UPDATE trace_event SET happen_time = DATE_ADD(happen_time, INTERVAL @shift DAY)
WHERE happen_time IS NOT NULL;

UPDATE demo_meta SET v = DATE_FORMAT(CURDATE(), '%Y-%m-%d') WHERE k = 'date_baseline';

SELECT CONCAT('演示数据日期已平移 ', @shift, ' 天，当前基准日：', CURDATE()) AS result;
