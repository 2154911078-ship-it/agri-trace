<template>
  <div class="park">
    <div ref="hostEl" class="stage" />

    <div class="hud-top">
      <span class="live"><i /> {{ activeFarm || '智慧农业园区' }}</span>
      <span class="sep" />
      <span class="txt">示范 {{ showcase.length }}/{{ activePlots.length }} 块地</span>
      <span class="sep" />
      <span class="txt dim">生长 {{ counts.growing }} · 待收 {{ counts.harvest }} · 休耕 {{ counts.fallow }} · 预警 {{ counts.alert }}</span>
    </div>

    <div class="base-tabs">
      <button
        v-for="b in bases"
        :key="b.name"
        :class="{ on: activeFarm === b.name }"
        @click="switchFarm(b.name)"
      >
        {{ b.name }}<em>{{ b.count }}</em>
      </button>
      <router-link class="all-link" to="/farm">全部地块 →</router-link>
    </div>

    <div class="locator">
      <button v-if="!locOpen" class="loc-fab" @click="locOpen = true" title="按设备 / 设施 / 地块名称定位">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        定位
      </button>
      <div v-else class="loc-panel">
        <header>
          <span>园区定位</span>
          <button class="loc-min" aria-label="收起" @click="locOpen = false">收起</button>
        </header>
        <input
          v-model.trim="locQuery"
          type="search"
          placeholder="搜索设备 / 设施 / 地块"
          @keydown.enter="locateFirst"
        />
        <div class="loc-scroll">
          <template v-if="locVehicles.length">
            <p class="loc-group">移动设备</p>
            <ul class="loc-list">
              <li
                v-for="v in locVehicles"
                :key="v.id"
                :class="{ on: device?.id === v.id && !selected }"
                @click="locateVehicle(v)"
              >
                <i class="veh" :style="{ background: v.color }" />
                <span class="nm">{{ v.name }}</span>
                <em>{{ v.sub }}</em>
              </li>
            </ul>
          </template>
          <template v-if="locFacilities.length">
            <p class="loc-group">园区设施</p>
            <ul class="loc-list">
              <li
                v-for="f in locFacilities"
                :key="f.id"
                :class="{ on: facility === f.id && !selected && !device }"
                @click="locateFacility(f.id)"
              >
                <i class="fac" />
                <span class="nm">{{ f.name }}</span>
                <em>{{ f.sub }}</em>
              </li>
            </ul>
          </template>
          <template v-if="locPlots.length">
            <p class="loc-group">示范地块</p>
            <ul class="loc-list">
              <li
                v-for="p in locPlots"
                :key="p.id"
                :class="{ on: selected?.id === p.id }"
                @click="locatePlot(p)"
              >
                <i :style="{ background: STATUS_HEX[p.status] }" />
                <span class="no mono">{{ p.plotNo }}</span>
                <span class="nm">{{ p.name }}</span>
                <em>{{ p.cropName }}</em>
              </li>
            </ul>
          </template>
          <p v-if="!locVehicles.length && !locFacilities.length && !locPlots.length" class="none">没有匹配的设备、设施或地块</p>
        </div>
        <small class="loc-tip">设备 {{ VEHICLE_LIST.length }} · 设施 {{ facilities.length }} · 地块 {{ showcase.length }}</small>
      </div>
    </div>

    <div class="veh-dock">
      <button v-if="!vehOpen" class="loc-fab" @click="vehOpen = true" title="控制巡检机器人与光伏运维车">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="9" width="20" height="9" rx="2" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
        车辆控制
      </button>
      <div v-else class="veh-panel">
        <header>
          <span>车辆控制</span>
          <button class="loc-min" aria-label="收起" @click="vehOpen = false">收起</button>
        </header>
        <section v-for="v in vehState" :key="v.id" class="veh-row">
          <div class="veh-head">
            <i :style="{ background: vehColor(v.id) }" />
            <span class="nm">{{ v.name }}</span>
            <span class="st" :class="v.running ? 'on' : 'off'">{{ v.running ? '运行中' : '已暂停' }}</span>
          </div>
          <div class="veh-acts">
            <button class="veh-btn" @click="toggleRun(v)">{{ v.running ? '暂停' : '继续' }}</button>
            <button class="veh-btn" :class="{ on: v.following }" @click="toggleFollow(v)">视角跟随</button>
          </div>
          <label class="veh-slide">
            <span>速度</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              :value="v.cruise"
              @input="setSpeed(v, $event)"
            />
            <b class="mono">{{ v.cruise.toFixed(1) }}</b>
          </label>
          <label class="veh-slide">
            <span>位置</span>
            <input
              type="range"
              min="0"
              max="99.5"
              step="0.5"
              :value="scrubId === v.id ? scrubVal : Math.round(v.progress * 100)"
              @pointerdown="scrubId = v.id"
              @pointerup="scrubId = ''"
              @input="onScrub(v, $event)"
            />
            <b class="mono">{{ Math.round(v.progress * 100) }}%</b>
          </label>
          <p class="veh-foot">
            <span>瞬时 <b class="mono">{{ v.live.toFixed(1) }} m/s</b></span>
            <span>行驶 <b class="mono">{{ fmtDist(v.dist) }}</b></span>
            <span>环线 <b class="mono">{{ Math.round(v.routeLen) }} m</b></span>
          </p>
        </section>
      </div>
    </div>

    <div class="legend">
      <span v-for="l in LEGEND" :key="l.t"><i :style="{ background: l.c }" />{{ l.t }}</span>
    </div>

    <article v-if="selected" class="plot-card">
      <header>
        <div class="pc-head">
          <span class="kicker">地块档案 · PLOT RECORD</span>
          <h4><span class="mono">{{ selected.plotNo }}</span> {{ selected.name }}</h4>
          <p>
            {{ selected.cropName }}
            <template v-if="selected.variety"> · {{ selected.variety }}</template>
            · {{ selected.areaMu.toFixed(1) }} 亩
          </p>
        </div>
        <span class="pill" :class="statusClass(selected.status)">{{ statusText(selected.status) }}</span>
        <button class="x" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="prog">
        <div class="prog-head">
          <span>生长进度</span>
          <b class="mono">{{ pct }}%</b>
        </div>
        <span class="pbar"><i :style="{ width: pct + '%', background: STATUS_HEX[selected.status] }" /></span>
        <p class="prog-note">
          <template v-if="detail?.plantDate">播种 {{ detail.plantDate }} · </template>
          已生长 {{ detail?.growthDays ?? '—' }} 天
        </p>
      </div>

      <ul class="kv two">
        <li><span>负责人</span><b>{{ selected.manager || '—' }}</b></li>
        <li><span>土壤类型</span><b>{{ detail?.soilType || '—' }}</b></li>
        <li><span>在田批次</span><b class="mono">{{ selected.batchNo || '—' }}</b></li>
        <li><span>预计产量</span><b class="mono">{{ detail?.expectYieldKg ? detail.expectYieldKg.toLocaleString() + ' kg' : '—' }}</b></li>
      </ul>

      <div v-if="detail?.records?.length" class="record">
        <span class="rec-tag">{{ detail.records[detail.records.length - 1].type }}</span>
        <p>{{ detail.records[detail.records.length - 1].detail }}</p>
        <small>{{ detail.records[detail.records.length - 1].happenTime }} · {{ detail.records[detail.records.length - 1].operator }}</small>
      </div>

      <div class="card-acts">
        <router-link v-if="batch" :to="`/batch/${batch.id}`" class="primary-sm">查看批次详情</router-link>
        <span v-else-if="batchLoading" class="waiting">批次信息读取中…</span>
        <span v-else class="waiting">暂无关联批次</span>
        <button class="ghost-sm" @click="locate">在 3D 中定位</button>
      </div>
    </article>

    <article v-else-if="facilityInfo" class="plot-card info-card">
      <header>
        <div class="pc-head">
          <span class="kicker">园区建筑 · FACILITY</span>
          <h4>{{ facilityInfo.name }}</h4>
          <p>{{ facilityInfo.sub }}</p>
        </div>
        <button class="x" aria-label="关闭" @click="clearPanels">×</button>
      </header>
      <p class="fac-desc">{{ facilityInfo.desc }}</p>
      <ul class="metrics">
        <li v-for="m in facilityInfo.metrics" :key="m.label">
          <span>{{ m.label }}</span>
          <b>{{ m.value }}</b>
        </li>
      </ul>
    </article>

    <article v-else-if="device" class="plot-card info-card">
      <header>
        <div class="pc-head">
          <span class="kicker">物联设备 · DEVICE</span>
          <h4>{{ device.name }}</h4>
          <p>{{ device.model }}</p>
        </div>
        <span class="pill" :class="device.status === '告警' ? 'alert' : 'grow'">{{ device.status }}</span>
        <button class="x" aria-label="关闭" @click="clearPanels">×</button>
      </header>
      <ul class="kv three">
        <li><span>电量</span><b class="mono">{{ device.battery }}%</b></li>
        <li><span>信号</span><b class="mono">{{ device.signal }}%</b></li>
        <li><span>在线</span><b>{{ device.uptime }}</b></li>
      </ul>
      <ul class="metrics">
        <li v-for="m in device.metrics" :key="m.label">
          <span>{{ m.label }}</span>
          <b>{{ m.value }}</b>
        </li>
      </ul>
      <div v-if="device.plot" class="card-acts">
        <button class="ghost-sm" @click="device.plot && locatePlotById(device.plot.id)">定位到 {{ device.plot.plotNo }}</button>
      </div>
    </article>

    <div class="bar">
      <div class="grp">
        <button @click="focusFull">全景</button>
        <button @click="reset">重置视角</button>
      </div>
      <span class="divider" />
      <button class="export" @click="exportCsv">导出数据</button>
    </div>

    <transition name="fade">
      <div v-if="loading" class="loading">
        <div class="ring" />
        <p>正在生成 {{ activeFarm || '' }} 园区…</p>
      </div>
    </transition>

    <div v-if="error" class="load-error">
      <span>3D 园区加载失败：{{ error }}</span>
      <button @click="boot">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { farmIdOfName, farmName, setFarm } from '@/stores/farm'
import {
  apiPlotBatch, apiPlotDetail, apiPlotsOverview,
  type BatchSummary, type PlotDetail, type PlotOverview,
} from '@/api'
import { createParkScene, cropKindOf, type DeviceInfo, type ParkApi, type ParkCrop, type ParkFacilityId, type ParkPlot, type ParkTheme, type VehicleState } from './useParkScene'
import { toast } from '@/utils/toast'

const STATUS_HEX: Record<number, string> = { 1: '#6f8f63', 2: '#c9a45c', 3: '#9aa79b', 4: '#c4633f' }
const STATUS_TEXT: Record<number, string> = { 1: '生长中', 2: '待采收', 3: '休耕', 4: '预警' }
const LEGEND = [
  { t: '生长中', c: 'var(--st-growing)' },
  { t: '待采收', c: 'var(--st-harvest)' },
  { t: '休耕', c: 'var(--st-fallow)' },
  { t: '预警', c: 'var(--st-alert)' },
]
const SLOT_CROPS: ParkCrop[] = ['grape', 'grape', 'rice', 'rice', 'rape', 'rape', 'berry', 'berry']
const STATUS_RANK: Record<number, number> = { 2: 0, 4: 1, 1: 2, 3: 3 }
const FACILITY_INFO: Record<ParkFacilityId, { name: string; sub: string; desc: string; metrics: { label: string; value: string }[] }> = {
  greenhouse: {
    name: '连栋温室',
    sub: '水肥一体化 · 立体水培',
    desc: '玻璃连栋温室，配三层水培架、循环风机与 LED 补光，环境由 W-02 节点在线监测。',
    metrics: [
      { label: '栽培架', value: '6 组' },
      { label: '空气温度', value: '24.6 ℃' },
      { label: '空气湿度', value: '68.2 %' },
      { label: '补光时长', value: '14 h/日' },
    ],
  },
  tower: {
    name: '垂直农场塔',
    sub: '旋转立体栽培 · 3 座',
    desc: '18 盘循环旋转栽培塔，营养液 EC/pH 由控制柜 T-01 在线调节，LED 补光按日照曲线运行。',
    metrics: [
      { label: '栽培塔', value: '3 座' },
      { label: '栽培盘', value: '18 盘' },
      { label: '营养液 EC', value: '1.9 mS/cm' },
      { label: '循环泵', value: '4/4 运行' },
    ],
  },
  homestead: {
    name: '农舍',
    sub: '合作社办公 · 农事调度',
    desc: '合作社常驻办公与农事调度中心，兼作农资暂存和访客接待。',
    metrics: [
      { label: '建筑面积', value: '76 ㎡' },
      { label: '常驻人员', value: '6 人' },
      { label: '监控点位', value: '6 处' },
      { label: '网络', value: '千兆光纤' },
    ],
  },
  shed: {
    name: '工具棚',
    sub: '农机具存放 · 物资周转',
    desc: '存放旋耕机、植保机等农机具，棚顶铺设 3 组光伏板为园区补电。',
    metrics: [
      { label: '棚内面积', value: '36 ㎡' },
      { label: '农机具', value: '4 台' },
      { label: '物资批次', value: '12 批' },
      { label: '棚顶光伏', value: '3 组' },
    ],
  },
  pond: {
    name: '生态池塘',
    sub: '蓄水调蓄 · 生态养殖',
    desc: '园区雨水调蓄与生态净化节点，塘边设亲水步道与鸭群栖息区。',
    metrics: [
      { label: '水面面积', value: '78 ㎡' },
      { label: '平均水深', value: '1.6 m' },
      { label: '蓄水量', value: '125 m³' },
      { label: '水质 pH', value: '7.2' },
    ],
  },
  solar: {
    name: '光伏阵列',
    sub: '分布式光伏 · 储能',
    desc: '24 块单晶硅组件与储能柜组成园区微电网，为温室补光和冷库提供绿电。',
    metrics: [
      { label: '组件数量', value: '24 块' },
      { label: '装机容量', value: '12.6 kWp' },
      { label: '今日发电', value: '46.8 kWh' },
      { label: '储能容量', value: '30 kWh' },
    ],
  },
  gate: {
    name: '园区大门',
    sub: '主入口 · 车辆消杀',
    desc: '园区主入口，配车辆消杀通道、访客登记与物流车辆引导。',
    metrics: [
      { label: '门洞宽度', value: '5.9 m' },
      { label: '今日车次', value: '12 车次' },
      { label: '消杀次数', value: '12 次' },
      { label: '访客登记', value: '8 人' },
    ],
  },
}
const FACILITY_LIST: { id: ParkFacilityId; name: string; sub: string; themes: ParkTheme[] }[] = [
  { id: 'greenhouse', name: '连栋温室', sub: '大棚', themes: ['homestead', 'water', 'tower'] },
  { id: 'tower', name: '垂直农场塔', sub: '立体栽培', themes: ['homestead', 'tower'] },
  { id: 'homestead', name: '农舍', sub: '合作社', themes: ['homestead'] },
  { id: 'shed', name: '工具棚', sub: '农机具', themes: ['homestead', 'tower'] },
  { id: 'pond', name: '生态池塘', sub: '蓄水养殖', themes: ['homestead', 'water'] },
  { id: 'solar', name: '光伏阵列', sub: '储能', themes: ['tower'] },
  { id: 'gate', name: '园区大门', sub: '主入口', themes: ['homestead', 'water', 'tower'] },
]
const VEHICLE_LIST = [
  { id: 'robot-r07', name: '巡检机器人', sub: 'R-07', color: '#2f5d50' },
  { id: 'solar-s01', name: '光伏运维车', sub: 'S-01', color: '#c9a45c' },
]

const hostEl = ref<HTMLElement | null>(null)
const allPlots = ref<PlotOverview[]>([])
const activeFarm = ref('')
const selected = ref<PlotOverview | null>(null)
const detail = ref<PlotDetail | null>(null)
const batch = ref<BatchSummary | null>(null)
const batchLoading = ref(false)
const device = ref<DeviceInfo | null>(null)
const facility = ref<ParkFacilityId | null>(null)
const locOpen = ref(false)
const locQuery = ref('')
const vehOpen = ref(window.innerWidth > 900)
const vehState = ref<VehicleState[]>([])
const scrubId = ref('')
const scrubVal = ref(0)
const loading = ref(true)
const error = ref('')
let scene: ParkApi | null = null
let detailToken = 0
let vehTimer = 0

const bases = computed(() => {
  const map = new Map<string, PlotOverview[]>()
  allPlots.value.forEach(p => {
    const name = p.farmName || '未分组基地'
    if (!map.has(name)) map.set(name, [])
    map.get(name)!.push(p)
  })
  return [...map.entries()].map(([name, list]) => ({
    name,
    count: list.length,
    growing: list.filter(p => p.status === 1).length,
    harvest: list.filter(p => p.status === 2).length,
    alert: list.filter(p => p.status === 4).length,
  }))
})

const activePlots = computed(() =>
  allPlots.value.filter(p => (p.farmName || '未分组基地') === activeFarm.value),
)

const showcase = computed(() => pickShowcase(activePlots.value))

const counts = computed(() => ({
  growing: activePlots.value.filter(p => p.status === 1).length,
  harvest: activePlots.value.filter(p => p.status === 2).length,
  fallow: activePlots.value.filter(p => p.status === 3).length,
  alert: activePlots.value.filter(p => p.status === 4).length,
}))

const pct = computed(() => {
  const p = detail.value?.progress ?? selected.value?.progress ?? 0
  return Math.round(Math.min(1, Math.max(0, p)) * 100)
})

const facilityInfo = computed(() => (facility.value ? FACILITY_INFO[facility.value] : null))

const themeNow = computed(() => themeOf(activeFarm.value))

const facilities = computed(() => FACILITY_LIST.filter(f => f.themes.includes(themeNow.value)))

const locVehicles = computed(() => {
  const q = locQuery.value.toLowerCase()
  if (!q) return VEHICLE_LIST
  return VEHICLE_LIST.filter(v => `${v.name}${v.sub}`.toLowerCase().includes(q))
})

const locFacilities = computed(() => {
  const q = locQuery.value.toLowerCase()
  if (!q) return facilities.value
  return facilities.value.filter(f => `${f.name}${f.sub}`.toLowerCase().includes(q))
})

const locPlots = computed(() => {
  const q = locQuery.value.toLowerCase()
  if (!q) return showcase.value
  return showcase.value.filter(p =>
    [p.name, p.plotNo, p.cropName, p.variety].some(v => (v || '').toLowerCase().includes(q)),
  )
})

const statusText = (s: number) => STATUS_TEXT[s] || '—'
const statusClass = (s: number) => (s === 1 ? 'grow' : s === 2 ? 'harvest' : s === 3 ? 'fallow' : 'alert')

function pickShowcase(list: PlotOverview[]) {
  const used = new Set<number>()
  const sorted = list.slice().sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))
  const out: PlotOverview[] = []
  for (const crop of SLOT_CROPS) {
    let hit = sorted.find(p => !used.has(p.id) && cropKindOf(p.cropName) === crop)
    if (!hit) hit = sorted.find(p => !used.has(p.id) && p.status !== 3)
    if (!hit) hit = sorted.find(p => !used.has(p.id))
    if (!hit) break
    used.add(hit.id)
    out.push(hit)
  }
  return out
}

function themeOf(name: string): ParkTheme {
  if (name.includes('西沟')) return 'water'
  if (name.includes('新圩')) return 'tower'
  return 'homestead'
}

function toParkPlot(p: PlotOverview): ParkPlot {
  const progress = p.progress ?? (p.status === 2 ? 0.95 : p.status === 4 ? 0.68 : p.status === 3 ? 0 : 0.62)
  return {
    id: p.id,
    plotNo: p.plotNo,
    name: p.name,
    cropName: p.cropName,
    variety: p.variety,
    status: p.status,
    areaMu: p.areaMu,
    manager: p.manager,
    batchNo: p.batchNo,
    progress,
    crop: cropKindOf(p.cropName),
  }
}

async function loadDetail(p: PlotOverview) {
  const token = ++detailToken
  detail.value = null
  batch.value = null
  batchLoading.value = true
  const [d, b] = await Promise.allSettled([apiPlotDetail(p.id), apiPlotBatch(p.id)])
  if (token !== detailToken) return
  if (d.status === 'fulfilled') detail.value = d.value
  if (b.status === 'fulfilled') batch.value = b.value
  batchLoading.value = false
}

function onPlot(id: number | null) {
  if (!id) {
    selected.value = null
    return
  }
  const p = allPlots.value.find(x => x.id === id)
  if (!p) return
  selected.value = p
  device.value = null
  facility.value = null
  scene?.focusPlot(id)
  void loadDetail(p)
}

function onPick(d: DeviceInfo | null) {
  device.value = d
  if (d) {
    selected.value = null
    detail.value = null
    batch.value = null
    facility.value = null
  }
}

function onFacility(id: ParkFacilityId | null) {
  facility.value = id
  if (id) {
    selected.value = null
    detail.value = null
    batch.value = null
    device.value = null
  }
}

function clearPanels() {
  selected.value = null
  detail.value = null
  batch.value = null
  device.value = null
  facility.value = null
  scene?.selectPlot(null)
}

function locatePlot(p: PlotOverview) {
  onPlot(p.id)
  if (window.innerWidth < 900) locOpen.value = false
}

function locatePlotById(id: number) {
  const p = allPlots.value.find(x => x.id === id)
  if (p) locatePlot(p)
}

function locateFacility(id: ParkFacilityId) {
  onFacility(id)
  scene?.focus(id)
  if (window.innerWidth < 900) locOpen.value = false
}

function locateVehicle(v: { id: string }) {
  onPick(scene?.devices().find(d => d.id === v.id) ?? null)
  scene?.followDevice(v.id)
  vehOpen.value = true
  if (window.innerWidth < 900) locOpen.value = false
}

const vehColor = (id: string) => VEHICLE_LIST.find(v => v.id === id)?.color || '#2f5d50'

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`)

function pollVehicles() {
  const list = scene?.vehicles?.()
  if (!list) return
  vehState.value = list.map(v => ({ ...v }))
}

function toggleRun(v: VehicleState) {
  scene?.setRunning(v.id, !v.running)
  pollVehicles()
}

function toggleFollow(v: VehicleState) {
  if (v.following) {
    scene?.setFollow(null)
  } else {
    scene?.setFollow(v.id)
    onPick(scene?.devices().find(d => d.id === v.id) ?? null)
  }
  pollVehicles()
}

function setSpeed(v: VehicleState, e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  scene?.setCruise(v.id, val)
  pollVehicles()
}

function onScrub(v: VehicleState, e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  scrubVal.value = val
  scene?.setProgress(v.id, val / 100)
}

function locateFirst() {
  if (locPlots.value[0]) locatePlot(locPlots.value[0])
  else if (locFacilities.value[0]) locateFacility(locFacilities.value[0].id)
  else if (locVehicles.value[0]) locateVehicle(locVehicles.value[0])
}

function close() {
  clearPanels()
}

async function rebuild() {
  loading.value = true
  error.value = ''
  try {
    await nextTick()
    if (!hostEl.value) throw new Error('3D 舞台未就绪')
    if (scene) {
      scene.dispose()
      scene = null
    }
    const plots = showcase.value.map(toParkPlot)
    if (!plots.length) throw new Error('该基地暂无可展示地块')
    scene = createParkScene(hostEl.value, {
      plots,
      theme: themeOf(activeFarm.value),
      onPlot,
      onPick,
      onFacility,
    })
    scene.focus('full')
    pollVehicles()
    if (!vehTimer) vehTimer = window.setInterval(pollVehicles, 250)
  } catch (e: any) {
    error.value = e?.message || '未知错误'
    toast(error.value, 'error')
  } finally {
    loading.value = false
  }
}

async function load() {
  try {
    const list = await apiPlotsOverview()
    if (!list.length) throw new Error('接口未返回地块数据')
    allPlots.value = list
    if (!activeFarm.value || !bases.value.some(b => b.name === activeFarm.value)) {
      activeFarm.value = bases.value.some(b => b.name === farmName.value) ? farmName.value : bases.value[0]?.name || ''
    }
    await rebuild()
  } catch (e: any) {
    error.value = e?.message || '未知错误'
    loading.value = false
    toast(error.value, 'error')
  }
}

function switchFarm(name: string) {
  if (activeFarm.value === name) {
    focusFull()
    return
  }
  setFarm(farmIdOfName(name), name)
  activeFarm.value = name
  close()
  void rebuild()
}

function focusFull() {
  scene?.focus('full')
  close()
}

function reset() {
  focusFull()
}

function locate() {
  if (selected.value) scene?.focusPlot(selected.value.id)
}

function exportCsv() {
  const rows = ['地块编号,地块名称,基地,作物,品种,状态,面积(亩),生长进度(%),负责人,在田批次']
  activePlots.value.forEach(p => {
    rows.push([
      p.plotNo, p.name, p.farmName, p.cropName, p.variety ?? '', statusText(p.status),
      p.areaMu.toFixed(2), Math.round((p.progress ?? 0) * 100), p.manager ?? '', p.batchNo ?? '',
    ].join(','))
  })
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${activeFarm.value || 'farm'}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}

onMounted(load)
onBeforeUnmount(() => {
  if (vehTimer) clearInterval(vehTimer)
  vehTimer = 0
  scene?.dispose()
  scene = null
})
</script>

<style scoped>
.park {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 10px;
  background: #dfe8e4;
  isolation: isolate;
}
.stage {
  position: absolute;
  inset: 0;
}
.stage :deep(canvas) {
  touch-action: none;
}
.hud-top {
  position: absolute;
  left: 12px;
  top: 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(46, 125, 50, 0.16);
  backdrop-filter: blur(8px);
  font-size: 11px;
  color: #4b5548;
  letter-spacing: 0.02em;
  max-width: calc(100% - 24px);
  z-index: 3;
}
.hud-top .live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #2e7d32;
  font-weight: 600;
  white-space: nowrap;
}
.hud-top .live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3ddc84;
  box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.2);
  animation: breathe 2s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.hud-top .sep {
  width: 1px;
  height: 11px;
  flex: 0 0 auto;
  background: rgba(75, 85, 72, 0.18);
}
.hud-top .txt {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hud-top .dim {
  color: #7d8779;
}
.base-tabs {
  position: absolute;
  left: 12px;
  top: 48px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(46, 125, 50, 0.13);
  backdrop-filter: blur(8px);
  z-index: 3;
  max-width: calc(100% - 24px);
  overflow-x: auto;
  scrollbar-width: none;
}
.base-tabs::-webkit-scrollbar {
  display: none;
}
.base-tabs button {
  flex: 0 0 auto;
  border: 0;
  background: none;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 10.5px;
  color: #7d8779;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.base-tabs button em {
  font-style: normal;
  font-family: var(--font-num);
  margin-left: 4px;
  opacity: 0.7;
}
.base-tabs button.on {
  background: #2f5d50;
  color: #f4f2e9;
}
.all-link {
  flex: 0 0 auto;
  align-self: center;
  margin-left: 4px;
  padding: 4px 6px;
  font-size: 9.5px;
  color: #2f5d50;
  text-decoration: none;
  white-space: nowrap;
  border-bottom: 1px solid transparent;
}
.all-link:hover {
  border-color: #2f5d50;
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 10px;
  display: flex;
  gap: 11px;
  font-size: 10px;
  color: #7d8779;
  z-index: 3;
  pointer-events: none;
}
.legend i {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 2px;
  margin-right: 4px;
  transform: translateY(-1px);
}
.locator {
  position: absolute;
  left: 12px;
  top: 88px;
  z-index: 5;
}
.loc-fab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(46, 125, 50, 0.16);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  font-size: 10.5px;
  color: #2f5d50;
  cursor: pointer;
}
.loc-fab:hover {
  background: #fff;
}
.loc-panel {
  width: 196px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(46, 125, 50, 0.14);
  box-shadow: 0 10px 28px rgba(26, 29, 27, 0.16);
  backdrop-filter: blur(10px);
}
.loc-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: #4b5548;
}
.loc-min {
  border: 0;
  background: none;
  font-size: 9.5px;
  color: #8a9089;
  cursor: pointer;
  padding: 0;
}
.loc-min:hover {
  color: #2f5d50;
}
.loc-panel input {
  width: 100%;
  box-sizing: border-box;
  height: 24px;
  padding: 0 7px;
  border-radius: 5px;
  border: 1px solid #e2dfd5;
  background: #fbfaf6;
  font-size: 10.5px;
  color: #1a1d1b;
  outline: none;
}
.loc-panel input:focus {
  border-color: #2f5d50;
}
.loc-scroll {
  max-height: 236px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.loc-group {
  margin: 7px 2px 2px;
  font-size: 9px;
  letter-spacing: 0.08em;
  color: #9aa096;
}
.loc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.loc-list li {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border-radius: 4px;
  font-size: 10px;
  color: #4b5548;
  cursor: pointer;
}
.loc-list li:hover {
  background: rgba(47, 93, 80, 0.07);
}
.loc-list li.on {
  background: rgba(47, 93, 80, 0.12);
}
.loc-list i {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.loc-list i.fac,
.loc-list i.veh {
  border-radius: 2px;
}
.loc-list i.fac {
  background: #2f5d50;
}
.loc-list .no {
  font-family: var(--font-num);
  font-size: 9px;
  color: #8a9089;
}
.loc-list .nm {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.loc-list em {
  font-style: normal;
  font-size: 9px;
  color: #9aa096;
}
.loc-scroll .none {
  margin: 8px 0;
  text-align: center;
  font-size: 10px;
  color: #9aa096;
}
.loc-tip {
  display: block;
  padding: 4px 2px 0;
  font-size: 9px;
  color: #9aa096;
}
.veh-dock {
  position: absolute;
  left: 12px;
  bottom: 34px;
  z-index: 5;
}
.veh-panel {
  width: 226px;
  padding: 8px 9px 7px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(46, 125, 50, 0.14);
  box-shadow: 0 10px 28px rgba(26, 29, 27, 0.16);
  backdrop-filter: blur(10px);
}
.veh-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: #4b5548;
}
.veh-row + .veh-row {
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed rgba(75, 85, 72, 0.18);
}
.veh-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: #1a1d1b;
}
.veh-head i {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 2px;
}
.veh-head .nm {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.veh-head .st {
  flex: none;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 9px;
}
.veh-head .st.on {
  background: rgba(47, 93, 80, 0.1);
  color: #2f5d50;
}
.veh-head .st.off {
  background: rgba(154, 167, 155, 0.18);
  color: #7d8779;
}
.veh-acts {
  display: flex;
  gap: 4px;
  margin: 5px 0 1px;
}
.veh-btn {
  padding: 2px 9px;
  border: 1px solid rgba(46, 125, 50, 0.16);
  border-radius: 999px;
  background: rgba(251, 250, 246, 0.9);
  font-size: 9.5px;
  color: #4b5548;
  cursor: pointer;
}
.veh-btn:hover {
  border-color: rgba(47, 93, 80, 0.42);
  color: #2f5d50;
}
.veh-btn.on {
  background: #2f5d50;
  border-color: #2f5d50;
  color: #f7f6f2;
}
.veh-slide {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 9.5px;
  color: #8a9089;
}
.veh-slide span {
  flex: none;
  width: 24px;
}
.veh-slide b {
  flex: none;
  width: 36px;
  text-align: right;
  font-family: var(--font-num);
  font-weight: 500;
  color: #4b5548;
}
.veh-slide input[type='range'] {
  flex: 1;
  min-width: 0;
  height: 14px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: none;
  cursor: pointer;
}
.veh-slide input[type='range']::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 2px;
  background: rgba(75, 85, 72, 0.22);
}
.veh-slide input[type='range']::-webkit-slider-thumb {
  width: 9px;
  height: 9px;
  margin-top: -3.5px;
  border-radius: 50%;
  border: 1.5px solid #f7f6f2;
  background: #2f5d50;
  box-shadow: 0 1px 3px rgba(26, 29, 27, 0.3);
  appearance: none;
  -webkit-appearance: none;
}
.veh-slide input[type='range']::-moz-range-track {
  height: 2px;
  border-radius: 2px;
  background: rgba(75, 85, 72, 0.22);
}
.veh-slide input[type='range']::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: 1.5px solid #f7f6f2;
  border-radius: 50%;
  background: #2f5d50;
}
.veh-foot {
  display: flex;
  gap: 9px;
  margin: 4px 0 0;
  font-size: 9px;
  color: #9aa096;
}
.veh-foot b {
  font-family: var(--font-num);
  font-weight: 500;
  color: #4b5548;
}
.plot-card {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 274px;
  max-height: calc(100% - 72px);
  overflow-y: auto;
  padding: 14px 15px 12px;
  border-radius: 9px;
  background: rgba(247, 246, 242, 0.95);
  border: 1px solid rgba(46, 125, 50, 0.14);
  box-shadow: 0 14px 36px rgba(26, 29, 27, 0.16);
  backdrop-filter: blur(10px);
  z-index: 4;
}
.plot-card header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.pc-head {
  min-width: 0;
  flex: 1;
}
.kicker {
  font-size: 9px;
  letter-spacing: 0.13em;
  color: #8a9089;
  margin: 0 0 5px;
}
.plot-card h4 {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  line-height: 1.3;
}
.plot-card h4 .mono {
  font-family: var(--font-num);
  font-size: 10px;
  color: #2f5d50;
  letter-spacing: 0.08em;
  margin-right: 3px;
}
.plot-card header p {
  margin: 4px 0 0;
  font-size: 10.5px;
  color: #7d8779;
}
.pill {
  flex: 0 0 auto;
  font-size: 9.5px;
  padding: 3px 7px;
  border-radius: 999px;
  color: #fff;
  background: #6f8f63;
}
.pill.harvest { background: #c9a45c; }
.pill.fallow { background: #9aa79b; }
.pill.alert { background: #c4633f; }
.x {
  border: 0;
  background: none;
  font-size: 16px;
  line-height: 1;
  color: #8a9089;
  cursor: pointer;
  padding: 0;
}
.prog {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e2dfd5;
}
.prog-head {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #8a9089;
  margin-bottom: 5px;
}
.prog-head b {
  font-size: 11px;
  color: #2f5d50;
}
.pbar {
  display: block;
  height: 3px;
  border-radius: 2px;
  background: #e2dfd5;
  overflow: hidden;
}
.pbar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s var(--ease);
}
.prog-note {
  margin: 5px 0 0;
  font-size: 9.5px;
  color: #9aa096;
}
.kv {
  list-style: none;
  margin: 10px 0 0;
  padding: 10px 0;
  border-top: 1px solid #e2dfd5;
  border-bottom: 1px solid #e2dfd5;
}
.kv.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
}
.kv li {
  min-width: 0;
}
.kv span {
  display: block;
  font-size: 9.5px;
  color: #9aa096;
  margin-bottom: 2px;
}
.kv b {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #1a1d1b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kv .mono {
  font-family: var(--font-num);
  font-size: 10px;
}
.kv.three {
  grid-template-columns: repeat(3, 1fr);
}
.info-card {
  width: 252px;
}
.fac-desc {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid #e2dfd5;
  font-size: 10px;
  line-height: 1.6;
  color: #4a514c;
}
.metrics {
  list-style: none;
  margin: 10px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid #e2dfd5;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
}
.metrics li {
  min-width: 0;
}
.metrics span {
  display: block;
  font-size: 9.5px;
  color: #9aa096;
  margin-bottom: 2px;
}
.metrics b {
  font-size: 11px;
  font-weight: 500;
  color: #1a1d1b;
}
.record {
  margin-top: 10px;
  padding-left: 9px;
  border-left: 1px solid #c9a45c;
}
.rec-tag {
  font-size: 9px;
  color: #96702f;
  letter-spacing: 0.06em;
}
.record p {
  margin: 3px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #4a514c;
}
.record small {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: #9aa096;
}
.card-acts {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
}
.primary-sm,
.ghost-sm {
  height: 26px;
  padding: 0 9px;
  border-radius: 4px;
  font-size: 10.5px;
  display: inline-grid;
  place-items: center;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.primary-sm {
  background: #2f5d50;
  color: #fff;
  border: 0;
}
.ghost-sm {
  background: none;
  border: 1px solid #e2dfd5;
  color: #4a514c;
}
.waiting {
  font-size: 9.5px;
  color: #9aa096;
}
.bar {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(46, 125, 50, 0.16);
  backdrop-filter: blur(8px);
  z-index: 3;
  max-width: calc(100% - 24px);
  overflow-x: auto;
  scrollbar-width: none;
}
.bar::-webkit-scrollbar {
  display: none;
}
.grp {
  display: flex;
  gap: 2px;
}
.bar button {
  flex: 0 0 auto;
  border: 0;
  background: none;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 10px;
  color: #4b5548;
  cursor: pointer;
  white-space: nowrap;
}
.bar button:hover {
  background: rgba(47, 93, 80, 0.08);
}
.bar .export {
  color: #2f5d50;
  font-weight: 500;
}
.divider {
  width: 1px;
  height: 12px;
  background: rgba(75, 85, 72, 0.18);
}
.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  background: rgba(223, 232, 228, 0.78);
  backdrop-filter: blur(3px);
  z-index: 6;
}
.loading p {
  font-size: 11px;
  color: #4b5548;
}
.ring {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(47, 93, 80, 0.2);
  border-top-color: #2f5d50;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.load-error {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 15px;
  border-radius: 8px;
  background: #f7f6f2;
  border: 1px solid #e2dfd5;
  font-size: 11px;
  color: #b4462f;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 10px;
}
.load-error button {
  border: 0;
  background: #2f5d50;
  color: #fff;
  font-size: 10px;
  padding: 5px 9px;
  border-radius: 4px;
  cursor: pointer;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s var(--ease);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 900px) {
  .base-tabs {
    top: 46px;
    left: 8px;
    max-width: calc(100% - 16px);
  }
  .locator {
    left: 8px;
    top: 82px;
  }
  .loc-panel {
    width: 184px;
  }
  .veh-dock {
    left: 8px;
    bottom: 42px;
  }
  .veh-panel {
    width: 184px;
    max-height: calc(100vh - 320px);
    overflow-y: auto;
  }
  .plot-card {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: 48px;
    width: auto;
    max-height: 42%;
  }
  .bar {
    bottom: 6px;
  }
  .legend {
    display: none;
  }
}
</style>
