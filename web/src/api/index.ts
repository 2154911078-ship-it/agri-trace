/* ============ 类型契约：字段名与数据库列名驼峰一一对应 ============ */

export interface PlotOverview {
  id: number
  plotNo: string
  name: string
  cropName: string
  variety?: string
  status: 1 | 2 | 3 | 4
  areaMu: number
  manager?: string
  batchNo?: string
  farmName: string
  progress?: number
  centerLng: number
  centerLat: number
  polygon: { type: 'Polygon'; coordinates: number[][][] }
}

export interface PlotDetail extends PlotOverview {
  soilType?: string
  plantDate?: string
  growthDays?: number
  progress?: number
  expectYieldKg?: number
  records: { id: number; type: string; happenTime: string; detail: string; operator: string }[]
}

export interface PlotRow {
  id: number
  plotNo: string
  name: string
  cropName: string
  variety?: string
  areaMu: number
  status: 1 | 2 | 3 | 4
  batchNo?: string
  manager?: string
  lastRecordAt?: string
}

export interface PageResult {
  records: PlotRow[]
  total: number
  growing: number
  alerted: number
  /** 各状态地块数（全部/生长中/待采收/休耕/预警），供筛选条显示 */
  counts: { all: number; growing: number; harvest: number; fallow: number; alert: number }
}

export interface Todo {
  id: number
  level: 'info' | 'warn' | 'alert'
  time: string
  title: string
  desc: string
  to: string
}

export interface DashboardVO {
  areaMu: number
  pendingHarvest: number
  todayHarvest: number
  passRate: number
  todayScan: number
  /** 基地数 / 地块总数 / 在田批次数，用于副标题 */
  farmCount?: number
  plotCount?: number
  activeBatches?: number
  todos: Todo[]
  trend: { labels: string[]; data: number[] }
  category: { name: string; pct: number }[]
}

export interface TraceEvent {
  id: number
  stage: string
  happenTime: string
  title: string
  detail: string
  operator?: string
  certUrl?: string
  hash?: string
  alert?: boolean
}

export interface TraceVO {
  code: string
  batchNo: string
  productName: string
  variety?: string
  grade?: string
  packageSpec?: string
  farmName: string
  region: string
  plotNo: string
  harvestDate: string
  yieldKg: number
  inspectResult: string
  inspectOrg?: string
  reportNo?: string
  reportUrl?: string
  firstScan: boolean
  scanCount: number
  timeline: TraceEvent[]
  dataHash: string
  chainTx?: string
}

export interface BatchSummary {
  id: number
  batchNo: string
  status?: string
  cropName: string
  variety?: string
  plotNo: string
  farmName: string
  sowDate?: string
  harvestDate?: string
  processAt?: string
  codesLastAt?: string
  produceCount: number
  produce: { id: number; type: string; happenTime: string; detail: string }[]
  inspect?: {
    inspectDate: string
    org: string
    result: 1 | 2
    itemCount: number
    items: { code: string; name: string; limit: number; value: number | null; bad: boolean }[]
    reportUrl?: string
  }
  codes: { total: number; active: number; scanned: number }
  ship?: { carrier: string; plateNo: string; startTime: string }
  sale?: { dealer: string; qty: number }
  gaps: { key: string; text: string; action: string; to: string }[]
  nextAction: string
  nextActionTo: string
}

/* ============ 模块：生产 / 质检 / 赋码 / 物流 / 追溯 / 系统 ============ */

export interface ProduceRecord {
  id: number
  batchId: number
  batchNo: string
  plotNo: string
  plotName: string
  cropName: string
  variety?: string
  farmName: string
  type: string
  happenTime: string
  detail: string
  operator: string
  safeDays?: number
  safeDate?: string
  quantityKg?: number
}

export interface ProducePage {
  records: ProduceRecord[]
  total: number
  today: number
  week: number
  safetyAlerts: number
  counts: { all: number; fertilize: number; spray: number; irrigate: number; harvest: number; other: number }
}

export interface ProduceCreateBody {
  batchId: number
  type: string
  happenTime: string
  detail: string
  operator: string
  safeDays?: number
  quantityKg?: number
}

export interface InspectItem {
  code: string
  name: string
  limit: number
  value: number | null
  bad: boolean
}

export interface InspectionRow {
  id: number
  batchId: number
  batchNo: string
  plotNo: string
  plotName: string
  cropName: string
  variety?: string
  farmName: string
  inspectDate: string
  org: string
  result: 0 | 1 | 2
  itemCount: number
  items: InspectItem[]
  reportUrl?: string
  reportNo?: string
  locked: boolean
  sourceInspectId?: number
  disposal?: string
  disposalNote?: string
  disposeTime?: string
}

export interface InspectPage {
  records: InspectionRow[]
  total: number
  pending: number
  passed: number
  failed: number
  passRate: number
}

export interface InspectCreateBody {
  batchId: number
  org: string
  inspectDate: string
  items: { code: string; value: number | null }[]
}

export interface CodeSegment {
  id: number
  batchId: number
  batchNo: string
  plotNo: string
  cropName: string
  farmName: string
  prefix: string
  startNo: number
  endNo: number
  count: number
  activated: number
  scanned: number
  createdAt: string
  lastScanAt?: string
  status: 'active' | 'void' | 'exhausted'
  frozen?: boolean
  sampleCode: string
}

export interface CodePage {
  records: CodeSegment[]
  total: number
  codes: number
  active: number
  scanned: number
  voided: number
  statusCounts: { all: number; active: number; exhausted: number; void: number }
}

export interface CodeGenerateBody {
  batchId: number
  count: number
}

export interface ShipPoint {
  time: string
  place: string
  status: string
  temp?: number
}

export interface ShipmentRow {
  id: number
  batchId: number
  batchNo: string
  plotNo: string
  cropName: string
  farmName: string
  carrier: string
  plateNo: string
  startTime: string
  dealer?: string
  qty?: number
  status: 'pending' | 'transit' | 'delivered' | 'alert'
  from: string
  to: string
  temp: { time: string; value: number }[]
  points: ShipPoint[]
  signAt?: string
  signBy?: string
}

export interface ShipPage {
  records: ShipmentRow[]
  total: number
  pending: number
  transit: number
  delivered: number
  alerts: number
}

export interface ShipCreateBody {
  batchId: number
  carrier: string
  plateNo: string
  dealer: string
  qty: number
}

export interface TraceLogRow {
  code: string
  batchId: number
  batchNo: string
  productName: string
  farmName: string
  scanCount: number
  lastScanAt: string
  location: string
  firstScan: boolean
  alert: boolean
}

export interface TraceLogPage {
  records: TraceLogRow[]
  total: number
  scansToday: number
  firstScans: number
  alerts: number
}

export interface SysUser {
  id: number
  name: string
  account: string
  role: string
  farm: string
  status: 'active' | 'disabled'
  lastLogin: string
  phone?: string
}

export interface SysRole {
  key: string
  name: string
  desc: string
  users: number
  permissions: string[]
}

export interface SysFarm {
  id?: number
  name: string
  plots: number
  areaMu: number
  manager: string
  address: string
}

export interface SysLog {
  id: number
  time: string
  user: string
  action: string
  target: string
  ip: string
}

export interface SysPage {
  users: SysUser[]
  roles: SysRole[]
  farms: SysFarm[]
  logs: SysLog[]
}

export interface SysUserCreateBody {
  name: string
  account: string
  role: string
  farm: string
  phone?: string
}

/* ============ 接口方法 ============ */
import { get, post, upload } from '@/utils/http'

export const apiLogin = (username: string, password: string) =>
  post<{ token: string; name: string; roleName: string }>('/auth/login', { username, password })

export interface AuthMe {
  id: number
  name: string
  account: string
  phone?: string
  roleName: string
  farmName?: string
  lastLogin: string
}

export const apiMe = () => get<AuthMe>('/auth/me')
export const apiUpdateProfile = (body: { phone?: string }) => post<AuthMe>('/auth/profile', body)
export const apiChangePassword = (body: { oldPassword: string; newPassword: string }) =>
  post<boolean>('/auth/password', body)
export const apiLogout = () => post<boolean>('/auth/logout')
export const apiLanAddress = () => get<{ ip: string; interface: string }>('/system/lan')

export const apiPlotsOverview = (farmId?: number) =>
  get<PlotOverview[]>('/plots/overview', farmId ? { farmId } : {})

export const apiPlotDetail = (id: number) =>
  get<PlotDetail>(`/plots/${id}/detail`)

export const apiPlotPage = (q: {
  page: number
  size: number
  status: number | null
  crop: string | null
  kw: string
}) => get<PageResult>('/plots/page', q)

export const apiDashboard = (farmId?: number) =>
  get<DashboardVO>('/dashboard/overview', farmId ? { farmId } : {})

export const apiBatch = (id: number) =>
  get<BatchSummary>(`/batches/${id}`)

export const apiTrace = (code: string) =>
  get<TraceVO>(`/trace/${code}`)

export const apiPlotBatch = (plotId: number) =>
  get<BatchSummary | null>(`/plots/${plotId}/batch`)

export const apiTraceVerify = (code: string) =>
  get<{ ok: boolean }>(`/trace/${code}/verify`)

export const apiBatches = () =>
  get<BatchSummary[]>('/batches')

/* ---------- 生产 ---------- */
export const apiProducePage = (q: { kw?: string; type?: string | null; batchId?: number | null; page?: number; size?: number }) =>
  get<ProducePage>('/produce/records', q)

export const apiProduceCreate = (body: ProduceCreateBody) =>
  post<ProduceRecord>('/produce/records', body)

/* ---------- 质检 ---------- */
export const apiInspectPage = (q: { kw?: string; result?: number | null; page?: number; size?: number }) =>
  get<InspectPage>('/inspects', q)

export const apiInspectCreate = (body: InspectCreateBody) =>
  post<InspectionRow>('/inspects', body)

/* ---------- 赋码 ---------- */
export const apiCodesPage = (q: { kw?: string; status?: string | null; page?: number; size?: number }) =>
  get<CodePage>('/codes/segments', q)

export const apiCodesGenerate = (body: CodeGenerateBody) =>
  post<CodeSegment>('/codes/segments', body)

export const apiCodesActivate = (id: number) =>
  post<CodeSegment>(`/codes/segments/${id}/activate`)

export const apiCodesVoid = (id: number) =>
  post<CodeSegment>(`/codes/segments/${id}/void`)

/* ---------- 物流 ---------- */
export const apiShipPage = (q: { kw?: string; status?: string | null; page?: number; size?: number }) =>
  get<ShipPage>('/shipments', q)

export const apiShipCreate = (body: ShipCreateBody) =>
  post<ShipmentRow>('/shipments', body)

export const apiShipSign = (id: number, body: { by: string }) =>
  post<ShipmentRow>(`/shipments/${id}/sign`, body)

/* ---------- 追溯列表 ---------- */
export const apiTraceLogs = (q: { kw?: string; page?: number; size?: number } = {}) =>
  get<TraceLogPage>('/trace/logs', q)

/* ---------- 系统 ---------- */
export const apiSysPage = () =>
  get<SysPage>('/sys')

export const apiSysUserCreate = (body: SysUserCreateBody) =>
  post<SysUser>('/sys/users', body)

export const apiSysUserToggle = (id: number) =>
  post<SysUser>(`/sys/users/${id}/toggle`)

/* ============ 预警 / 扫码 / 报告 ============ */

export interface AlertRow {
  id: number
  type: string
  typeName: string
  level: number
  levelName: string
  batchId?: number
  batchNo?: string
  plotNo?: string
  plotName?: string
  farmName?: string
  message: string
  status: 0 | 1 | 2
  statusName: string
  createTime: string
  ackTime?: string
  resolveTime?: string
  resolveNote?: string
  ackUser?: string
  resolveUser?: string
}

export interface AlertPage {
  records: AlertRow[]
  total: number
  pending: number
  acked: number
  resolved: number
}

export const apiAlerts = (q: { kw?: string; status?: number | null; page?: number; size?: number } = {}) =>
  get<AlertPage>('/alerts', q)
export const apiAlertAck = (id: number) => post<AlertRow>(`/alerts/${id}/ack`)
export const apiAlertResolve = (id: number, note: string) =>
  post<AlertRow>(`/alerts/${id}/resolve`, { note })
export const apiScanCode = (code: string, region?: string) =>
  post<{ code: string; scanCount: number; firstScan: boolean; region: string; time: string }>(
    `/trace/${code}/scan`, { region })
export const apiUploadReport = (inspectId: number, file: File) =>
  upload<{ id: number; reportUrl: string; reportSize: string; archiveStatus: number }>(
    `/inspects/${inspectId}/report`, file)
