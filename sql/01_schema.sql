-- ============================================================
-- 农产品溯源管理系统 · 建库脚本
-- MySQL 8.0+   charset utf8mb4 / collation utf8mb4_0900_ai_ci
-- ============================================================
DROP DATABASE IF EXISTS agri_trace_app;
CREATE DATABASE agri_trace_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE agri_trace_app;

-- ---------------- 组织与账号 ----------------
CREATE TABLE farm (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(64)  NOT NULL,
  region_code VARCHAR(12)  NOT NULL COMMENT '行政区划码',
  region_name VARCHAR(64)  NOT NULL,
  address     VARCHAR(255),
  lng         DECIMAL(10,7),
  lat         DECIMAL(10,7),
  area_mu     DECIMAL(10,2),
  cert_no     VARCHAR(64) COMMENT '绿色食品/有机认证号',
  contact     VARCHAR(32),
  phone       VARCHAR(20),
  del_flag    TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT '农场/合作社';

CREATE TABLE sys_user (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(32)  NOT NULL,
  password      VARCHAR(100) NOT NULL COMMENT 'BCrypt',
  real_name     VARCHAR(32)  NOT NULL,
  phone         VARCHAR(20),
  enabled       TINYINT NOT NULL DEFAULT 1,
  last_login_at DATETIME,
  fail_count    INT NOT NULL DEFAULT 0,
  lock_until    DATETIME DEFAULT NULL,
  del_flag      TINYINT NOT NULL DEFAULT 0,
  create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) COMMENT '用户';

CREATE TABLE sys_role (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(32) NOT NULL,
  code       VARCHAR(32) NOT NULL,
  data_scope TINYINT NOT NULL DEFAULT 1 COMMENT '1本农场 2指定农场 3全部',
  perm_json  JSON COMMENT '["plot:view","plot:edit"]',
  UNIQUE KEY uk_code (code)
);

CREATE TABLE sys_user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sys_user_farm (
  user_id BIGINT NOT NULL,
  farm_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, farm_id)
) COMMENT '一人可管多个农场';

CREATE TABLE sys_menu (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  parent_id BIGINT NOT NULL DEFAULT 0,
  name      VARCHAR(32) NOT NULL,
  path      VARCHAR(96),
  perm      VARCHAR(64),
  icon      VARCHAR(32),
  sort      INT NOT NULL DEFAULT 0,
  type      TINYINT NOT NULL DEFAULT 2 COMMENT '1目录 2菜单 3按钮',
  KEY idx_parent (parent_id, sort)
);

CREATE TABLE op_log (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT,
  module      VARCHAR(32),
  action      VARCHAR(32),
  params      TEXT,
  ip          VARCHAR(64),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_time (create_time)
);

-- ---------------- 主数据 ----------------
CREATE TABLE crop (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  name                  VARCHAR(48) NOT NULL,
  category              VARCHAR(32),
  variety               VARCHAR(48),
  cycle_days            INT COMMENT '生长周期天数',
  safety_interval_days  INT DEFAULT 0,
  yield_per_mu          DECIMAL(10,2) DEFAULT 0
) COMMENT '作物品类';

CREATE TABLE plot (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  farm_id          BIGINT NOT NULL,
  plot_no          VARCHAR(32) NOT NULL COMMENT 'A-01',
  name             VARCHAR(64) NOT NULL,
  area_mu          DECIMAL(10,2) NOT NULL,
  soil_type        VARCHAR(32),
  center_lng       DECIMAL(10,7) NOT NULL,
  center_lat       DECIMAL(10,7) NOT NULL,
  polygon_json     JSON NOT NULL COMMENT 'GeoJSON Polygon: [[[lng,lat],...]]',
  crop_id          BIGINT,
  current_batch_id BIGINT,
  status           TINYINT NOT NULL DEFAULT 1 COMMENT '1生长中 2待采收 3休耕 4预警',
  manager_id       BIGINT,
  del_flag         TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_plot (farm_id, plot_no),
  KEY idx_batch (current_batch_id)
) COMMENT '地块';

CREATE TABLE batch (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_no      VARCHAR(40) NOT NULL,
  farm_id       BIGINT NOT NULL,
  plot_id       BIGINT NOT NULL,
  crop_id       BIGINT NOT NULL,
  sow_date      DATE,
  harvest_date  DATE,
  yield_kg      DECIMAL(12,2),
  status        VARCHAR(24) NOT NULL DEFAULT 'GROWING'
                COMMENT 'GROWING/PENDING_HARVEST/HARVESTED/PROCESSING/INSPECTED/CODED/SHIPPED/BLOCKED',
  remark        VARCHAR(255),
  create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_batch_no (batch_no),
  KEY idx_plot (plot_id)
) COMMENT '生产批次 · 一切业务挂这里';

CREATE TABLE input_item (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  name                  VARCHAR(64) NOT NULL,
  type                  VARCHAR(16) NOT NULL COMMENT '农药/化肥/种子',
  active_ingredient     VARCHAR(64),
  safety_interval_days  INT NOT NULL DEFAULT 0,
  max_dosage            DECIMAL(10,2) DEFAULT 0,
  dosage_unit           VARCHAR(16) DEFAULT '毫升',
  license_no            VARCHAR(64)
) COMMENT '投入品台账';

CREATE TABLE production_record (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id      BIGINT NOT NULL,
  type          VARCHAR(16) NOT NULL COMMENT '播种/施肥/打药/灌溉/除草/采收',
  input_item_id BIGINT,
  dosage        DECIMAL(10,2),
  unit          VARCHAR(16),
  quantity_kg   DECIMAL(10,2) DEFAULT NULL COMMENT '采收/测产重量',
  operator_id   BIGINT,
  happen_time   DATETIME NOT NULL,
  photo_json    JSON,
  remark        VARCHAR(255),
  create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_batch_time (batch_id, happen_time),
  KEY idx_type_time (type, happen_time)
);

-- ---------------- 质检 ----------------
CREATE TABLE inspect_template (
  id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL
);

CREATE TABLE inspect_template_item (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  code        VARCHAR(32) NOT NULL,
  name        VARCHAR(48) NOT NULL,
  limit_value DECIMAL(10,4) NOT NULL COMMENT 'mg/kg',
  method      VARCHAR(64)
);

CREATE TABLE quality_inspect (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id       BIGINT NOT NULL,
  template_id    BIGINT,
  inspect_date   DATE NOT NULL,
  org_name       VARCHAR(64),
  org_code       VARCHAR(32),
  detect_no      VARCHAR(48) NOT NULL,
  result         TINYINT NOT NULL DEFAULT 1 COMMENT '1合格 2不合格',
  report_url     VARCHAR(255),
  report_size    VARCHAR(16),
  archive_status TINYINT NOT NULL DEFAULT 0 COMMENT '0未上传 1已归档 2待归档 3缺失',
  archive_at     DATETIME,
  archive_user   BIGINT,
  keep_until     DATE,
  disposal       VARCHAR(16),
  disposal_note  VARCHAR(255),
  source_inspect_id BIGINT DEFAULT NULL,
  dispose_user   BIGINT,
  dispose_time   DATETIME,
  create_time    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_batch (batch_id)
);

CREATE TABLE inspect_result (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  inspect_id  BIGINT NOT NULL,
  code        VARCHAR(32) NOT NULL,
  name        VARCHAR(48) NOT NULL,
  limit_value DECIMAL(10,4),
  value       DECIMAL(10,4) DEFAULT NULL COMMENT 'NULL=未检出',
  is_bad      TINYINT NOT NULL DEFAULT 0,
  KEY idx_inspect (inspect_id)
);

-- ---------------- 赋码 ----------------
CREATE TABLE trace_code_segment (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id    BIGINT NOT NULL,
  prefix      VARCHAR(24) NOT NULL,
  next_seq    INT NOT NULL DEFAULT 1,
  frozen      TINYINT NOT NULL DEFAULT 0 COMMENT '1=冻结，扫码拦截',
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_batch (batch_id)
);

CREATE TABLE trace_code (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  code         VARCHAR(40) NOT NULL,
  batch_id     BIGINT NOT NULL,
  segment_id   BIGINT DEFAULT NULL,
  seq          INT NOT NULL,
  level        TINYINT NOT NULL DEFAULT 2 COMMENT '1批次码 2单品码',
  status       TINYINT NOT NULL DEFAULT 0 COMMENT '0未激活 1已激活 2已扫描 3作废',
  first_scan   DATETIME DEFAULT NULL,
  scan_count   INT NOT NULL DEFAULT 0,
  create_time  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  KEY idx_batch_seq (batch_id, seq),
  KEY idx_segment (segment_id),
  KEY idx_status (status)
);

CREATE TABLE scan_log (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  code      VARCHAR(40) NOT NULL,
  ip        VARCHAR(64),
  region    VARCHAR(64),
  ua        VARCHAR(255),
  scan_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_code (code),
  KEY idx_time (scan_time)
);

-- ---------------- 事件链（唯一真相源） ----------------
CREATE TABLE trace_event (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id      BIGINT NOT NULL,
  stage         VARCHAR(16) NOT NULL COMMENT '生产/采收/加工/质检/仓储/物流/销售',
  event_type    VARCHAR(24) NOT NULL,
  happen_time   DATETIME NOT NULL,
  title         VARCHAR(96) NOT NULL,
  detail_text   VARCHAR(512),
  operator_name VARCHAR(32),
  cert_url      VARCHAR(255),
  alert_flag    TINYINT NOT NULL DEFAULT 0,
  data_hash     CHAR(64),
  prev_hash     CHAR(64),
  create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_batch_time (batch_id, happen_time)
);

-- ---------------- 流通 ----------------
CREATE TABLE logistics_order (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  ship_no    VARCHAR(32) NOT NULL,
  batch_ids  VARCHAR(255) NOT NULL,
  carrier    VARCHAR(64),
  plate_no   VARCHAR(16),
  driver     VARCHAR(32),
  phone      VARCHAR(20),
  from_addr  VARCHAR(255),
  to_addr    VARCHAR(255),
  start_time DATETIME,
  eta_time   DATETIME,
  sign_time  DATETIME,
  signer     VARCHAR(32),
  min_temp   DECIMAL(5,1),
  max_temp   DECIMAL(5,1),
  status     TINYINT NOT NULL DEFAULT 1 COMMENT '1待发车 2在途 3已签收 4异常',
  UNIQUE KEY uk_ship_no (ship_no),
  KEY idx_status (status)
);

CREATE TABLE logistics_track (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id    BIGINT NOT NULL,
  lng         DECIMAL(10,7),
  lat         DECIMAL(10,7),
  region      VARCHAR(64),
  temp        DECIMAL(5,1),
  happen_time DATETIME NOT NULL,
  hot         TINYINT NOT NULL DEFAULT 0,
  KEY idx_order_time (order_id, happen_time)
);

CREATE TABLE sale_record (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id   BIGINT NOT NULL,
  dealer     VARCHAR(64),
  dealer_no  VARCHAR(64),
  qty        DECIMAL(10,2),
  unit       VARCHAR(16) DEFAULT '件',
  price      DECIMAL(10,2),
  sale_time  DATETIME NOT NULL,
  KEY idx_batch (batch_id)
);

CREATE TABLE alert (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  type        VARCHAR(24) NOT NULL COMMENT 'SAFETY_INTERVAL/QUALITY_FAIL/COLD_CHAIN',
  level       TINYINT NOT NULL DEFAULT 1 COMMENT '1提示 2警告 3严重',
  target_id   BIGINT,
  message     VARCHAR(255) NOT NULL,
  status      TINYINT NOT NULL DEFAULT 0 COMMENT '0待处理 1已认领 2已解除',
  handler_id  BIGINT,
  ack_time    DATETIME,
  resolver_id BIGINT,
  resolve_time DATETIME,
  resolve_note VARCHAR(255),
  escalated   TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status, create_time),
  KEY idx_status_type (status, type)
);

-- ---------------- 仓储 / 农资 ----------------
CREATE TABLE warehouse (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(64) NOT NULL,
  type        VARCHAR(24) NOT NULL COMMENT '冷库/常温库/气调库',
  location    VARCHAR(128),
  temp_min    DECIMAL(5,1),
  temp_max    DECIMAL(5,1),
  capacity_kg DECIMAL(12,2),
  manager     VARCHAR(32),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT '库房';

CREATE TABLE storage_ledger (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id     BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  type         VARCHAR(8) NOT NULL COMMENT 'IN入库 OUT出库 LOSS损耗',
  quantity_kg  DECIMAL(12,2) NOT NULL,
  happen_time  DATETIME NOT NULL,
  operator     VARCHAR(32),
  note         VARCHAR(255),
  create_time  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_batch (batch_id),
  KEY idx_wh_time (warehouse_id, happen_time)
) COMMENT '出入库台账';

CREATE TABLE warehouse_temperature (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  warehouse_id BIGINT NOT NULL,
  temp         DECIMAL(5,1) NOT NULL,
  humidity     DECIMAL(5,1),
  record_time  DATETIME NOT NULL,
  KEY idx_wh_time (warehouse_id, record_time)
) COMMENT '库房温湿度';

CREATE TABLE input_ledger (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_id     BIGINT NOT NULL,
  batch_id    BIGINT DEFAULT NULL,
  type        VARCHAR(16) NOT NULL COMMENT 'PURCHASE采购 USE领用',
  quantity    DECIMAL(10,2) NOT NULL,
  unit        VARCHAR(16),
  operator    VARCHAR(32),
  happen_time DATETIME NOT NULL,
  note        VARCHAR(255),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_item_time (item_id, happen_time)
) COMMENT '农资出入库台账';

-- ---------------- 销售订单 / 检测模板复检 / 通知 ----------------
CREATE TABLE customer (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(64) NOT NULL,
  type       VARCHAR(24) DEFAULT '经销商',
  contact    VARCHAR(32),
  phone      VARCHAR(20),
  address    VARCHAR(128),
  note       VARCHAR(255),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT '客户';

CREATE TABLE sales_order (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no      VARCHAR(32) NOT NULL,
  customer_id   BIGINT NOT NULL,
  batch_id      BIGINT NOT NULL,
  qty_kg        DECIMAL(12,2) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  amount        DECIMAL(14,2) NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/CONFIRMED/SHIPPED/SETTLED/RETURNED',
  order_time    DATETIME NOT NULL,
  delivery_date DATE,
  note          VARCHAR(255),
  create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_status (status),
  KEY idx_customer (customer_id),
  KEY idx_batch (batch_id)
) COMMENT '销售订单';

CREATE TABLE sales_return (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  qty_kg     DECIMAL(12,2) NOT NULL,
  amount     DECIMAL(14,2) NOT NULL,
  reason     VARCHAR(255),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order (order_id)
) COMMENT '退货单';

CREATE TABLE notification (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  title       VARCHAR(128) NOT NULL,
  content     VARCHAR(512),
  category    VARCHAR(24) DEFAULT '预警',
  level       VARCHAR(12) DEFAULT 'info' COMMENT 'info/warn/alert',
  channel     VARCHAR(12) NOT NULL DEFAULT 'INBOX' COMMENT 'INBOX/SMS/WECOM',
  status      TINYINT NOT NULL DEFAULT 0 COMMENT '0未读 1已读',
  link        VARCHAR(128),
  escalated   TINYINT NOT NULL DEFAULT 0,
  read_at     DATETIME,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_status (user_id, status),
  KEY idx_time (create_time)
) COMMENT '通知中心';
