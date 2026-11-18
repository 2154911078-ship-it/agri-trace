<template>
  <div class="dash">
    <div class="page-head">
      <div>
        <p class="kicker">{{ today }} · {{ weekday }}</p>
        <h1>青禾家庭农场</h1>
        <p>肥东县 · {{ d?.farmCount ?? '—' }} 个基地 · {{ d?.plotCount ?? '—' }} 块地 · 在田 {{ d?.activeBatches ?? '—' }} 个批次</p>
      </div>
      <div class="head-right">
        <span class="num">刷新于 {{ updatedAt }}</span>
        <button class="ghost" :disabled="loading" @click="load">重新读取</button>
      </div>
    </div>

    <div class="stat-strip">
      <div v-for="s in stats" :key="s.label">
        <span>{{ s.label }}</span>
        <b :class="{ warn: s.warn }">{{ s.value }}</b>
        <em>{{ s.unit }}</em>
      </div>
    </div>

    <div class="grid-12 sec">
      <section class="col-8 map-panel">
        <div class="panel-head">
          <h2>智慧农业园区</h2>
          <router-link class="txt-link" to="/farm">全部地块</router-link>
        </div>
        <div class="map-box">
          <BaseParkView />
        </div>
      </section>

      <aside class="col-4">
        <div class="panel-head">
          <h2>待办与预警</h2>
          <span class="count">{{ d?.todos.length || 0 }}</span>
        </div>
        <ol class="todos">
          <li v-for="t in d?.todos || []" :key="t.id" :data-level="t.level">
            <time class="mono">{{ t.time }}</time>
            <div>
              <strong>{{ t.title }}</strong>
              <p>{{ t.desc }}</p>
            </div>
            <router-link class="go" :to="t.to">处理</router-link>
          </li>
        </ol>
      </aside>
    </div>

    <div class="grid-12 sec">
      <section class="col-7">
        <div class="panel-head">
          <h2>近 12 个月采收量</h2>
          <span class="unit">单位 kg</span>
        </div>
        <TrendChart :labels="d?.trend.labels || []" :data="d?.trend.data || []" unit="kg" :height="204" />
      </section>

      <section class="col-5">
        <div class="panel-head">
          <h2>品类构成</h2>
          <span class="unit">按在田面积</span>
        </div>
        <PieChart :data="d?.category || []" :height="214" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import BaseParkView from '@/components/park/BaseParkView.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import PieChart from '@/components/charts/PieChart.vue'
import { apiDashboard, type DashboardVO } from '@/api'
import { farmId } from '@/stores/farm'

const now = new Date()
const today = `${now.getMonth() + 1} 月 ${now.getDate()} 日`
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]

const d = ref<DashboardVO | null>(null)
const loading = ref(false)
const updatedAt = ref('—')
const stats = ref<{ label: string; value: string; unit: string; warn?: boolean }[]>([])

async function load() {
  loading.value = true
  try {
    const r = await apiDashboard(farmId.value)
    d.value = r
    stats.value = [
      { label: '在田面积', value: r.areaMu.toFixed(1), unit: '亩' },
      { label: '待采收批次', value: String(r.pendingHarvest), unit: '批' },
      { label: '今日采收', value: r.todayHarvest.toLocaleString(), unit: 'kg' },
      { label: '近 30 天合格率', value: r.passRate.toFixed(1), unit: '%', warn: r.passRate < 95 },
      { label: '今日扫码', value: r.todayScan.toLocaleString(), unit: '次' },
    ]
    const n = new Date()
    updatedAt.value = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(farmId, () => load())
</script>

<style scoped>
.dash {
  max-width: 1440px;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11.5px;
  color: var(--ink-3);
}
.num {
  font-family: var(--font-num);
}
.sec {
  margin-top: 17px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}
.panel-head h2 {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}
.unit,
.count {
  font-size: 11px;
  color: var(--ink-3);
}
.txt-link {
  font-size: 11.5px;
  color: var(--ink-2);
  text-decoration: none;
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 1px;
}
.txt-link:hover {
  color: var(--pine);
  border-color: var(--pine);
}

.map-panel {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 18px 18px 10px;
  overflow: hidden;
}
.map-box {
  height: 556px;
}

.todos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.todos li {
  display: grid;
  grid-template-columns: 46px 1fr auto;
  gap: 12px;
  align-items: start;
  padding-left: 12px;
  border-left: 1px solid var(--line);
}
.todos li[data-level='alert'] {
  border-left-color: var(--alert);
}
.todos li[data-level='warn'] {
  border-left-color: var(--wheat);
}
.todos time {
  font-family: var(--font-num);
  font-size: 10.5px;
  color: var(--ink-3);
  padding-top: 3px;
}
.todos strong {
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.4;
}
.todos p {
  margin: 4px 0 0;
  font-size: 11.5px;
  color: var(--ink-3);
  line-height: 1.55;
}
.go {
  font-size: 11.5px;
  color: var(--pine);
  text-decoration: none;
  white-space: nowrap;
  border-bottom: 1px solid transparent;
  padding-top: 2px;
}
.go:hover {
  border-color: var(--pine);
}
</style>