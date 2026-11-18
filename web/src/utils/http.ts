import { handleMock } from '@/mock/handlers'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const BASE = import.meta.env.VITE_API_BASE || ''

const TOKEN_KEY = 'agri_token'
/** 开发态截图 / 直链调试：?demo=1 时给一个假 token，生产构建里会被摇掉 */
export const getToken = () => {
  if (import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('demo=1')) {
    return 'dev-preview'
  }
  return localStorage.getItem(TOKEN_KEY)
}
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface ApiError extends Error {
  code?: number
}

async function request<T>(method: 'GET' | 'POST', path: string, payload?: any): Promise<T> {
  if (USE_MOCK) {
    await sleep(160 + Math.random() * 220)
    return handleMock<T>(method, path, payload)
  }

  const url = new URL((BASE || '') + '/api' + path, location.origin)
  if (method === 'GET') {
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    })
    const farm = localStorage.getItem('agri_farm_id')
    const exempt = path.startsWith('/auth') || path.startsWith('/sys') || path.startsWith('/plots/overview')
    if (farm && !exempt && !url.searchParams.has('farmId')) url.searchParams.set('farmId', farm)
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    const err: ApiError = new Error(body.msg || `请求失败 ${res.status}`)
    err.code = body.code ?? res.status
    throw err
  }
  return (body.data !== undefined ? body.data : body) as T
}

export const get = <T>(path: string, params?: any) => request<T>('GET', path, params)
export const post = <T>(path: string, body?: any) => request<T>('POST', path, body)
export async function upload<T>(path: string, file: File): Promise<T> {
  if (USE_MOCK) throw new Error('Mock 模式不支持上传，请连接真实后端')
  const url = new URL((BASE || '') + '/api' + path, location.origin)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    const err: ApiError = new Error(body.msg || `上传失败 ${res.status}`)
    err.code = body.code ?? res.status
    throw err
  }
  return (body.data !== undefined ? body.data : body) as T
}
