<template>
  <div class="module ship">
    <div class="page-head">
      <div>
        <p class="kicker">冷链运输 · LOGISTICS</p>
        <h1>物流</h1>
        <p>运输单、温控打点与签收 · {{ page?.total ?? 0 }} 单 · 在途 {{ page?.transit ?? 0 }} 单</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button class="primary" @click="openCreate">创建运输单</button>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>待发车</span><b>{{ page?.pending ?? '—' }}</b><em>单</em></div>
      <div><span>运输中</span><b>{{ page?.transit ?? '—' }}</b><em>单</em></div>
      <div><span>冷链预警</span><b :class="{ warn: (page?.alerts || 0) > 0 }">{{ page?.alerts ?? '—' }}</b><em>单</em></div>
      <div><span>已签收</span><b>{{ page?.delivered ?? '—' }}</b><em>单</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button v-for="t in TABS" :key="String(t.v)" :class="{ on: status === t.v }" @click="status = t.v">
          {{ t.t }}<span class="n">{{ t.n }}</span>
        </button>
      </div>
      <div class="right">
        <input v-model="kw" class="m-search" placeholder="搜批次 / 承运 / 车牌 / 目的地" />
        <button v-if="kw || status" class="m-link" @click="reset">清空</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:170px">批次 / 地块</th>
            <th style="width:100px">作物</th>
            <th style="width:164px">承运 / 车牌</th>
            <th style="width:126px">发车时间</th>
            <th>目的地</th>
            <th style="width:90px" class="num-r">温度</th>
            <th style="width:86px">状态</th>
            <th style="width:86px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'sk' + i" class="loading-row">
            <td v-for="j in 8" :key="j"><span class="sk" :style="{ width: 30 + ((j * 12) % 55) + '%' }" /></td>
          </tr>
          <tr
            v-for="r in page?.records || []"
            v-else
            :key="r.id"
            :class="{ 'is-active': detail && detail.id === r.id }"
            @click="detail = r"
          >
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.batchNo }}</span>
                <span class="sub">{{ r.plotNo }} {{ r.cropName }}</span>
              </div>
            </td>
            <td>{{ r.cropName }}</td>
            <td>
              <div class="m-cell">
                <span>{{ r.carrier || '待分配' }}</span>
                <span v-if="r.plateNo" class="sub mono">{{ r.plateNo }}</span>
              </div>
            </td>
            <td class="mono">{{ r.startTime ? r.startTime.slice(5, 16) : '—' }}</td>
            <td>{{ r.to }}</td>
            <td class="num-r">
              <span v-if="r.temp.length" class="mono" :class="{ tempBad: currentTemp(r) > 8 }">{{ currentTemp(r).toFixed(1) }} ℃</span>
              <span v-else class="sub">—</span>
            </td>
            <td><span class="m-tag" :class="statusClass(r.status)">{{ statusText(r.status) }}</span></td>
            <td><button class="m-link" @click.stop="detail = r">查看</button></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">当前筛选下没有运输单。</div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; load() }" />
    </div>

    <SlidePanel
      :open="!!detail"
      title="运输单"
      kicker="SHIPMENT TRACK"
      :subtitle="detail ? `${detail.batchNo} · ${detail.cropName}` : ''"
      width="540px"
      @close="detail = null"
    >
      <template v-if="detail">
        <div class="ship-head">
          <span class="m-tag" :class="statusClass(detail.status)">{{ statusText(detail.status) }}</span>
          <span class="sub mono">{{ detail.carrier || '未分配承运' }} {{ detail.plateNo }}</span>
        </div>

        <dl class="m-kv two">
          <div><dt>批次</dt><dd class="mono">{{ detail.batchNo }}</dd></div>
          <div><dt>地块</dt><dd>{{ detail.plotNo }}</dd></div>
          <div><dt>起运</dt><dd>{{ detail.from }}</dd></div>
          <div><dt>目的地</dt><dd>{{ detail.to }}</dd></div>
          <div><dt>发车时间</dt><dd class="mono">{{ detail.startTime || '—' }}</dd></div>
          <div><dt>数量</dt><dd class="mono">{{ detail.qty ? detail.qty.toLocaleString() + ' kg' : '—' }}</dd></div>
        </dl>

        <div v-if="detail.temp.length" class="m-section">
          <div class="m-section-title"><b>货厢温度</b><span>阈值 2–8 ℃</span></div>
          <TrendChart :labels="detail.temp.map(x => x.time)" :data="detail.temp.map(x => x.value)" unit="℃" :height="168" />
        </div>
        <div v-if="detail.status === 'alert'" class="m-note bad">
          途中出现 9.1 ℃ 短时超限，持续约 30 分钟并已回落；建议复核货物状态后再签收。
        </div>

        <div class="m-section">
          <div class="m-section-title"><b>运输轨迹</b><span>{{ detail.points.length }} 个节点</span></div>
          <ol class="m-timeline">
            <li v-for="(p, i) in detail.points" :key="i" :class="{ done: i < detail.points.length - 1, alert: p.temp && p.temp > 8 }">
              <time>{{ p.time }}</time>
              <strong>{{ p.place }} · {{ p.status }}</strong>
              <p v-if="p.temp !== undefined">车厢 {{ p.temp }} ℃</p>
            </li>
          </ol>
        </div>

        <div v-if="detail.signAt" class="m-note">已于 {{ detail.signAt }} 由 {{ detail.signBy }} 签收。</div>
      </template>

      <template #footer>
        <div v-if="detail" class="drawer-footer">
          <router-link class="m-link" :to="`/batch/${detail.batchId}`">查看批次 →</router-link>
          <button
            v-if="detail.status === 'transit' || detail.status === 'alert'"
            class="primary"
            :disabled="signing"
            @click="sign(detail)"
          >
            {{ signing ? '签收中…' : '确认签收' }}
          </button>
        </div>
      </template>
    </SlidePanel>

    <SlidePanel :open="createOpen" title="创建运输单" kicker="NEW SHIPMENT" subtitle="选择待发批次与承运信息，发车后自动生成温控轨迹" @close="createOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field full">
          <span>批次 / 地块</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in pendingBatches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }} {{ b.cropName }}</option>
          </select>
          <small class="hint">{{ pendingBatches.length }} 个批次待发运；已发运批次可在列表查看</small>
        </label>
        <label class="m-field">
          <span>承运商</span>
          <select v-model="form.carrier">
            <option v-for="c in CARRIERS" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>车牌号</span>
          <input v-model.trim="form.plateNo" placeholder="皖A·00000" required />
        </label>
        <label class="m-field full">
          <span>目的地 / 经销商</span>
          <select v-model="form.dealer">
            <option v-for="d in DEALERS" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>发运数量（kg）</span>
          <input v-model.number="form.qty" type="number" min="1" required />
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="createOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '创建中…' : '创建并发车' }}</button>
        </div>
      </form>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import { toast } from '@/utils/toast'
import {
  apiBatches, apiShipCreate, apiShipPage, apiShipSign,
  type BatchSummary, type ShipPage, type ShipmentRow,
} from '@/api'

const CARRIERS = ['顺达冷链', '中通冷链', '万纬物流', '京东冷链']
const DEALERS = ['南京众彩果品批发行', '合肥周谷堆农产品市场', '上海江桥批发市场', '杭州勾庄农副市场', '武汉白沙洲市场']

const TABS = computed(() => [
  { v: null as string | null, t: '全部', n: page.value?.total ?? 0 },
  { v: 'pending', t: '待发车', n: page.value?.pending ?? 0 },
  { v: 'transit', t: '运输中', n: page.value?.transit ?? 0 },
  { v: 'alert', t: '预警', n: page.value?.alerts ?? 0 },
  { v: 'delivered', t: '已签收', n: page.value?.delivered ?? 0 },
])

const page = ref<ShipPage | null>(null)
const batches = ref<BatchSummary[]>([])
const loading = ref(false)
const pageNo = ref(1)
const size = 10
const saving = ref(false)
const signing = ref(false)
const status = ref<string | null>(null)
const kw = ref('')
const detail = ref<ShipmentRow | null>(null)
const createOpen = ref(false)
const form = reactive({ batchId: 0, carrier: CARRIERS[0], plateNo: '皖A·', dealer: DEALERS[0], qty: 1000 })

const pendingBatches = computed(() => {
  const rest = batches.value.filter(b => !b.ship)
  return rest.length ? rest : batches.value
})
const statusText = (s: string) =>
  s === 'pending' ? '待发车' : s === 'transit' ? '运输中' : s === 'alert' ? '冷链预警' : '已签收'
const statusClass = (s: string) =>
  s === 'pending' ? 'muted' : s === 'transit' ? 'ok' : s === 'alert' ? 'bad' : 'plain ok'
const currentTemp = (r: ShipmentRow) => r.temp[r.temp.length - 1]?.value ?? 0

async function load() {
  loading.value = true
  try {
    page.value = await apiShipPage({ kw: kw.value, status: status.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '运输单读取失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadBatches() {
  try {
    batches.value = await apiBatches()
  } catch {
    batches.value = []
  }
}

function openCreate() {
  form.batchId = pendingBatches.value[0]?.id || 0
  form.carrier = CARRIERS[0]
  form.plateNo = '皖A·'
  form.dealer = DEALERS[0]
  form.qty = 1000
  createOpen.value = true
}

async function submit() {
  if (!form.batchId) {
    toast('请选择待发批次', 'warn')
    return
  }
  saving.value = true
  try {
    await apiShipCreate({ ...form })
    toast('运输单已创建，车辆已发车')
    createOpen.value = false
    await Promise.all([load(), loadBatches()])
  } catch (e: any) {
    toast(e?.message || '创建失败', 'error')
  } finally {
    saving.value = false
  }
}

async function sign(row: ShipmentRow) {
  signing.value = true
  try {
    const updated = await apiShipSign(row.id, { by: '经销商 周敏' })
    detail.value = updated
    toast('运单已签收')
    await load()
  } catch (e: any) {
    toast(e?.message || '签收失败', 'error')
  } finally {
    signing.value = false
  }
}

function reset() {
  kw.value = ''
  status.value = null
}

let timer = 0
watch(status, () => { pageNo.value = 1; load() })
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => { pageNo.value = 1; load() }, 300)
})
onMounted(async () => {
  await Promise.all([load(), loadBatches()])
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.module {
  max-width: 1440px;
}
.head-right {
  display: flex;
  gap: 12px;
}
.ship-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.tempBad {
  color: var(--alert);
}
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.drawer-footer .primary {
  height: 34px;
}
</style>
