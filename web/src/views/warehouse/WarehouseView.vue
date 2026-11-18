<template>
  <div class="wh-page">
    <header class="page-head">
      <div>
        <p class="kicker">冷链仓储 · WAREHOUSE</p>
        <h1>仓储</h1>
        <p>入库、出库、报损与冷库温控，库存按批次实时汇总。</p>
      </div>
      <div class="head-acts">
        <button class="ghost" @click="load">刷新</button>
        <button class="primary" @click="openForm('IN')">入库登记</button>
      </div>
    </header>

    <div class="stats">
      <div><span>库房</span><b>{{ warehouses.length }}</b><em>座</em></div>
      <div><span>当前库存</span><b>{{ inventory.stockKg?.toLocaleString() ?? '—' }}</b><em>kg</em></div>
      <div><span>累计入库</span><b>{{ inTotal.toLocaleString() }}</b><em>kg</em></div>
      <div><span>累计损耗</span><b class="bad">{{ lossTotal.toLocaleString() }}</b><em>kg</em></div>
    </div>

    <div class="cards">
      <article v-for="w in warehouses" :key="w.id" class="wh-card">
        <header>
          <div>
            <h3>{{ w.name }}</h3>
            <p>{{ w.type }} · {{ w.location }} · {{ w.manager }}</p>
          </div>
          <span class="temp" :class="{ off: isTempOff(w) }">
            {{ w.latestTemp != null ? w.latestTemp + '℃' : '—' }}
            <small>{{ w.latestHumidity != null ? w.latestHumidity + '%RH' : '' }}</small>
          </span>
        </header>
        <div class="bar"><i :style="{ width: Math.min(100, w.utilization) + '%' }" /></div>
        <p class="cap">库存 {{ w.stockKg.toLocaleString() }} / {{ w.capacityKg.toLocaleString() }} kg · 利用率 {{ w.utilization }}%</p>
        <button class="m-link" @click="openForm('TEMP', w)">记录温湿度</button>
      </article>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: tab === 'stock' }" @click="tab = 'stock'">批次库存</button>
        <button :class="{ on: tab === 'ledger' }" @click="tab = 'ledger'">出入库台账</button>
      </div>
      <div class="right" v-if="tab === 'ledger'">
        <input v-model="kw" class="m-search" placeholder="搜批次 / 作物 / 库房" />
        <select v-model="type" class="m-select">
          <option value="">全部类型</option>
          <option value="IN">入库</option>
          <option value="OUT">出库</option>
          <option value="LOSS">损耗</option>
        </select>
      </div>
    </div>

    <div class="tbl-wrap" v-if="tab === 'stock'">
      <table class="tbl">
        <thead><tr><th>批次</th><th>作物</th><th>基地 / 地块</th><th class="num-r">入库</th><th class="num-r">出库</th><th class="num-r">损耗</th><th class="num-r">库存</th><th>库房</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="r in inventory.records" :key="r.batchId">
            <td class="mono">{{ r.batchNo }}</td>
            <td>{{ r.cropName }}</td>
            <td>{{ r.farmName }}<span class="sub"> · {{ r.plotNo }}</span></td>
            <td class="num-r">{{ r.inKg.toLocaleString() }}</td>
            <td class="num-r">{{ r.outKg.toLocaleString() }}</td>
            <td class="num-r">{{ r.lossKg.toLocaleString() }}</td>
            <td class="num-r strong">{{ r.stockKg.toLocaleString() }}</td>
            <td class="sub">{{ r.warehouses }}</td>
            <td>
              <button class="m-link" @click="openForm('OUT', null, r)">出库</button>
              <button class="m-link danger" @click="openForm('LOSS', null, r)">报损</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!inventory.records.length" class="empty">当前农场暂无库存。</div>
    </div>

    <div class="tbl-wrap" v-else>
      <table class="tbl">
        <thead><tr><th>时间</th><th>类型</th><th>批次</th><th>作物</th><th class="num-r">数量</th><th>库房</th><th>经办</th><th>备注</th></tr></thead>
        <tbody>
          <tr v-for="r in ledger?.records || []" :key="r.id">
            <td class="mono sub">{{ r.happenTime }}</td>
            <td><span class="m-tag" :class="r.type === 'IN' ? 'ok' : r.type === 'LOSS' ? 'bad' : 'warn'">{{ typeText(r.type) }}</span></td>
            <td class="mono">{{ r.batchNo }}</td>
            <td>{{ r.cropName }}<span class="sub"> · {{ r.farmName }}</span></td>
            <td class="num-r strong">{{ r.quantityKg.toLocaleString() }} kg</td>
            <td>{{ r.warehouseName }}</td>
            <td>{{ r.operator }}</td>
            <td class="sub">{{ r.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(ledger?.records || []).length" class="empty">当前筛选下没有台账。</div>
      <MPager :page="pageNo" :size="size" :total="ledger?.total || 0" @change="p => { pageNo = p; loadLedger() }" />
    </div>

    <SlidePanel :open="formOpen" :title="formTitle" kicker="STORAGE" @close="formOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field full" v-if="form.type !== 'TEMP'">
          <span>批次</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }} {{ b.cropName }}</option>
          </select>
        </label>
        <label class="m-field" v-if="form.type !== 'TEMP'">
          <span>库房</span>
          <select v-model.number="form.warehouseId" required>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label class="m-field" v-if="form.type === 'TEMP'">
          <span>库房</span>
          <select v-model.number="form.warehouseId" required>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label class="m-field" v-if="form.type === 'TEMP'">
          <span>温度（℃）</span>
          <input v-model.number="form.temp" type="number" step="0.1" required />
        </label>
        <label class="m-field" v-if="form.type === 'TEMP'">
          <span>湿度（%RH）</span>
          <input v-model.number="form.humidity" type="number" step="0.1" />
        </label>
        <label class="m-field" v-if="form.type !== 'TEMP'">
          <span>数量（kg）</span>
          <input v-model.number="form.quantityKg" type="number" min="1" step="0.1" required />
        </label>
        <label class="m-field" v-if="form.type !== 'TEMP'">
          <span>经办人</span>
          <input v-model.trim="form.operator" required />
        </label>
        <label class="m-field full" v-if="form.type !== 'TEMP'">
          <span>时间</span>
          <input v-model="form.happenTime" type="datetime-local" />
        </label>
        <label class="m-field full" v-if="form.type !== 'TEMP'">
          <span>备注</span>
          <textarea v-model.trim="form.note" placeholder="入库来源 / 出库去向 / 损耗原因" />
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="formOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </form>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { apiBatches } from '@/api'
import {
  apiStorageInbound, apiStorageInventory, apiStorageLedger, apiStorageOutbound,
  apiStorageTemperature, apiWarehouses, type StorageInventoryRow, type StoragePage,
  type StorageLedgerRow, type WarehouseRow,
} from '@/api/p0'
import { toast } from '@/utils/toast'

const warehouses = ref<WarehouseRow[]>([])
const inventory = ref<{ records: StorageInventoryRow[]; total: number; stockKg: number }>({ records: [], total: 0, stockKg: 0 })
const ledger = ref<StoragePage | null>(null)
const batches = ref<{ id: number; batchNo: string; plotNo: string; cropName: string }[]>([])
const loading = ref(false)
const saving = ref(false)
const tab = ref<'stock' | 'ledger'>('stock')
const kw = ref('')
const type = ref('')
const pageNo = ref(1)
const size = 10
const formOpen = ref(false)
const form = reactive({
  type: 'IN' as 'IN' | 'OUT' | 'LOSS' | 'TEMP',
  batchId: 0,
  warehouseId: 1,
  quantityKg: 100,
  temp: 4,
  humidity: 85,
  operator: '张耕',
  note: '',
  happenTime: '',
})
const formTitle = computed(() => form.type === 'IN' ? '入库登记' : form.type === 'OUT' ? '出库' : form.type === 'LOSS' ? '报损' : '记录温湿度')
const inTotal = computed(() => warehouses.value.reduce((s, w) => s + Number(w.inKg), 0))
const lossTotal = computed(() => warehouses.value.reduce((s, w) => s + Number(w.lossKg), 0))
const typeText = (t: string) => (t === 'IN' ? '入库' : t === 'OUT' ? '出库' : '损耗')

function isTempOff(w: WarehouseRow) {
  return w.latestTemp != null && (w.latestTemp < w.tempMin || w.latestTemp > w.tempMax)
}

async function load() {
  loading.value = true
  try {
    const [w, inv] = await Promise.all([apiWarehouses(), apiStorageInventory()])
    warehouses.value = w
    inventory.value = inv
    await Promise.all([loadBatches(), loadLedger()])
  } catch (e: any) {
    toast(e?.message || '仓储数据读取失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadBatches() {
  try {
    batches.value = (await apiBatches()).map(b => ({ id: b.id, batchNo: b.batchNo, plotNo: b.plotNo, cropName: b.cropName }))
  } catch {
    batches.value = []
  }
}

async function loadLedger() {
  try {
    ledger.value = await apiStorageLedger({ type: type.value, kw: kw.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '台账读取失败', 'error')
  }
}

function openForm(t: 'IN' | 'OUT' | 'LOSS' | 'TEMP', w?: WarehouseRow | null, row?: StorageInventoryRow) {
  form.type = t
  form.warehouseId = w?.id || warehouses.value[0]?.id || 1
  form.batchId = row?.batchId || batches.value[0]?.id || 0
  form.quantityKg = 100
  form.temp = w?.latestTemp ?? 4
  form.humidity = w?.latestHumidity ?? 85
  form.operator = '张耕'
  form.note = ''
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  form.happenTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  formOpen.value = true
}

async function submit() {
  saving.value = true
  try {
    if (form.type === 'TEMP') {
      await apiStorageTemperature({ warehouseId: form.warehouseId, temp: form.temp, humidity: form.humidity })
      toast('温湿度已记录')
    } else {
      const payload = {
        batchId: form.batchId,
        warehouseId: form.warehouseId,
        quantityKg: form.quantityKg,
        operator: form.operator,
        note: form.note,
        happenTime: form.happenTime.replace('T', ' '),
      }
      if (form.type === 'IN') await apiStorageInbound(payload)
      else await apiStorageOutbound({ ...payload, type: form.type })
      toast(form.type === 'IN' ? '入库成功' : form.type === 'OUT' ? '出库成功' : '损耗已登记')
    }
    formOpen.value = false
    pageNo.value = 1
    await load()
  } catch (e: any) {
    toast(e?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

let timer = 0
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => { pageNo.value = 1; loadLedger() }, 300)
})
watch(type, () => { pageNo.value = 1; loadLedger() })
onMounted(load)
</script>

<style scoped>
.wh-page { display: flex; flex-direction: column; gap: 18px; }
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
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wh-card { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); padding: 16px 18px; }
.wh-card header { display: flex; justify-content: space-between; gap: 12px; }
.wh-card h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.wh-card p { margin: 0; font-size: 11px; color: var(--ink-3); }
.temp { font-family: var(--font-num); font-size: 20px; color: var(--pine); text-align: right; }
.temp small { display: block; font-size: 10px; color: var(--ink-3); }
.temp.off { color: var(--alert); }
.bar { height: 4px; background: var(--paper-2); border-radius: 2px; margin: 14px 0 6px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--pine); }
.cap { margin-bottom: 8px !important; }
.tbl-wrap { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); padding: 4px 16px 12px; }
.empty { padding: 36px 0; text-align: center; color: var(--ink-3); font-size: 12px; }
.danger { color: var(--alert); }
</style>
