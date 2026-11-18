import { PLOTS, plotDetail, DASHBOARD, BATCH, BATCH_BY_ID, TRACE_BY_CODE, TRACE, STATUS_COUNTS, lastRecordAt, batchIdOfPlot } from './data'
import {
  producePage, createProduce, inspectPage, createInspection,
  codesPage, generateCodes, activateSegment, voidSegment,
  shipPage, createShipment, signShipment,
  traceLogPage, traceVerify, sysPage, createUser, toggleUser,
} from './modules'
import type { PageResult, PlotRow } from '@/api'

class MockError extends Error {
  code: number
  constructor(msg: string, code = 400) {
    super(msg)
    this.code = code
  }
}

const run = <T,>(fn: () => T): T => {
  try {
    return fn()
  } catch (e) {
    throw new MockError(e instanceof Error ? e.message : String(e), 400)
  }
}

export async function handleMock<T>(method: 'GET' | 'POST', path: string, payload?: any): Promise<T> {
  const clean = path.split('?')[0]

  /* ---------------- 登录 ---------------- */
  if (method === 'POST' && clean === '/auth/login') {
    const { username, password } = payload || {}
    if (!username || !password) throw new MockError('账号和密码都要填')
    if (password.length < 3) throw new MockError('账号或密码不正确')
    return {
      token: 'mock.' + Date.now().toString(36),
      name: '张耕',
      roleName: '合作社管理员',
    } as unknown as T
  }

  /* ---------------- 概览 ---------------- */
  if (clean === '/dashboard/overview') return DASHBOARD as unknown as T

  /* ---------------- 地块 ---------------- */
  if (clean === '/plots/overview') return PLOTS as unknown as T

  if (clean === '/plots/page') {
    const { page = 1, size = 20, status = null, crop = null, kw = '' } = payload || {}
    let rows: PlotRow[] = PLOTS.map(p => ({
      id: p.id,
      plotNo: p.plotNo,
      name: p.name,
      cropName: p.cropName,
      variety: p.variety,
      areaMu: p.areaMu,
      status: p.status,
      batchNo: p.batchNo,
      manager: p.manager,
      lastRecordAt: lastRecordAt(p.id),
    }))
    if (status) rows = rows.filter(r => r.status === status)
    if (crop) rows = rows.filter(r => r.cropName === crop)
    if (kw) {
      const k = String(kw).toLowerCase()
      rows = rows.filter(r =>
        r.plotNo.toLowerCase().includes(k) ||
        r.name.includes(kw) ||
        r.cropName.includes(kw))
    }
    const total = rows.length
    const start = (Number(page) - 1) * Number(size)
    const records = rows.slice(start, start + Number(size))
    const out: PageResult = {
      records,
      total,
      growing: STATUS_COUNTS.growing,
      alerted: STATUS_COUNTS.alert,
      counts: STATUS_COUNTS,
    }
    return out as unknown as T
  }

  const detailMatch = clean.match(/^\/plots\/(\d+)\/detail$/)
  if (detailMatch) return plotDetail(Number(detailMatch[1])) as unknown as T

  /* ---------------- 批次 ---------------- */
  if (clean === '/batches') return Object.values(BATCH_BY_ID) as unknown as T

  const batchMatch = clean.match(/^\/batches\/(\d+)$/)
  if (batchMatch) {
    const id = Number(batchMatch[1])
    return (BATCH_BY_ID[id] || BATCH) as unknown as T
  }

  const plotBatchMatch = clean.match(/^\/plots\/(\d+)\/batch$/)
  if (plotBatchMatch) {
    const bid = batchIdOfPlot(Number(plotBatchMatch[1]))
    return (bid ? BATCH_BY_ID[bid] : null) as unknown as T
  }

  /* ---------------- 追溯 ---------------- */
  if (clean === '/trace/logs') return traceLogPage(payload) as unknown as T

  const verifyMatch = clean.match(/^\/trace\/([^/]+)\/verify$/)
  if (verifyMatch) return traceVerify(decodeURIComponent(verifyMatch[1])) as unknown as T

  const traceMatch = clean.match(/^\/trace\/(.+)$/)
  if (traceMatch) {
    const code = decodeURIComponent(traceMatch[1])
    const hit = TRACE_BY_CODE[code]
    if (!hit) throw new MockError('追溯码不存在', 404)
    return hit as unknown as T
  }

  /* ---------------- 生产 ---------------- */
  if (clean === '/produce/records') {
    if (method === 'POST') return run(() => createProduce(payload)) as unknown as T
    return producePage(payload) as unknown as T
  }

  /* ---------------- 质检 ---------------- */
  if (clean === '/inspects') {
    if (method === 'POST') return run(() => createInspection(payload)) as unknown as T
    return inspectPage(payload) as unknown as T
  }

  /* ---------------- 赋码 ---------------- */
  if (clean === '/codes/segments') {
    if (method === 'POST') return run(() => generateCodes(payload)) as unknown as T
    return codesPage(payload) as unknown as T
  }
  const codeAct = clean.match(/^\/codes\/segments\/(\d+)\/activate$/)
  if (codeAct && method === 'POST') return run(() => activateSegment(Number(codeAct[1]))) as unknown as T
  const codeVoid = clean.match(/^\/codes\/segments\/(\d+)\/void$/)
  if (codeVoid && method === 'POST') return run(() => voidSegment(Number(codeVoid[1]))) as unknown as T

  /* ---------------- 物流 ---------------- */
  if (clean === '/shipments') {
    if (method === 'POST') return run(() => createShipment(payload)) as unknown as T
    return shipPage(payload) as unknown as T
  }
  const signMatch = clean.match(/^\/shipments\/(\d+)\/sign$/)
  if (signMatch && method === 'POST') return run(() => signShipment(Number(signMatch[1]), payload?.by)) as unknown as T

  /* ---------------- 系统 ---------------- */
  if (clean === '/sys' && method === 'GET') return sysPage() as unknown as T
  if (clean === '/sys/users' && method === 'POST') return run(() => createUser(payload)) as unknown as T
  const userToggle = clean.match(/^\/sys\/users\/(\d+)\/toggle$/)
  if (userToggle && method === 'POST') return run(() => toggleUser(Number(userToggle[1]))) as unknown as T

  throw new MockError(`Mock 未实现：${method} ${clean}`, 404)
}