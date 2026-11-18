<template>
  <div class="input-page">
    <header class="page-head">
      <div>
        <p class="kicker">农资台账 · AGRI INPUTS</p>
        <h1>农资</h1>
        <p>农药化肥采购、领用与库存联动；领用农药自动写入农事记录并带安全间隔。</p>
      </div>
      <div class="head-acts">
        <button class="ghost" @click="load">刷新</button>
        <button class="primary" @click="openForm('PURCHASE')">采购入库</button>
        <button class="ghost" @click="openForm('USE')">领用出库</button>
      </div>
    </header>

    <div class="stats">
      <div><span>农资种类</span><b>{{ items.total }}</b><em>种</em></div>
      <div><span>库存总量</span><b>{{ items.stock.toLocaleString() }}</b><em>单位</em></div>
      <div><span>低库存</span><b class="bad">{{ items.lowStock }}</b><em>种</em></div>
      <div><span>累计领用</span><b>{{ ledger?.useQty?.toLocaleString() ?? '—' }}</b></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: tab === 'stock' }" @click="tab = 'stock'">库存</button>
        <button :class="{ on: tab === 'ledger' }" @click="tab = 'ledger'">出入库台账</button>
      </div>
      <input v-if="tab === 'ledger'" v-model="kw" class="m-search" placeholder="搜农资 / 批次" />
    </div>

    <div class="tbl-wrap" v-if="tab === 'stock'">
      <table class="tbl">
        <thead><tr><th>农资</th><th>类别</th><th>有效成分</th><th class="num-r">库存</th><th>安全间隔</th><th>登记证</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="it in items.records" :key="it.id">
            <td class="strong">{{ it.name }} <span v-if="it.lowStock" class="m-tag warn">低库存</span></td>
            <td>{{ it.type }}</td>
            <td class="sub">{{ it.ingredient }}</td>
            <td class="num-r strong">{{ it.stock.toLocaleString() }} {{ it.unit }}</td>
            <td>{{ it.safeDays ? it.safeDays + ' 天' : '—' }}</td>
            <td class="mono sub">{{ it.licenseNo }}</td>
            <td>
              <button class="m-link" @click="openForm('PURCHASE', it)">采购</button>
              <button class="m-link" @click="openForm('USE', it)">领用</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="tbl-wrap" v-else>
      <table class="tbl">
        <thead><tr><th>时间</th><th>类型</th><th>农资</th><th class="num-r">数量</th><th>批次</th><th>经办</th><th>备注</th></tr></thead>
        <tbody>
          <tr v-for="r in ledger?.records || []" :key="r.id">
            <td class="mono sub">{{ r.happenTime }}</td>
            <td><span class="m-tag" :class="r.type === 'PURCHASE' ? 'ok' : 'warn'">{{ r.type === 'PURCHASE' ? '采购' : '领用' }}</span></td>
            <td>{{ r.itemName }}</td>
            <td class="num-r strong">{{ r.quantity.toLocaleString() }} {{ r.unit }}</td>
            <td class="mono">{{ r.batchNo || '—' }}<span v-if="r.plotNo" class="sub"> · {{ r.plotNo }}</span></td>
            <td>{{ r.operator }}</td>
            <td class="sub">{{ r.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(ledger?.records || []).length" class="empty">当前筛选下没有台账。</div>
      <MPager :page="pageNo" :size="size" :total="ledger?.total || 0" @change="p => { pageNo = p; loadLedger() }" />
    </div>

    <SlidePanel :open="formOpen" :title="form.type === 'PURCHASE' ? '采购入库' : '领用出库'" kicker="INPUT STOCK" @close="formOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field full">
          <span>农资</span>
          <select v-model.number="form.itemId" required>
            <option v-for="it in items.records" :key="it.id" :value="it.id">{{ it.name }}（库存 {{ it.stock }} {{ it.unit }}）</option>
          </select>
        </label>
        <label class="m-field" v-if="form.type === 'USE'">
          <span>用于批次</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>数量</span>
          <input v-model.number="form.quantity" type="number" min="0.1" step="0.1" required />
        </label>
        <label class="m-field">
          <span>经办人</span>
          <input v-model.trim="form.operator" required />
        </label>
        <label class="m-field full">
          <span>时间</span>
          <input v-model="form.happenTime" type="datetime-local" />
        </label>
        <label class="m-field full">
          <span>备注</span>
          <textarea v-model.trim="form.note" placeholder="采购来源 / 施用地块 / 防治对象" />
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
import { onMounted, reactive, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { apiBatches, type BatchSummary } from '@/api'
import {
  apiInputLedger, apiInputPurchase, apiInputs, apiInputUse,
  type InputItemRow, type InputPage, type InputLedgerRow,
} from '@/api/p0'
import { toast } from '@/utils/toast'

const items = ref<{ records: InputItemRow[]; total: number; stock: number; lowStock: number }>({ records: [], total: 0, stock: 0, lowStock: 0 })
const ledger = ref<InputPage | null>(null)
const batches = ref<BatchSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const tab = ref<'stock' | 'ledger'>('stock')
const kw = ref('')
const pageNo = ref(1)
const size = 10
const formOpen = ref(false)
const form = reactive({
  type: 'PURCHASE' as 'PURCHASE' | 'USE',
  itemId: 0,
  batchId: 0,
  quantity: 10,
  operator: '张耕',
  note: '',
  happenTime: '',
})

async function load() {
  loading.value = true
  try {
    const [it, bs] = await Promise.all([apiInputs(), apiBatches().catch(() => [])])
    items.value = it
    batches.value = bs
    await loadLedger()
  } catch (e: any) {
    toast(e?.message || '农资数据读取失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadLedger() {
  try {
    ledger.value = await apiInputLedger({ kw: kw.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '台账读取失败', 'error')
  }
}

function openForm(type: 'PURCHASE' | 'USE', item?: InputItemRow) {
  form.type = type
  form.itemId = item?.id || items.value.records[0]?.id || 0
  form.batchId = batches.value[0]?.id || 0
  form.quantity = 10
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
    const base = {
      itemId: form.itemId,
      quantity: form.quantity,
      operator: form.operator,
      note: form.note,
      happenTime: form.happenTime.replace('T', ' '),
    }
    if (form.type === 'PURCHASE') {
      await apiInputPurchase(base)
      toast('采购入库成功')
    } else {
      const r = await apiInputUse({ ...base, batchId: form.batchId })
      toast(r.safeDays > 0 ? `领用成功，安全间隔 ${r.safeDays} 天，已写入农事记录` : '领用成功，已写入农事记录')
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
onMounted(load)
</script>

<style scoped>
.input-page { display: flex; flex-direction: column; gap: 18px; }
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
</style>
