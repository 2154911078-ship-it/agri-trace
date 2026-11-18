import { get, post } from '@/utils/http'
import type { AlertRow, InspectionRow } from '@/api'

export interface WarehouseRow {
  id: number
  name: string
  type: string
  location: string
  tempMin: number
  tempMax: number
  capacityKg: number
  manager: string
  stockKg: number
  inKg: number
  outKg: number
  lossKg: number
  utilization: number
  latestTemp?: number
  latestHumidity?: number
  lastRecordAt?: string
}
export interface StorageInventoryRow {
  batchId: number
  batchNo: string
  cropName: string
  plotNo: string
  farmName: string
  inKg: number
  outKg: number
  lossKg: number
  stockKg: number
  warehouses: string
  lastAt: string
}
export interface StorageLedgerRow {
  id: number
  type: 'IN' | 'OUT' | 'LOSS'
  quantityKg: number
  operator: string
  note?: string
  happenTime: string
  batchId: number
  batchNo: string
  plotNo: string
  farmName: string
  cropName: string
  warehouseName: string
}
export interface StoragePage {
  records: StorageLedgerRow[]
  total: number
  inKg: number
  outKg: number
  lossKg: number
}
export const apiWarehouses = () => get<WarehouseRow[]>('/warehouses')
export const apiStorageInventory = () =>
  get<{ records: StorageInventoryRow[]; total: number; stockKg: number }>('/storage/inventory')
export const apiStorageLedger = (q: { type?: string; kw?: string; page?: number; size?: number } = {}) =>
  get<StoragePage>('/storage/ledger', q)
export const apiStorageInbound = (body: { batchId: number; warehouseId: number; quantityKg: number; operator?: string; note?: string; happenTime?: string }) =>
  post<StorageLedgerRow>('/storage/inbound', body)
export const apiStorageOutbound = (body: { batchId: number; warehouseId: number; quantityKg: number; type?: 'OUT' | 'LOSS'; operator?: string; note?: string; happenTime?: string }) =>
  post<StorageLedgerRow>('/storage/outbound', body)
export const apiStorageTemperature = (body: { warehouseId: number; temp: number; humidity?: number }) =>
  post<{ warehouseId: number; temp: number; humidity?: number; time: string }>('/storage/temperature', body)

export interface InputItemRow {
  id: number
  name: string
  type: string
  ingredient: string
  safeDays: number
  maxDosage: number
  unit: string
  licenseNo: string
  stock: number
  purchased: number
  used: number
  lowStock: boolean
}
export interface InputLedgerRow {
  id: number
  type: 'PURCHASE' | 'USE'
  quantity: number
  unit: string
  operator: string
  note?: string
  happenTime: string
  itemName: string
  itemType: string
  safeDays: number
  batchId?: number
  batchNo?: string
  plotNo?: string
  farmName?: string
}
export interface InputPage {
  records: InputLedgerRow[]
  total: number
  purchaseQty: number
  useQty: number
}
export const apiInputs = () =>
  get<{ records: InputItemRow[]; total: number; stock: number; lowStock: number }>('/inputs')
export const apiInputLedger = (q: { kw?: string; page?: number; size?: number } = {}) =>
  get<InputPage>('/inputs/ledger', q)
export const apiInputPurchase = (body: { itemId: number; quantity: number; operator?: string; note?: string; happenTime?: string }) =>
  post('/inputs/purchase', body)
export const apiInputUse = (body: { itemId: number; batchId: number; quantity: number; operator?: string; note?: string; happenTime?: string }) =>
  post<{ stockAfter: number; safeDays: number; produceId: number; detail: string }>('/inputs/use', body)

export interface LabelData {
  segment: {
    id: number
    batchId: number
    batchNo: string
    cropName: string
    farmName: string
    prefix: string
    count: number
    activated: number
    frozen: boolean
    status: string
  }
  batch: { batchNo: string; cropName: string; variety?: string; farmName: string; plotNo: string; harvestDate?: string }
  codes: { code: string; seq: number; status: number; scanCount: number }[]
  total: number
}
export const apiSegmentCodes = (id: number, limit = 40) =>
  get<LabelData>(`/codes/segments/${id}/codes`, { limit })
export const apiFreezeSegment = (id: number) => post(`/codes/segments/${id}/freeze`)
export const apiUnfreezeSegment = (id: number) => post(`/codes/segments/${id}/unfreeze`)

export interface CustomerRow {
  id: number
  name: string
  type: string
  contact?: string
  phone?: string
  address?: string
  note?: string
  orderCount?: number
  totalAmount?: number
}
export interface OrderRow {
  id: number
  orderNo: string
  qtyKg: number
  price: number
  amount: number
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'SETTLED' | 'RETURNED'
  orderTime: string
  deliveryDate?: string
  note?: string
  customerId: number
  customerName: string
  customerPhone?: string
  batchId: number
  batchNo: string
  plotNo: string
  farmName: string
  cropName: string
  shipNo?: string
  shipStatus?: number
  returnQty?: number
}
export interface OrderPage {
  records: OrderRow[]
  total: number
  pending: number
  confirmed: number
  shipped: number
  settled: number
  returned: number
  amount: number
  qtyKg: number
}
export const apiCustomers = (kw = '') => get<CustomerRow[]>('/customers', { kw })
export const apiCreateCustomer = (body: Partial<CustomerRow>) => post<CustomerRow>('/customers', body)
export const apiOrders = (q: { status?: string | null; kw?: string; page?: number; size?: number } = {}) =>
  get<OrderPage>('/orders', q)
export const apiCreateOrder = (body: { customerId: number; batchId: number; qtyKg: number; price: number; deliveryDate?: string; note?: string }) =>
  post<OrderRow>('/orders', body)
export const apiOrderAction = (id: number, action: 'confirm' | 'ship' | 'settle' | 'return', body: Record<string, unknown> = {}) =>
  post<OrderRow>(`/orders/${id}/${action}`, body)

export interface InspectTemplateItem { code: string; name: string; limit: number }
export interface InspectTemplate { id: number; name: string; items: InspectTemplateItem[] }
export const apiInspectTemplates = () => get<InspectTemplate[]>('/inspect-templates')
export const apiCreateInspectTemplate = (body: { name: string; items: InspectTemplateItem[] }) =>
  post<InspectTemplate>('/inspect-templates', body)
export const apiRecheckInspect = (id: number, body: { org: string; inspectDate: string; templateId?: number; items: { code: string; value: number | null }[] }) =>
  post<InspectionRow>(`/inspects/${id}/recheck`, body)
export const apiDisposeInspect = (id: number, body: { action: 'RETURN' | 'DESTROY' | 'DOWNGRADE'; note?: string }) =>
  post<{ id: number; batchNo: string; disposal: string; disposalNote?: string; disposeTime: string }>(`/inspects/${id}/dispose`, body)

export interface NotificationRow {
  id: number
  title: string
  content: string
  category: string
  level: 'info' | 'warn' | 'alert'
  channel: 'INBOX' | 'SMS' | 'WECOM'
  status: 0 | 1
  link?: string
  escalated: number
  createTime: string
  readAt?: string
}
export const apiNotifications = (q: { status?: number | null; channel?: string | null; page?: number; size?: number } = {}) =>
  get<{ records: NotificationRow[]; total: number; unread: number }>('/notifications', q)
export const apiNotificationSummary = () => get<{ unread: number }>('/notifications/summary')
export const apiReadNotification = (id: number) => post<{ unread: number }>(`/notifications/${id}/read`)
export const apiReadAllNotifications = () => post<{ updated: number; unread: number }>('/notifications/read-all')
export const apiAssignAlert = (id: number, userId: number) => post<AlertRow>(`/alerts/${id}/assign`, { userId })
