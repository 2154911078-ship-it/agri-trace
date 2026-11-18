<template>
  <div class="order-page">
    <header class="page-head">
      <div>
        <p class="kicker">销售订单 · ORDERS</p>
        <h1>订单</h1>
        <p>客户档案、订单确认、发货、结算与退货。</p>
      </div>
      <div class="head-acts">
        <button class="ghost" @click="load">刷新</button>
        <button class="ghost" @click="openCustomer">新增客户</button>
        <button class="primary" @click="openOrder">新建订单</button>
      </div>
    </header>

    <div class="stats">
      <div><span>订单数</span><b>{{ page?.total ?? '—' }}</b><em>单</em></div>
      <div><span>订单金额</span><b>{{ (page?.amount || 0).toLocaleString() }}</b><em>元</em></div>
      <div><span>待确认 / 已结算</span><b>{{ page?.pending ?? 0 }} / {{ page?.settled ?? 0 }}</b></div>
      <div><span>退货</span><b class="bad">{{ page?.returned ?? 0 }}</b><em>单</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: tab === 'orders' }" @click="tab = 'orders'">订单</button>
        <button :class="{ on: tab === 'customers' }" @click="tab = 'customers'">客户（{{ customers.length }}）</button>
      </div>
      <div class="right" v-if="tab === 'orders'">
        <input v-model="kw" class="m-search" placeholder="搜单号 / 客户 / 批次" />
        <select v-model="status" class="m-select">
          <option :value="null">全部状态</option>
          <option v-for="s in STATUS" :key="s.v" :value="s.v">{{ s.t }}</option>
        </select>
      </div>
    </div>

    <div class="tbl-wrap" v-if="tab === 'orders'">
      <table class="tbl">
        <thead><tr><th>单号</th><th>客户</th><th>批次</th><th class="num-r">数量</th><th class="num-r">金额</th><th>状态</th><th>下单时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="o in page?.records || []" :key="o.id">
            <td class="mono strong">{{ o.orderNo }}</td>
            <td>{{ o.customerName }}</td>
            <td class="mono">{{ o.batchNo }}<span class="sub"> · {{ o.cropName }}</span>
              <span v-if="o.shipNo" class="sub"> · 物流 {{ o.shipNo }}（{{ shipStatusText(o.shipStatus) }}）</span>
              <span v-else-if="o.status === 'CONFIRMED'" class="sub warn-text"> · 未建运输单</span>
              <span v-if="o.returnQty" class="sub"> · 已退 {{ o.returnQty }} kg</span>
            </td>
            <td class="num-r">{{ o.qtyKg.toLocaleString() }} kg</td>
            <td class="num-r">{{ o.amount.toLocaleString() }} 元</td>
            <td><span class="m-tag" :class="statusClass(o.status)">{{ statusText(o.status) }}</span></td>
            <td class="mono sub">{{ o.orderTime }}</td>
            <td>
              <button v-if="o.status === 'PENDING'" class="m-link" @click="move(o, 'confirm')">确认</button>
              <button v-if="o.status === 'CONFIRMED' && o.shipNo" class="m-link" @click="move(o, 'ship')">发货</button>
              <router-link v-if="o.status === 'CONFIRMED' && !o.shipNo" class="m-link" to="/ship">建运输单</router-link>
              <button v-if="o.status === 'SHIPPED'" class="m-link" @click="move(o, 'settle')">结算</button>
              <button v-if="['CONFIRMED','SHIPPED','SETTLED'].includes(o.status)" class="m-link danger" @click="openReturn(o)">退货</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">当前筛选下没有订单。</div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; loadOrders() }" />
    </div>

    <div class="tbl-wrap" v-else>
      <table class="tbl">
        <thead><tr><th>客户</th><th>类型</th><th>联系人</th><th>电话</th><th>地址</th><th class="num-r">订单数</th><th class="num-r">累计金额</th></tr></thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td class="strong">{{ c.name }}</td>
            <td>{{ c.type }}</td>
            <td>{{ c.contact || '—' }}</td>
            <td class="mono">{{ c.phone || '—' }}</td>
            <td class="sub">{{ c.address || '—' }}</td>
            <td class="num-r">{{ c.orderCount }}</td>
            <td class="num-r">{{ Number(c.totalAmount || 0).toLocaleString() }} 元</td>
          </tr>
        </tbody>
      </table>
    </div>

    <SlidePanel :open="orderOpen" title="新建订单" kicker="NEW ORDER" @close="orderOpen = false">
      <form class="m-form" @submit.prevent="submitOrder">
        <label class="m-field full">
          <span>客户</span>
          <select v-model.number="orderForm.customerId" required>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="m-field full">
          <span>批次</span>
          <select v-model.number="orderForm.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.cropName }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>数量（kg）</span>
          <input v-model.number="orderForm.qtyKg" type="number" min="1" required />
        </label>
        <label class="m-field">
          <span>单价（元/kg）</span>
          <input v-model.number="orderForm.price" type="number" min="0.1" step="0.1" required />
        </label>
        <label class="m-field full">
          <span>预计交付</span>
          <input v-model="orderForm.deliveryDate" type="date" />
        </label>
        <label class="m-field full">
          <span>备注</span>
          <input v-model.trim="orderForm.note" placeholder="配送要求 / 结算方式" />
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="orderOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '提交中…' : '创建订单' }}</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel :open="customerOpen" title="新增客户" kicker="NEW CUSTOMER" @close="customerOpen = false">
      <form class="m-form" @submit.prevent="submitCustomer">
        <label class="m-field full"><span>客户名称</span><input v-model.trim="customerForm.name" required /></label>
        <label class="m-field"><span>类型</span><input v-model.trim="customerForm.type" /></label>
        <label class="m-field"><span>联系人</span><input v-model.trim="customerForm.contact" /></label>
        <label class="m-field"><span>电话</span><input v-model.trim="customerForm.phone" /></label>
        <label class="m-field full"><span>地址</span><input v-model.trim="customerForm.address" /></label>
        <label class="m-field full"><span>备注</span><input v-model.trim="customerForm.note" /></label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="customerOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">保存客户</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel :open="!!returnTarget" title="订单退货" kicker="RETURN" @close="returnTarget = null">
      <form v-if="returnTarget" class="m-form" @submit.prevent="submitReturn">
        <p class="sub">订单 {{ returnTarget.orderNo }} · {{ returnTarget.customerName }}，原数量 {{ returnTarget.qtyKg }} kg。</p>
        <label class="m-field"><span>退货数量（kg）</span><input v-model.number="returnQty" type="number" min="0.1" required /></label>
        <label class="m-field full"><span>退货原因</span><textarea v-model.trim="returnReason" required /></label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="returnTarget = null">取消</button>
          <button type="submit" class="primary" :disabled="saving">确认退货</button>
        </div>
      </form>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { apiBatches } from '@/api'
import {
  apiCreateCustomer, apiCreateOrder, apiCustomers, apiOrderAction, apiOrders,
  type CustomerRow, type OrderPage, type OrderRow,
} from '@/api/p0'
import { toast } from '@/utils/toast'

const page = ref<OrderPage | null>(null)
const customers = ref<CustomerRow[]>([])
const batches = ref<{ id: number; batchNo: string; cropName: string }[]>([])
const loading = ref(false)
const saving = ref(false)
const tab = ref<'orders' | 'customers'>('orders')
const status = ref<string | null>(null)
const kw = ref('')
const pageNo = ref(1)
const size = 10
const orderOpen = ref(false)
const customerOpen = ref(false)
const returnTarget = ref<OrderRow | null>(null)
const returnQty = ref(0)
const returnReason = ref('')
const orderForm = reactive({ customerId: 0, batchId: 0, qtyKg: 500, price: 10, deliveryDate: '', note: '' })
const customerForm = reactive({ name: '', type: '经销商', contact: '', phone: '', address: '', note: '' })

const STATUS = [
  { v: 'PENDING', t: '待确认' }, { v: 'CONFIRMED', t: '已确认' }, { v: 'SHIPPED', t: '已发货' },
  { v: 'SETTLED', t: '已结算' }, { v: 'RETURNED', t: '已退货' },
]
const statusText = (s: string) => STATUS.find(x => x.v === s)?.t || s
const statusClass = (s: string) => s === 'PENDING' ? 'warn' : s === 'RETURNED' ? 'bad' : 'ok'
const shipStatusText = (s?: number) => s === 3 ? '已签收' : s === 4 ? '温度异常' : s ? '运输中' : '未发运'

async function load() {
  loading.value = true
  try {
    const [cs, bs] = await Promise.all([apiCustomers(), apiBatches().catch(() => [])])
    customers.value = cs
    batches.value = bs.filter(b => b.status !== 'BLOCKED').map(b => ({ id: b.id, batchNo: b.batchNo, cropName: b.cropName }))
    await loadOrders()
  } catch (e: any) {
    toast(e?.message || '订单数据读取失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadOrders() {
  try {
    page.value = await apiOrders({ status: status.value, kw: kw.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '订单读取失败', 'error')
  }
}

function openOrder() {
  orderForm.customerId = customers.value[0]?.id || 0
  orderForm.batchId = batches.value[0]?.id || 0
  orderForm.qtyKg = 500
  orderForm.price = 10
  orderForm.deliveryDate = ''
  orderForm.note = ''
  orderOpen.value = true
}

function openCustomer() {
  Object.assign(customerForm, { name: '', type: '经销商', contact: '', phone: '', address: '', note: '' })
  customerOpen.value = true
}

async function submitOrder() {
  saving.value = true
  try {
    await apiCreateOrder(orderForm)
    toast('订单已创建，待确认')
    orderOpen.value = false
    pageNo.value = 1
    await load()
  } catch (e: any) {
    toast(e?.message || '创建失败', 'error')
  } finally {
    saving.value = false
  }
}

async function submitCustomer() {
  saving.value = true
  try {
    await apiCreateCustomer(customerForm)
    toast('客户已创建')
    customerOpen.value = false
    await load()
  } catch (e: any) {
    toast(e?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function move(o: OrderRow, action: 'confirm' | 'ship' | 'settle') {
  try {
    await apiOrderAction(o.id, action)
    toast(action === 'confirm' ? '订单已确认' : action === 'ship' ? '订单已发货' : '订单已结算')
    await load()
  } catch (e: any) {
    toast(e?.message || '操作失败', 'error')
  }
}

function openReturn(o: OrderRow) {
  returnTarget.value = o
  returnQty.value = o.qtyKg
  returnReason.value = ''
}

async function submitReturn() {
  if (!returnTarget.value) return
  saving.value = true
  try {
    await apiOrderAction(returnTarget.value.id, 'return', { qtyKg: returnQty.value, reason: returnReason.value })
    toast('退货已登记')
    returnTarget.value = null
    await load()
  } catch (e: any) {
    toast(e?.message || '退货失败', 'error')
  } finally {
    saving.value = false
  }
}

let timer = 0
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => { pageNo.value = 1; loadOrders() }, 300)
})
watch(status, () => { pageNo.value = 1; loadOrders() })
onMounted(load)
</script>

<style scoped>
.order-page { display: flex; flex-direction: column; gap: 18px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.kicker { margin: 0 0 6px; font-size: 10.5px; letter-spacing: .08em; color: var(--ink-3); }
h1 { margin: 0 0 6px; font-family: var(--font-serif); font-size: 30px; font-weight: 500; }
.page-head p { margin: 0; font-size: 12px; color: var(--ink-3); }
.head-acts { display: flex; gap: 8px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); }
.stats div { padding: 16px 18px; border-right: 1px solid var(--line); }
.stats div:last-child { border-right: 0; }
.stats span { display: block; font-size: 11px; color: var(--ink-3); margin-bottom: 6px; }
.stats b { font-family: var(--font-num); font-size: 24px; font-weight: 500; }
.stats b.bad { color: var(--alert); }
.stats em { font-style: normal; font-size: 11px; color: var(--ink-3); margin-left: 4px; }
.tbl-wrap { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); padding: 4px 16px 12px; }
.empty { padding: 36px 0; text-align: center; color: var(--ink-3); font-size: 12px; }
.danger { color: var(--alert); }
.warn-text { color: var(--warn, #b47b1f); }
</style>
