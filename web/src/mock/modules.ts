import {
  BATCH_LIST, BATCH_BY_ID, PLOTS, FARMS, TODAY, MANAGERS, PEST_ITEMS,
  CARRIERS, INSPECT_ORGS, DEALERS, TRACE_BY_CODE, TRACE_CODES, traceCodeOf,
} from './data'
import type {
  ProduceRecord, ProducePage, ProduceCreateBody,
  InspectionRow, InspectPage, InspectCreateBody,
  CodeSegment, CodePage, CodeGenerateBody,
  ShipmentRow, ShipPage, ShipCreateBody, ShipPoint,
  TraceLogRow, TraceLogPage,
  SysUser, SysRole, SysFarm, SysLog, SysPage, SysUserCreateBody,
} from '@/api'

const pad = (n: number) => String(n).padStart(2, '0')
const nowStamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const shift = (base: string, days: number) => {
  const d = new Date(base.slice(0, 10) + 'T00:00:00+08:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b.slice(0, 10) + 'T00:00:00+08:00').getTime() - new Date(a.slice(0, 10) + 'T00:00:00+08:00').getTime()) / 86400000)
const plotOfNo = (no: string) => PLOTS.find(p => p.plotNo === no)
const seedOf = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1
const pickDealer = (n: number) => DEALERS[Math.floor(seedOf(n) * DEALERS.length) % DEALERS.length]

/* ============================== 生产 ============================== */
const PRODUCE: ProduceRecord[] = []
BATCH_LIST.forEach(b => {
  const plot = plotOfNo(b.plotNo)
  b.produce.forEach((r, i) => {
    if (r.happenTime.slice(0, 10) > TODAY) return
    const safeDays = r.type === '打药' ? Number(/安全间隔\s*(\d+)\s*天/.exec(r.detail)?.[1] || 0) : 0
    PRODUCE.push({
      id: b.id * 100 + i + 1,
      batchId: b.id,
      batchNo: b.batchNo,
      plotNo: b.plotNo,
      plotName: plot?.name || '',
      cropName: b.cropName,
      variety: b.variety,
      farmName: b.farmName,
      type: r.type,
      happenTime: r.happenTime,
      detail: r.detail,
      operator: plot?.manager || MANAGERS[b.id % MANAGERS.length],
      safeDays: safeDays || undefined,
      safeDate: safeDays ? shift(r.happenTime, safeDays) : undefined,
    })
  })
})
PRODUCE.sort((a, b) => (a.happenTime < b.happenTime ? 1 : -1))

const produceCounts = () => {
  const c = { all: PRODUCE.length, fertilize: 0, spray: 0, irrigate: 0, harvest: 0, other: 0 }
  PRODUCE.forEach(r => {
    if (r.type === '施肥') c.fertilize++
    else if (r.type === '打药') c.spray++
    else if (r.type === '灌溉') c.irrigate++
    else if (r.type === '采收' || r.type === '测产') c.harvest++
    else c.other++
  })
  return c
}

export function producePage(q: { kw?: string; type?: string | null; batchId?: number | null } = {}): ProducePage {
  const kw = (q.kw || '').trim().toLowerCase()
  let rows = PRODUCE.slice()
  if (q.batchId) rows = rows.filter(r => r.batchId === Number(q.batchId))
  if (q.type && q.type !== 'all') {
    const m: Record<string, string[]> = {
      fertilize: ['施肥'], spray: ['打药'], irrigate: ['灌溉'], harvest: ['采收', '测产'],
    }
    if (m[q.type]) rows = rows.filter(r => m[q.type].includes(r.type))
    else rows = rows.filter(r => !['施肥', '打药', '灌溉', '采收', '测产'].includes(r.type))
  }
  if (kw) {
    rows = rows.filter(r =>
      r.batchNo.toLowerCase().includes(kw) ||
      r.plotNo.toLowerCase().includes(kw) ||
      r.plotName.includes(q.kw || '') ||
      r.cropName.includes(q.kw || '') ||
      r.type.includes(q.kw || '') ||
      r.operator.includes(q.kw || ''))
  }
  const today = PRODUCE.filter(r => r.happenTime.startsWith(TODAY)).length
  const week = PRODUCE.filter(r => daysBetween(r.happenTime, TODAY) <= 7 && daysBetween(r.happenTime, TODAY) >= 0).length
  const safetyAlerts = PRODUCE.filter(r => r.safeDate && r.safeDate > TODAY).length
  return { records: rows, total: rows.length, today, week, safetyAlerts, counts: produceCounts() }
}

export function createProduce(body: ProduceCreateBody): ProduceRecord {
  const b = BATCH_BY_ID[Number(body.batchId)]
  if (!b) throw new Error('批次不存在')
  const plot = plotOfNo(b.plotNo)
  const safeDays = body.type === '打药' ? Number(body.safeDays || 0) : 0
  const record: ProduceRecord = {
    id: Date.now() % 100000 + PRODUCE.length,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    plotName: plot?.name || '',
    cropName: b.cropName,
    variety: b.variety,
    farmName: b.farmName,
    type: body.type,
    happenTime: body.happenTime,
    detail: body.detail,
    operator: body.operator || MANAGERS[0],
    safeDays: safeDays || undefined,
    safeDate: safeDays ? shift(body.happenTime, safeDays) : undefined,
  }
  PRODUCE.unshift(record)
  b.produce.unshift({ id: b.produce.length + 1, type: record.type, happenTime: record.happenTime, detail: record.detail })
  b.produceCount = b.produce.length
  addLog(record.operator, '新增农事记录', `${b.batchNo} · ${record.type}`)
  return record
}

/* ============================== 质检 ============================== */
const INSPECTIONS: InspectionRow[] = BATCH_LIST.map(b => {
  const plot = plotOfNo(b.plotNo)
  const ins = b.inspect!
  const pending = ins.inspectDate > TODAY
  const result = pending ? 0 : ins.result as 0 | 1 | 2
  return {
    id: b.id,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    plotName: plot?.name || '',
    cropName: b.cropName,
    variety: b.variety,
    farmName: b.farmName,
    inspectDate: ins.inspectDate,
    org: ins.org,
    result,
    itemCount: ins.itemCount,
    items: ins.items.map(x => ({ ...x })),
    reportUrl: ins.reportUrl,
    reportNo: `HF2026-${ins.inspectDate.replace(/-/g, '').slice(4)}-${String(b.id).padStart(4, '0')}`,
    locked: result === 2,
  }
})

export function inspectPage(q: { kw?: string; result?: number | null } = {}): InspectPage {
  const kw = (q.kw || '').trim().toLowerCase()
  let rows = INSPECTIONS.slice()
  if (q.result !== null && q.result !== undefined) rows = rows.filter(r => r.result === Number(q.result))
  if (kw) {
    rows = rows.filter(r =>
      r.batchNo.toLowerCase().includes(kw) ||
      r.plotNo.toLowerCase().includes(kw) ||
      r.cropName.includes(q.kw || '') ||
      r.org.includes(q.kw || ''))
  }
  const pending = INSPECTIONS.filter(r => r.result === 0).length
  const passed = INSPECTIONS.filter(r => r.result === 1).length
  const failed = INSPECTIONS.filter(r => r.result === 2).length
  const done = passed + failed
  return {
    records: rows,
    total: rows.length,
    pending, passed, failed,
    passRate: done ? Math.round((passed / done) * 1000) / 10 : 100,
  }
}

export function createInspection(body: InspectCreateBody): InspectionRow {
  const b = BATCH_BY_ID[Number(body.batchId)]
  if (!b) throw new Error('批次不存在')
  const items = PEST_ITEMS.map(p => {
    const input = body.items.find(x => x.code === p.code)
    const value = input?.value === null || input?.value === undefined ? null : Number(input.value)
    return { code: p.code, name: p.name, limit: p.limit, value, bad: value !== null && value > p.limit }
  })
  const result = items.some(x => x.bad) ? 2 : 1
  b.inspect = {
    inspectDate: body.inspectDate,
    org: body.org,
    result,
    itemCount: items.length,
    items,
    reportUrl: `/files/reports/${b.batchNo}_${body.inspectDate}_${Date.now().toString(36)}.pdf`,
  }
  const plot = plotOfNo(b.plotNo)
  const row: InspectionRow = {
    id: b.id,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    plotName: plot?.name || '',
    cropName: b.cropName,
    variety: b.variety,
    farmName: b.farmName,
    inspectDate: body.inspectDate,
    org: body.org,
    result,
    itemCount: items.length,
    items,
    reportUrl: b.inspect.reportUrl,
    reportNo: `HF2026-${body.inspectDate.replace(/-/g, '').slice(4)}-${String(b.id).padStart(4, '0')}`,
    locked: result === 2,
  }
  const i = INSPECTIONS.findIndex(x => x.id === row.id)
  if (i >= 0) INSPECTIONS[i] = row
  else INSPECTIONS.unshift(row)
  addLog('王敏', '提交检测单', `${b.batchNo} · ${result === 1 ? '合格' : '不合格'}`)
  return row
}

/* ============================== 赋码 ============================== */
let codeSeq = 0
const SEGMENTS: CodeSegment[] = BATCH_LIST.map(b => {
  const prefix = `AG34012201${TODAY.slice(2).replace(/-/g, '')}${String(b.id).padStart(2, '0')}`
  const count = b.codes.total
  const status: CodeSegment['status'] = b.id === 5 ? 'void' : b.codes.active >= count ? 'exhausted' : 'active'
  const activated = status === 'void' ? 0 : b.codes.active
  const day = b.codesLastAt && b.codesLastAt <= TODAY ? b.codesLastAt : TODAY
  return {
    id: ++codeSeq,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    cropName: b.cropName,
    farmName: b.farmName,
    prefix,
    startNo: 1,
    endNo: count,
    count,
    activated,
    scanned: b.codes.scanned,
    createdAt: `${day} 09:20`,
    lastScanAt: `${day} 16:40`,
    status,
    sampleCode: `${prefix}${String(1).padStart(6, '0')}`,
  }
})

export function codesPage(q: { kw?: string; status?: string | null } = {}): CodePage {
  const kw = (q.kw || '').trim().toLowerCase()
  let rows = SEGMENTS.slice()
  if (q.status) rows = rows.filter(r => r.status === q.status)
  if (kw) {
    rows = rows.filter(r =>
      r.batchNo.toLowerCase().includes(kw) ||
      r.plotNo.toLowerCase().includes(kw) ||
      r.cropName.includes(q.kw || '') ||
      r.prefix.toLowerCase().includes(kw))
  }
  return {
    records: rows,
    total: rows.length,
    codes: SEGMENTS.reduce((s, r) => s + r.count, 0),
    active: SEGMENTS.reduce((s, r) => s + r.activated, 0),
    scanned: SEGMENTS.reduce((s, r) => s + r.scanned, 0),
    voided: SEGMENTS.filter(r => r.status === 'void').reduce((s, r) => s + r.count, 0),
    statusCounts: {
      all: SEGMENTS.length,
      active: SEGMENTS.filter(r => r.status === 'active').length,
      exhausted: SEGMENTS.filter(r => r.status === 'exhausted').length,
      void: SEGMENTS.filter(r => r.status === 'void').length,
    },
  }
}

export function generateCodes(body: CodeGenerateBody): CodeSegment {
  const b = BATCH_BY_ID[Number(body.batchId)]
  if (!b) throw new Error('批次不存在')
  const count = Math.max(1, Math.min(20000, Math.round(Number(body.count) || 0)))
  const id = ++codeSeq
  const prefix = `AG34012201${TODAY.slice(2).replace(/-/g, '')}${String(b.id).padStart(2, '0')}${String(id).padStart(2, '0')}`
  const seg: CodeSegment = {
    id,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    cropName: b.cropName,
    farmName: b.farmName,
    prefix,
    startNo: 1,
    endNo: count,
    count,
    activated: 0,
    scanned: 0,
    createdAt: nowStamp(),
    status: 'active',
    sampleCode: `${prefix}${String(1).padStart(6, '0')}`,
  }
  SEGMENTS.unshift(seg)
  b.codes.total += count
  b.codesLastAt = nowStamp().slice(0, 10)
  addLog('张耕', '生成追溯码段', `${b.batchNo} · ${count} 枚`)
  return seg
}

export function activateSegment(id: number): CodeSegment {
  const seg = SEGMENTS.find(s => s.id === Number(id))
  if (!seg) throw new Error('码段不存在')
  seg.status = 'active'
  seg.activated = seg.count
  const b = BATCH_BY_ID[seg.batchId]
  if (b) b.codes.active = seg.activated
  addLog('张耕', '激活码段', `${seg.batchNo} · ${seg.prefix}`)
  return seg
}

export function voidSegment(id: number): CodeSegment {
  const seg = SEGMENTS.find(s => s.id === Number(id))
  if (!seg) throw new Error('码段不存在')
  seg.status = 'void'
  seg.activated = 0
  const b = BATCH_BY_ID[seg.batchId]
  if (b) b.codes.active = 0
  addLog('张耕', '作废码段', `${seg.batchNo} · ${seg.prefix}`)
  return seg
}

/* ============================== 物流 ============================== */
const timeLabels = (start: string) => {
  const base = start ? new Date(start.replace(' ', 'T') + ':00+08:00') : new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(base.getTime() + i * 30 * 60000)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
}

const tempSeries = (id: number, alert: boolean) =>
  timeLabels(`${TODAY} 06:40`).map((time, i) => {
    const base = 4.1 + Math.sin(i * 0.7 + id) * 0.8 + (id % 3) * 0.15
    return { time, value: Math.round((alert && i === 6 ? 9.1 : base) * 10) / 10 }
  })

const pointsOf = (from: string, to: string, alert: boolean, start: string): ShipPoint[] => {
  const base = start || `${TODAY} 06:40`
  return [
    { time: base, place: from, status: '装车发运', temp: 4.2 },
    { time: `${start.slice(0, 10)} 09:10`, place: '沪陕高速肥东服务区', status: '途中巡检', temp: alert ? 9.1 : 4.8 },
    { time: `${start.slice(0, 10)} 12:35`, place: to, status: '到达销地', temp: 5.2 },
  ]
}

const SHIPMENTS: ShipmentRow[] = BATCH_LIST.map(b => {
  const plot = plotOfNo(b.plotNo)
  const alert = b.id % 5 === 0
  const delivered = b.id % 4 === 0
  const status: ShipmentRow['status'] = !b.ship ? 'pending' : delivered ? 'delivered' : alert ? 'alert' : 'transit'
  const to = b.sale?.dealer || pickDealer(b.id)
  const start = b.ship
    ? (b.ship.startTime.slice(0, 10) > TODAY ? `${TODAY} ${b.ship.startTime.slice(11) || '06:40'}` : b.ship.startTime)
    : ''
  const row: ShipmentRow = {
    id: b.id,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    cropName: b.cropName,
    farmName: b.farmName,
    carrier: b.ship?.carrier || '',
    plateNo: b.ship?.plateNo || '',
    startTime: start,
    dealer: b.sale?.dealer,
    qty: b.sale?.qty,
    status,
    from: b.farmName,
    to: b.ship ? to : '待分配',
    temp: b.ship ? tempSeries(b.id, alert) : [],
    points: b.ship ? pointsOf(b.farmName, to, alert, start) : [],
    signAt: delivered && b.ship ? `${start.slice(0, 10)} 14:10` : undefined,
    signBy: delivered ? '经销商 周敏' : undefined,
  }
  if (delivered) row.points.push({ time: row.signAt!, place: row.to, status: '签收完成', temp: 5.6 })
  return row
})

export function shipPage(q: { kw?: string; status?: string | null } = {}): ShipPage {
  const kw = (q.kw || '').trim().toLowerCase()
  let rows = SHIPMENTS.slice()
  if (q.status) rows = rows.filter(r => r.status === q.status)
  if (kw) {
    rows = rows.filter(r =>
      r.batchNo.toLowerCase().includes(kw) ||
      r.plotNo.toLowerCase().includes(kw) ||
      r.cropName.includes(q.kw || '') ||
      r.carrier.includes(q.kw || '') ||
      r.plateNo.toLowerCase().includes(kw) ||
      (r.dealer || '').includes(q.kw || ''))
  }
  return {
    records: rows,
    total: rows.length,
    pending: SHIPMENTS.filter(r => r.status === 'pending').length,
    transit: SHIPMENTS.filter(r => r.status === 'transit').length,
    delivered: SHIPMENTS.filter(r => r.status === 'delivered').length,
    alerts: SHIPMENTS.filter(r => r.status === 'alert').length,
  }
}

export function createShipment(body: ShipCreateBody): ShipmentRow {
  const b = BATCH_BY_ID[Number(body.batchId)]
  if (!b) throw new Error('批次不存在')
  const plot = plotOfNo(b.plotNo)
  const start = `${nowStamp().slice(0, 10)} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
  b.ship = { carrier: body.carrier, plateNo: body.plateNo, startTime: start }
  b.sale = { dealer: body.dealer, qty: Number(body.qty) || 0 }
  const row: ShipmentRow = {
    id: b.id,
    batchId: b.id,
    batchNo: b.batchNo,
    plotNo: b.plotNo,
    cropName: b.cropName,
    farmName: b.farmName,
    carrier: body.carrier,
    plateNo: body.plateNo,
    startTime: start,
    dealer: body.dealer,
    qty: Number(body.qty) || 0,
    status: 'transit',
    from: b.farmName,
    to: body.dealer,
    temp: tempSeries(b.id, false),
    points: [
      { time: start, place: b.farmName, status: '装车发运', temp: 4.2 },
    ],
  }
  const i = SHIPMENTS.findIndex(x => x.id === row.id)
  if (i >= 0) SHIPMENTS[i] = row
  else SHIPMENTS.unshift(row)
  addLog('李强', '创建运输单', `${b.batchNo} · ${body.carrier}`)
  return row
}

export function signShipment(id: number, by: string): ShipmentRow {
  const row = SHIPMENTS.find(x => x.id === Number(id))
  if (!row) throw new Error('运单不存在')
  row.status = 'delivered'
  row.signAt = nowStamp()
  row.signBy = by || '经销商'
  row.points.push({ time: row.signAt, place: row.to, status: '签收完成', temp: row.temp[row.temp.length - 1]?.value })
  addLog(row.signBy, '运单签收', `${row.batchNo} · ${row.carrier}`)
  return row
}

/* ============================== 追溯列表 ============================== */
const TRACE_ROWS: TraceLogRow[] = TRACE_CODES.map((code, i) => {
  const t = TRACE_BY_CODE[code]
  const b = BATCH_LIST.find(x => x.batchNo === t.batchNo)
  return {
    code,
    batchId: b?.id || i + 1,
    batchNo: t.batchNo,
    productName: t.productName,
    farmName: t.farmName,
    scanCount: t.scanCount,
    lastScanAt: `${b?.codesLastAt || TODAY} ${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
    location: pickDealer(i + 3),
    firstScan: t.firstScan,
    alert: t.inspectResult === '不合格',
  }
})

export function traceLogPage(q: { kw?: string } = {}): TraceLogPage {
  const kw = (q.kw || '').trim().toLowerCase()
  const rows = kw
    ? TRACE_ROWS.filter(r => r.code.toLowerCase().includes(kw) || r.batchNo.toLowerCase().includes(kw) || r.productName.includes(q.kw || ''))
    : TRACE_ROWS
  return {
    records: rows,
    total: rows.length,
    scansToday: TRACE_ROWS.reduce((s, r) => s + Math.max(1, Math.round(r.scanCount / 3)), 0),
    firstScans: TRACE_ROWS.filter(r => r.firstScan).length,
    alerts: TRACE_ROWS.filter(r => r.alert).length,
  }
}

export function traceVerify(code: string) {
  return { ok: !!TRACE_BY_CODE[code] }
}

/* ============================== 系统 ============================== */
const ROLE_NAMES = ['合作社管理员', '农艺师', '质检员', '仓管', '司机']
const USERS: SysUser[] = [
  { id: 1, name: '张耕', account: 'admin', role: '合作社管理员', farm: FARMS[0], status: 'active', lastLogin: `${TODAY} 07:20`, phone: '138****6210' },
  { id: 2, name: '张三', account: 'zhangsan', role: '农艺师', farm: FARMS[0], status: 'active', lastLogin: `${TODAY} 06:55`, phone: '139****3182' },
  { id: 3, name: '李慧', account: 'lihui', role: '农艺师', farm: FARMS[1], status: 'active', lastLogin: '2026-10-27 18:12', phone: '137****8841' },
  { id: 4, name: '王敏', account: 'wangmin', role: '质检员', farm: FARMS[0], status: 'active', lastLogin: `${TODAY} 08:05`, phone: '136****2095' },
  { id: 5, name: '陈立', account: 'chenli', role: '仓管', farm: FARMS[2], status: 'active', lastLogin: '2026-10-26 16:40', phone: '135****7730' },
  { id: 6, name: '周敏', account: 'zhoumin', role: '司机', farm: FARMS[1], status: 'disabled', lastLogin: '2026-10-20 09:14', phone: '158****4417' },
]

const ROLES: SysRole[] = [
  { key: 'admin', name: '合作社管理员', desc: '全部模块与数据权限', users: 1, permissions: ['概览', '生产', '质检', '赋码', '物流', '追溯', '系统'] },
  { key: 'agronomist', name: '农艺师', desc: '生产记录与地块管理', users: 2, permissions: ['概览', '基地', '生产', '追溯'] },
  { key: 'qc', name: '质检员', desc: '检测单与批次锁定', users: 1, permissions: ['概览', '质检', '追溯'] },
  { key: 'warehouse', name: '仓管', desc: '赋码、出入库与物流', users: 1, permissions: ['概览', '赋码', '物流'] },
  { key: 'driver', name: '司机', desc: '运输单与签收', users: 1, permissions: ['物流'] },
]

const FARMS_INFO: SysFarm[] = FARMS.map((name, i) => {
  const farmBlock: Record<string, number> = { A: 0, B: 0, C: 1, D: 1, E: 2, F: 2 }
  const plots = PLOTS.filter(p => farmBlock[p.plotNo[0]] === i)
  return {
    name,
    plots: plots.length,
    areaMu: Math.round(plots.reduce((s, p) => s + p.areaMu, 0) * 10) / 10,
    manager: MANAGERS[i % MANAGERS.length],
    address: ['安徽省合肥市肥东县店埠镇', '安徽省合肥市肥东县撮镇镇', '安徽省合肥市肥东县桥头集镇'][i],
  }
})

let logSeq = 0
const LOGS: SysLog[] = []
function addLog(user: string, action: string, target: string, at?: string) {
  LOGS.unshift({ id: ++logSeq, time: at || nowStamp(), user, action, target, ip: `192.168.1.${20 + (logSeq % 60)}` })
  if (LOGS.length > 60) LOGS.pop()
}
const SEED_TIMES = ['07:05', '08:12', '09:20', '10:40', '11:15']
BATCH_LIST.slice(0, 5).forEach((b, i) => {
  addLog(MANAGERS[i % MANAGERS.length], ['新增农事记录', '提交检测单', '生成追溯码段', '创建运输单', '运单签收'][i], `${b.batchNo} · ${b.cropName}`, `${TODAY} ${SEED_TIMES[i]}`)
})

export function sysPage(): SysPage {
  return {
    users: USERS.slice(),
    roles: ROLES.map(r => ({ ...r, users: USERS.filter(u => u.role === r.name).length })),
    farms: FARMS_INFO.slice(),
    logs: LOGS.slice(0, 30),
  }
}

export function createUser(body: SysUserCreateBody): SysUser {
  if (!body.name || !body.account) throw new Error('姓名和账号必填')
  if (USERS.some(u => u.account === body.account)) throw new Error('账号已存在')
  const user: SysUser = {
    id: Math.max(...USERS.map(u => u.id)) + 1,
    name: body.name,
    account: body.account,
    role: ROLE_NAMES.includes(body.role) ? body.role : '农艺师',
    farm: body.farm || FARMS[0],
    status: 'active',
    lastLogin: '未登录',
    phone: body.phone,
  }
  USERS.push(user)
  addLog('张耕', '新增用户', `${user.name} · ${user.role}`)
  return user
}

export function toggleUser(id: number): SysUser {
  const user = USERS.find(u => u.id === Number(id))
  if (!user) throw new Error('用户不存在')
  user.status = user.status === 'active' ? 'disabled' : 'active'
  addLog('张耕', user.status === 'active' ? '启用用户' : '停用用户', user.name)
  return user
}

/* 供 handlers 使用的通用时间戳 */
export { nowStamp, traceCodeOf }
