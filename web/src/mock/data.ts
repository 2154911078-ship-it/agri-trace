import type {
  PlotOverview, PlotDetail, BatchSummary, TraceVO, TraceEvent, DashboardVO,
} from '@/api'

/* ==========================================================================
   Mock 数据层 · 全部按「作物 + 播期 + 推算」生成，改一处面积/日期整片跟着变
   规模：6 个分区 × 8 块 = 48 块地 · 14 个在田批次 · 6 条追溯码
   ========================================================================== */

/* ---------------- 坐标：1 亩 ≈ 666.7 m²，按真实米制换算经纬 ---------------- */
const LNG0 = 117.4702
const LAT0 = 31.8806
const PW = 0.00100 // 地块东西向 ≈ 95 m
const PH = 0.00086 // 地块南北向 ≈ 95 m
const GX = 0.00008 // 田埂间距 ≈ 8 m
const GY = 0.00007
const DW = PW + GX
const DH = PH + GY
const COLS = 8

export const TODAY = '2026-10-28'
const CN = ['一', '二', '三', '四', '五', '六', '七', '八']

type CropKey = 'grape' | 'rice' | 'rape' | 'berry'

const CROP: Record<
  CropKey,
  {
    name: string
    varieties: string[]
    soils: string[]
    yieldPerMu: number
    areaBase: number
    areaJitter: number
    plantDate: string
    plantDatePrev: string
    totalDays: number
  }
> = {
  grape: {
    name: '阳光玫瑰',
    varieties: ['夏黑', '巨峰'],
    soils: ['壤土', '沙壤土', '黏壤土'],
    yieldPerMu: 550,
    areaBase: 12,
    areaJitter: 2.2,
    plantDate: '2026-05-20',
    plantDatePrev: '2025-05-18',
    totalDays: 160,
  },
  rice: {
    name: '晚稻',
    varieties: ['南粳46', '镇稻11'],
    soils: ['水稻土', '潴育型水稻土'],
    yieldPerMu: 620,
    areaBase: 14,
    areaJitter: 2.4,
    plantDate: '2026-06-12',
    plantDatePrev: '2025-06-10',
    totalDays: 158,
  },
  rape: {
    name: '油菜',
    varieties: ['沣油737', '中油杂19'],
    soils: ['黄棕壤', '黄褐土'],
    yieldPerMu: 210,
    areaBase: 9.5,
    areaJitter: 1.8,
    plantDate: '2026-09-25',
    plantDatePrev: '2025-09-22',
    totalDays: 210,
  },
  berry: {
    name: '草莓',
    varieties: ['红颜', '章姬'],
    soils: ['育苗基质', '沙壤土'],
    yieldPerMu: 1800,
    areaBase: 4.2,
    areaJitter: 0.6,
    plantDate: '2026-09-05',
    plantDatePrev: '2025-09-03',
    totalDays: 150,
  },
}

export const MANAGERS = ['张耕', '张三', '李慧', '王敏', '陈立']

/* ---------------- 分区：A–F，每区 8 块 ---------------- */
type Block = { key: string; farm: string; prefix: string; crops: CropKey[] }

const BLOCKS: Block[] = [
  { key: 'A', farm: '青禾家庭农场', prefix: '东坡', crops: ['grape', 'grape', 'grape', 'grape', 'grape', 'grape', 'grape', 'grape'] },
  { key: 'B', farm: '青禾家庭农场', prefix: '南塘', crops: ['rice', 'rice', 'rice', 'rice', 'rice', 'rice', 'rice', 'rice'] },
  { key: 'C', farm: '青禾西沟基地', prefix: '西沟', crops: ['rice', 'rice', 'rice', 'rice', 'rice', 'rice', 'rice', 'rice'] },
  { key: 'D', farm: '青禾西沟基地', prefix: '北岗', crops: ['rape', 'rape', 'rape', 'rape', 'rape', 'rape', 'rape', 'rape'] },
  { key: 'E', farm: '青禾新圩基地', prefix: '东湖', crops: ['grape', 'grape', 'grape', 'grape', 'berry', 'berry', 'berry', 'berry'] },
  { key: 'F', farm: '青禾新圩基地', prefix: '新圩', crops: ['rape', 'rape', 'rape', 'rape', 'rice', 'rice', 'rice', 'rice'] },
]

export const FARMS = ['青禾家庭农场', '青禾西沟基地', '青禾新圩基地']

/* ---------------- 稳定伪随机 ---------------- */
function rnd(seed: number) {
  let a = (seed * 2654435761) >>> 0
  a ^= a << 13
  a >>>= 0
  a ^= a >>> 17
  a ^= a << 5
  a >>>= 0
  return a / 4294967296
}
const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(rnd(seed) * arr.length) % arr.length]
const round1 = (n: number) => Math.round(n * 10) / 10

/* ---------------- 日期 ---------------- */
const pad = (n: number) => String(n).padStart(2, '0')
function shiftDate(base: string, days: number) {
  const d = new Date(base + 'T00:00:00+08:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function stamp(base: string, days: number, hh: number, mm: number) {
  return `${shiftDate(base, days)} ${pad(hh)}:${pad(mm)}`
}
function daysBetween(a: string, b: string) {
  const t1 = new Date(a + 'T00:00:00+08:00').getTime()
  const t2 = new Date(b + 'T00:00:00+08:00').getTime()
  return Math.max(0, Math.round((t2 - t1) / 86400000))
}

/* ---------------- 状态分布 ---------------- */
function statusOf(i: number): 1 | 2 | 3 | 4 {
  const r = ((i * 2654435761) >>> 0) % 100
  if (r < 6) return 4
  if (r < 13) return 3
  if (r < 33) return 2
  return 1
}

/* ---------------- 农事模板 ---------------- */
type Plan = { type: string; off: number; hh: number; mm: number; detail: string }

function planOf(crop: CropKey, areaMu: number, seed: number): Plan[] {
  const n = Math.round(areaMu * 22) // 株/亩折算
  if (crop === 'grape') {
    return [
      { type: '定植', off: 0, hh: 8, mm: 10, detail: `定植 ${n} 株/亩，苗龄 45 天，株距 2.5 m` },
      { type: '施肥', off: 16, hh: 9, mm: 30, detail: '腐熟有机肥 120 kg/亩 + 复合肥 30 kg/亩，沟施' },
      { type: '打药', off: 39, hh: 7, mm: 40, detail: `吡虫啉 ${40 + Math.round(rnd(seed) * 20)} g/亩，防治蚜虫，安全间隔 14 天` },
      { type: '灌溉', off: 53, hh: 6, mm: 20, detail: `滴灌 ${80 + Math.round(rnd(seed + 3) * 40)} 分钟，用水 18 m³/亩` },
      { type: '打药', off: 87, hh: 8, mm: 0, detail: '代森锰锌 120 g/亩，预防霜霉病，安全间隔 21 天' },
      { type: '疏果', off: 96, hh: 6, mm: 50, detail: '单穗留 45–50 粒，疏除小粒僵果' },
      { type: '灌溉', off: 120, hh: 6, mm: 30, detail: '滴灌 60 分钟，追施高钾水溶肥 5 kg/亩' },
      { type: '除草', off: 132, hh: 15, mm: 10, detail: '行间机械除草，避免伤根' },
      { type: '采收', off: 153, hh: 6, mm: 30, detail: `分级采收，一级果 ${Math.round(areaMu * 340)} kg` },
    ]
  }
  if (crop === 'rice') {
    return [
      { type: '播种', off: 0, hh: 7, mm: 0, detail: `机插秧，行距 30 cm，基本苗 ${Math.round(7 + rnd(seed) * 2)} 万/亩` },
      { type: '施肥', off: 20, hh: 9, mm: 0, detail: '复合肥 35 kg/亩，分蘖肥' },
      { type: '灌溉', off: 35, hh: 6, mm: 0, detail: '浅水勤灌，田面水层 3–5 cm' },
      { type: '打药', off: 60, hh: 7, mm: 20, detail: `氯虫苯甲酰胺 10 ml/亩，防治二化螟` },
      { type: '施肥', off: 78, hh: 9, mm: 20, detail: '尿素 8 kg/亩，穗肥' },
      { type: '打药', off: 100, hh: 7, mm: 30, detail: `吡虫啉 ${35 + Math.round(rnd(seed + 5) * 15)} g/亩，防治稻飞虱，安全间隔 14 天` },
      { type: '晒田', off: 118, hh: 10, mm: 0, detail: '分次晒田，控制无效分蘖' },
      { type: '采收', off: 152, hh: 9, mm: 0, detail: `机械收割，亩产 ${Math.round(560 + rnd(seed) * 90)} kg` },
    ]
  }
  if (crop === 'rape') {
    return [
      { type: '播种', off: 0, hh: 7, mm: 30, detail: '直播，用种量 0.3 kg/亩，行距 40 cm' },
      { type: '施肥', off: 12, hh: 9, mm: 0, detail: '复合肥 30 kg/亩 + 硼砂 1 kg/亩' },
      { type: '除草', off: 20, hh: 14, mm: 30, detail: '苗期化学除草，精喹禾灵 60 ml/亩' },
      { type: '灌溉', off: 28, hh: 6, mm: 40, detail: '沟灌 1 次，灌后及时排干' },
      { type: '打药', off: 41, hh: 8, mm: 10, detail: '菌核净 100 g/亩，预防菌核病' },
    ]
  }
  return [
    { type: '定植', off: 0, hh: 8, mm: 0, detail: `定植 ${Math.round(6000 + rnd(seed) * 1200)} 株/亩，高垄栽培` },
    { type: '施肥', off: 10, hh: 9, mm: 30, detail: '水溶肥 3 kg/亩，滴灌随水施入' },
    { type: '灌溉', off: 18, hh: 6, mm: 20, detail: '滴灌 25 分钟，保持基质湿度 60%' },
    { type: '打药', off: 26, hh: 16, mm: 0, detail: '嘧霉胺 80 g/亩，防治灰霉病，安全间隔 7 天' },
    { type: '疏花', off: 34, hh: 7, mm: 0, detail: '每株留 4–5 个花序，及时摘除老叶' },
  ]
}

/* ---------------- 地块主表 ---------------- */
type Meta = {
  block: string
  farm: string
  no: string
  name: string
  crop: CropKey
  cropName: string
  variety: string
  soil: string
  area: number
  status: 1 | 2 | 3 | 4
  manager: string
  plantDate: string
  growthDays: number
  batchNo?: string
}

function buildMeta(): Meta[] {
  const out: Meta[] = []
  let i = 0
  BLOCKS.forEach(b => {
    b.crops.forEach((crop, k) => {
      const idx = i++
      const id = idx + 1
      const c = CROP[crop]
      const seed = id * 7919 + 13
      const status = statusOf(id)
      const area = round1(c.areaBase + (rnd(seed) - 0.5) * 2 * c.areaJitter)
      const plantDate = status === 3 ? c.plantDatePrev : c.plantDate
      const growthDays = daysBetween(plantDate, TODAY)
      const no = `${b.key}-${String(k + 1).padStart(2, '0')}`
      out.push({
        block: b.key,
        farm: b.farm,
        no,
        name: `${b.prefix}${CN[k]}号`,
        crop,
        cropName: c.name,
        variety: pick(c.varieties, seed + 5),
        soil: pick(c.soils, seed + 9),
        area,
        status,
        manager: pick(MANAGERS, seed + 11),
        plantDate,
        growthDays,
        batchNo: status === 3 ? undefined : `LW-${status === 3 ? '2025' : '2026'}-${b.key}${String(k + 1).padStart(2, '0')}-01`,
      })
    })
  })
  return out
}

const META = buildMeta()

function polygonAt(col: number, row: number) {
  const x0 = LNG0 + col * DW
  const y0 = LAT0 + row * DH
  const x1 = x0 + PW
  const y1 = y0 + PH
  return {
    type: 'Polygon' as const,
    coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
  }
}

export const PLOTS: PlotOverview[] = META.map((m, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  return {
    id: i + 1,
    plotNo: m.no,
    name: m.name,
    cropName: m.cropName,
    variety: m.variety,
    status: m.status,
    areaMu: m.area,
    manager: m.manager,
    batchNo: m.batchNo,
    farmName: m.farm,
    progress: Math.min(1, m.growthDays / CROP[m.crop].totalDays),
    centerLng: LNG0 + col * DW + PW / 2,
    centerLat: LAT0 + row * DH + PH / 2,
    polygon: polygonAt(col, row),
  }
})

export const STATUS_COUNTS = {
  all: PLOTS.length,
  growing: PLOTS.filter(p => p.status === 1).length,
  harvest: PLOTS.filter(p => p.status === 2).length,
  fallow: PLOTS.filter(p => p.status === 3).length,
  alert: PLOTS.filter(p => p.status === 4).length,
}

/* ---------------- 农事记录（按播期推算） ---------------- */
type Rec = { id: number; type: string; happenTime: string; detail: string; operator: string }

function recordsOf(m: Meta, id: number): Rec[] {
  const plan = planOf(m.crop, m.area, id * 31)
  const seed = id * 977
  const list: Plan[] = []
  plan.forEach(p => {
    if (p.type === '采收') {
      if (m.status === 2 || m.status === 3) list.push(p)
      return
    }
    if (p.off <= m.growthDays) list.push(p)
  })

  if (m.status === 2) {
    list.push({
      type: '测产',
      off: m.growthDays,
      hh: 9,
      mm: 40,
      detail: `田间测产 ${Math.round(m.area * CROP[m.crop].yieldPerMu * 0.95)} kg，已开检测单`,
    })
  }
  if (m.status === 4) {
    list.push({
      type: '预警',
      off: m.growthDays,
      hh: 10,
      mm: 15,
      detail: '叶片出现褐斑并局部萎蔫，已取样送检，暂停采收',
    })
  }
  if (m.status === 3) {
    list.push({ type: '清园', off: m.growthDays, hh: 15, mm: 0, detail: '秸秆还田 + 深翻晒垡，休耕养地一季' })
  }

  return list
    .sort((a, b) => b.off - a.off)
    .map((p, k) => ({
      id: id * 100 + (list.length - k),
      type: p.type,
      happenTime: stamp(m.plantDate, p.off, p.hh, p.mm),
      detail: p.detail,
      operator: pick(MANAGERS, seed + k * 7),
    }))
}

const RECORDS = new Map<number, Rec[]>()
META.forEach((m, i) => RECORDS.set(i + 1, recordsOf(m, i + 1)))

export function plotDetail(id: number): PlotDetail {
  const p = PLOTS.find(x => x.id === id) || PLOTS[0]
  const m = META[p.id - 1]
  const c = CROP[m.crop]
  return {
    ...p,
    soilType: m.soil,
    plantDate: m.plantDate,
    growthDays: m.growthDays,
    progress: Math.min(1, m.growthDays / c.totalDays),
    expectYieldKg: Math.round(m.area * c.yieldPerMu),
    records: RECORDS.get(p.id) || [],
  }
}

export const lastRecordAt = (id: number) => RECORDS.get(id)?.[0]?.happenTime

/* ---------------- 概览 ---------------- */
const areaTotal = Math.round(PLOTS.reduce((s, p) => s + p.areaMu, 0) * 10) / 10
const pendingHarvest = PLOTS.filter(p => p.status === 2).length

const cropArea: Record<string, number> = {}
PLOTS.forEach(p => {
  cropArea[p.cropName] = (cropArea[p.cropName] || 0) + p.areaMu
})
const areaSum = Object.values(cropArea).reduce((a, b) => a + b, 0)
const category = Object.entries(cropArea)
  .map(([name, a]) => ({ name, pct: Math.round((a / areaSum) * 100) }))
  .sort((a, b) => b.pct - a.pct)

const alertPlots = PLOTS.filter(p => p.status === 4)
const harvestPlots = PLOTS.filter(p => p.status === 2)

export const DASHBOARD: DashboardVO = {
  areaMu: areaTotal,
  pendingHarvest,
  todayHarvest: 1860,
  passRate: 98.6,
  todayScan: 2147,
  farmCount: FARMS.length,
  plotCount: PLOTS.length,
  activeBatches: PLOTS.filter(p => p.status !== 3).length,
  todos: [
    ...alertPlots.slice(0, 2).map((p, k) => ({
      id: 100 + k,
      level: 'alert' as const,
      time: ['07:05', '08:40'][k] || '08:40',
      title: `${p.plotNo} ${p.name} 异常预警`,
      desc: `叶片褐斑已取样送检，暂停采收 · ${p.cropName}`,
      to: `/plots`,
    })),
    {
      id: 2,
      level: 'warn' as const,
      time: '09:12',
      title: '冷库 B 温度连续 2 小时超限',
      desc: '设定 0–4 ℃，当前 6.8 ℃，已通知仓管',
      to: '/batch/2',
    },
    ...harvestPlots.slice(0, 2).map((p, k) => ({
      id: 200 + k,
      level: 'info' as const,
      time: ['10:40', '11:15'][k] || '11:15',
      title: `${p.plotNo} ${p.cropName} 已到采收期`,
      desc: `预计产量 ${Math.round(p.areaMu * CROP[META[p.id - 1].crop].yieldPerMu).toLocaleString()} kg，待开检测单`,
      to: `/batch/${(p.id % 14) + 1}`,
    })),
    ...alertPlots.slice(2, 3).map(p => ({
      id: 300,
      level: 'warn' as const,
      time: '06:50',
      title: `${p.plotNo} 距安全间隔到期 2 天`,
      desc: '最近一次施药距今不足 14 天，最早可采收 11-08',
      to: '/plots',
    })),
  ].slice(0, 6),
  trend: {
    labels: ['11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],
    data: [1240, 980, 640, 720, 1520, 2380, 1860, 1120, 1460, 2180, 2960, 1860],
  },
  category,
}

/* ---------------- 批次 ---------------- */
export const PEST_ITEMS = [
  { code: 'PEST_CHLORPYRIFOS', name: '毒死蜱', limit: 0.02 },
  { code: 'PEST_CARBOFURAN', name: '克百威', limit: 0.02 },
  { code: 'PEST_OMETHOATE', name: '氧乐果', limit: 0.01 },
  { code: 'PEST_DICHLORVOS', name: '敌敌畏', limit: 0.01 },
  { code: 'PEST_CYPERMETHRIN', name: '氯氰菊酯', limit: 0.07 },
  { code: 'PEST_PHORATE', name: '甲拌磷', limit: 0.01 },
]

export const DEALERS = ['南京众彩果品批发行', '合肥周谷堆农产品市场', '上海江桥批发市场', '杭州勾庄农副市场', '武汉白沙洲市场']
export const CARRIERS = ['顺达冷链', '中通冷链', '万纬物流', '京东冷链']
export const INSPECT_ORGS = ['合肥市农产品质量检测中心', '安徽省农科院检测中心', '肥东县农产品质量安全检测站']

function hexHash(seedStr: string, len = 64) {
  let h = 0x811c9dc5
  let out = ''
  for (let i = 0; i < len; i++) {
    h ^= seedStr.charCodeAt(i % seedStr.length) + i * 131
    h = Math.imul(h, 16777619) >>> 0
    out += (h & 0xf).toString(16)
    h = ((h >>> 4) ^ (h << 3)) >>> 0
  }
  return out
}

const batchOf = new Map<number, number>() // plotId -> batchId
export const BATCH_LIST: BatchSummary[] = []
let batchSeq = 0

META.forEach((m, i) => {
  const plotId = i + 1
  if (m.status === 3 || !m.batchNo) return
  if (batchSeq >= 14) return
  batchSeq++
  const bid = batchSeq
  batchOf.set(plotId, bid)
  const seed = plotId * 613
  const c = CROP[m.crop]
  const harvestDay = m.status === 2 ? m.growthDays + 2 : m.growthDays - 4
  const yieldKg = Math.round(m.area * c.yieldPerMu * 0.92)
  const recs = (RECORDS.get(plotId) || []).slice(0, 6)
  const bad = m.status === 4

  BATCH_LIST.push({
    id: bid,
    batchNo: m.batchNo!,
    cropName: m.cropName,
    variety: m.variety,
    plotNo: m.no,
    farmName: m.farm,
    sowDate: m.plantDate,
    harvestDate: shiftDate(m.plantDate, harvestDay),
    processAt: m.crop === 'berry' ? undefined : shiftDate(m.plantDate, harvestDay + 1),
    codesLastAt: shiftDate(m.plantDate, harvestDay + 3),
    produceCount: recs.length,
    produce: recs.map((r, k) => ({ id: recs.length - k, type: r.type, happenTime: r.happenTime, detail: r.detail })),
    inspect: {
      inspectDate: shiftDate(m.plantDate, harvestDay + 4),
      org: pick(INSPECT_ORGS, seed),
      result: bad ? 2 : 1,
      itemCount: PEST_ITEMS.length,
      items: PEST_ITEMS.map((p, k) => {
        const has = rnd(seed + k) > 0.45
        const val = has ? Math.round(rnd(seed + k * 3) * p.limit * 0.8 * 1000) / 1000 : null
        return { code: p.code, name: p.name, limit: p.limit, value: val, bad: bad && k === 0 }
      }),
      reportUrl: `/files/reports/${m.batchNo}_${shiftDate(m.plantDate, harvestDay + 4)}_${hexHash(m.batchNo, 8)}.pdf`,
    },
    codes: {
      total: Math.round(m.area * 6),
      active: Math.round(m.area * 5.4),
      scanned: Math.round(m.area * (1.2 + rnd(seed) * 2)),
    },
    ship: m.status === 2 ? undefined : {
      carrier: pick(CARRIERS, seed + 2),
      plateNo: `皖A·${['3F279', '8K512', '1M806', '6D437', '9C120'][plotId % 5]}`,
      startTime: stamp(m.plantDate, harvestDay + 3, 6, 40),
    },
    sale: m.status === 2 ? undefined : { dealer: pick(DEALERS, seed + 4), qty: Math.round(yieldKg * 0.62) },
    gaps: bid % 3 === 0
      ? [{ key: 'process', text: '缺少加工环节记录，链路将跳过加工直接进入质检', action: '补录加工', to: '/produce' }]
      : [],
    nextAction: bid % 2 === 0 ? '查看追溯链' : '查看检测单',
    nextActionTo: `/trace/${traceCodeOf(bid)}`,
  })
})

/* 追溯码 */
function traceCodeOf(batchId: number) {
  return `AG34012201${TODAY.replace(/-/g, '').slice(2)}${String(batchId).padStart(4, '0')}A`
}

export const BATCH_BY_ID: Record<number, BatchSummary> = {}
BATCH_LIST.forEach(b => (BATCH_BY_ID[b.id] = b))
export const BATCH: BatchSummary = BATCH_LIST[0]

/* ---------------- 追溯 ---------------- */
const STAGE_BY_TYPE: Record<string, string> = {
  定植: '生产', 播种: '生产', 施肥: '生产', 灌溉: '生产', 打药: '生产', 除草: '生产',
  疏花: '生产', 疏果: '生产', 晒田: '生产', 采收: '采收', 测产: '采收', 清园: '生产',
  预警: '生产', 入库: '仓储',
}

function buildTrace(b: BatchSummary): TraceVO {
  const seedBase = b.batchNo
  const prod = b.produce.slice().sort((x, y) => (x.happenTime < y.happenTime ? -1 : 1))
  const evs: Omit<TraceEvent, 'id' | 'hash'>[] = prod.map(p => ({
    stage: STAGE_BY_TYPE[p.type] || '生产',
    happenTime: p.happenTime,
    title: p.type === '打药' ? '病虫害防治' : p.type,
    detail: p.detail,
    operator: pick(MANAGERS, p.happenTime.length + p.detail.length),
  }))

  if (b.inspect) {
    evs.push({
      stage: '质检',
      happenTime: `${b.inspect.inspectDate} 10:00`,
      title: b.inspect.result === 1 ? `农残 ${b.inspect.itemCount} 项全部合格` : '农残检测 1 项超标',
      detail: `${b.inspect.org} · ${b.batchNo}`,
      operator: '检验员 王敏',
      certUrl: b.inspect.reportUrl,
      alert: b.inspect.result !== 1,
    })
    evs.push({
      stage: '仓储',
      happenTime: `${b.inspect.inspectDate} 15:20`,
      title: '入冷库 A',
      detail: `温度 4 ℃，入库 ${Math.round(b.codes.active * 8)} kg`,
      operator: '仓管 李强',
    })
  }
  if (b.ship) {
    evs.push({
      stage: '物流',
      happenTime: b.ship.startTime,
      title: '发往销地',
      detail: `${b.ship.plateNo} ${b.ship.carrier}，温区 2–8 ℃`,
      operator: '司机 王强',
    })
    evs.push({
      stage: '物流',
      happenTime: `${b.ship.startTime.slice(0, 10)} 09:10`,
      title: '温度短时超限 9.1 ℃',
      detail: '途经服务区，持续 30 分钟已回落',
      operator: '车载采集',
      alert: true,
    })
  }
  if (b.sale) {
    evs.push({
      stage: '销售',
      happenTime: `${b.codesLastAt} 11:30`,
      title: '进入销地批发',
      detail: `${b.sale.dealer}，${b.sale.qty.toLocaleString()} kg`,
      operator: '销售 周敏',
    })
  }

  // 哈希链：每条都挂上一条的摘要
  let prev = hexHash(seedBase, 64)
  const timeline: TraceEvent[] = evs.map((e, k) => {
    const h = hexHash(prev + e.stage + e.title + e.happenTime, 16)
    prev = hexHash(prev + h, 64)
    return { id: k + 1, ...e, hash: h }
  })

  return {
    code: traceCodeOf(b.id),
    batchNo: b.batchNo,
    productName: b.cropName,
    variety: b.variety,
    grade: b.cropName === '晚稻' ? '一级' : b.cropName === '油菜' ? '二级' : '一级',
    packageSpec: b.cropName === '晚稻' ? '25 kg / 袋' : b.cropName === '油菜' ? '50 kg / 袋' : b.cropName === '草莓' ? '0.5 kg / 盒' : '2.5 kg / 箱',
    farmName: b.farmName,
    region: '安徽省合肥市肥东县',
    plotNo: b.plotNo,
    harvestDate: b.harvestDate || b.sowDate || TODAY,
    yieldKg: Math.round((b.codes.total || 100) * 34),
    inspectResult: b.inspect?.result === 1 ? '合格' : '不合格',
    inspectOrg: b.inspect?.org,
    reportNo: b.inspect ? `HF2026-${b.inspect.inspectDate.replace(/-/g, '').slice(4)}-${String(b.id).padStart(4, '0')}` : undefined,
    reportUrl: b.inspect?.reportUrl,
    firstScan: b.id % 4 === 0,
    scanCount: 1 + (b.id % 7),
    timeline,
    dataHash: prev,
    chainTx: '0x' + hexHash(prev + 'chain', 64),
  }
}

export const TRACE_BY_CODE: Record<string, TraceVO> = {}
BATCH_LIST.forEach(b => {
  const t = buildTrace(b)
  TRACE_BY_CODE[t.code] = t
})

export const TRACE: TraceVO = TRACE_BY_CODE[traceCodeOf(BATCH_LIST[0].id)]
export const TRACE_CODES = Object.keys(TRACE_BY_CODE)

/* ---------------- 供表格/详情页复用 ---------------- */
export const plotById = (id: number) => PLOTS.find(p => p.id === id)
export const batchIdOfPlot = (plotId: number) => batchOf.get(plotId)
export { traceCodeOf }