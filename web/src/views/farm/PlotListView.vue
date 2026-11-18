<template>
  <div class="plots">
    <div class="page-head">
      <div>
        <p class="kicker">基地管理</p>
        <h1>地块</h1>
        <p>共 {{ total }} 块 · 在田 {{ growing }} 块 · 预警 {{ alerted }} 块</p>
      </div>
      <div class="head-right">
        <input v-model="kw" class="search" placeholder="搜地块编号 / 作物" />
        <button class="primary" @click="create">新建地块</button>
      </div>
    </div>

    <div class="filter">
      <div class="segs">
        <button v-for="s in STATUS" :key="String(s.v)" :class="{ on: status === s.v }" @click="pick(s.v)">
          {{ s.t }}<span class="n">{{ s.n }}</span>
        </button>
      </div>
      <div class="filter-right">
        <select v-model="crop" class="mini-select">
          <option :value="null">全部作物</option>
          <option v-for="c in crops" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:96px">编号</th>
            <th>地块</th>
            <th style="width:150px">当前作物</th>
            <th style="width:88px" class="num-r">面积/亩</th>
            <th style="width:104px">状态</th>
            <th style="width:170px">在田批次</th>
            <th style="width:88px">负责人</th>
            <th style="width:124px">最近农事</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'s' + i" class="loading-row">
            <td v-for="j in 8" :key="j">
              <span class="sk" :style="{ width: 40 + ((j * 7) % 45) + '%' }" />
            </td>
          </tr>
          <tr
            v-for="p in list"
            v-else
            :key="p.id"
            :class="{ 'is-active': picked && picked.id === p.id }"
            @click="picked = p"
          >
            <td class="mono">{{ p.plotNo }}</td>
            <td class="strong">{{ p.name }}</td>
            <td>
              {{ p.cropName }}<span v-if="p.variety" class="sub"> · {{ p.variety }}</span>
            </td>
            <td class="num-r">{{ p.areaMu.toFixed(2) }}</td>
            <td><i class="dot" :class="dotCls(p.status)" />{{ statusText(p.status) }}</td>
            <td class="mono">{{ p.batchNo || '—' }}</td>
            <td>{{ p.manager || '—' }}</td>
            <td class="sub">{{ p.lastRecordAt ? p.lastRecordAt.slice(5, 16) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !list.length" class="empty">
        这个筛选条件下没有地块。<a @click="reset">清空筛选</a>
      </div>

      <div class="pager">
        <span>第 {{ total ? (page - 1) * size + 1 : 0 }}–{{ Math.min(page * size, total) }} 条 / 共 {{ total }} 条</span>
        <div class="acts">
          <button :disabled="page === 1" @click="go(page - 1)">上一页</button>
          <button :disabled="page * size >= total" @click="go(page + 1)">下一页</button>
        </div>
      </div>
    </div>

    <PlotDetailPanel :plot-id="picked ? picked.id : null" @close="picked = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PlotDetailPanel from '@/components/farm/PlotDetailPanel.vue'
import { apiPlotPage, type PlotRow } from '@/api'
import { toast } from '@/utils/toast'

const counts = ref({ all: 0, growing: 0, harvest: 0, fallow: 0, alert: 0 })
const STATUS = computed(() => [
  { v: null, t: '全部', n: counts.value.all },
  { v: 1, t: '生长中', n: counts.value.growing },
  { v: 2, t: '待采收', n: counts.value.harvest },
  { v: 3, t: '休耕', n: counts.value.fallow },
  { v: 4, t: '预警', n: counts.value.alert },
])
const crops = ['阳光玫瑰', '晚稻', '油菜', '草莓']

const list = ref<PlotRow[]>([])
const total = ref(0)
const growing = ref(0)
const alerted = ref(0)
const page = ref(1)
const size = 20
const status = ref<number | null>(null)
const crop = ref<string | null>(null)
const kw = ref('')
const loading = ref(false)
const picked = ref<PlotRow | null>(null)

const dotCls = (s: number) =>
  ['', 'dot-growing', 'dot-harvest', 'dot-fallow', 'dot-alert'][s]
const statusText = (s: number) => ['', '生长中', '待采收', '休耕', '预警'][s]

async function load() {
  loading.value = true
  try {
    const r = await apiPlotPage({
      page: page.value,
      size,
      status: status.value,
      crop: crop.value,
      kw: kw.value,
    })
    list.value = r.records
    total.value = r.total
    growing.value = r.growing
    alerted.value = r.alerted
    counts.value = r.counts ?? counts.value
  } finally {
    loading.value = false
  }
}

function pick(v: number | null) {
  status.value = v
  page.value = 1
}
function go(p: number) {
  page.value = p
}
function reset() {
  status.value = null
  crop.value = null
  kw.value = ''
  page.value = 1
}
function create() {
  toast('新建地块：接口尚未实现，先在 SQL 里加一行', 'warn')
}

let timer = 0
watch(status, () => { page.value = 1 })
watch(crop, () => { page.value = 1 })
watch(page, load)
watch([status, crop], load)
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 320)
})

onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.plots {
  position: relative;
  max-width: 1440px;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.search {
  width: 200px;
  height: 34px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: none;
  outline: none;
  font-size: 13px;
  color: var(--ink);
  transition: border-color 0.16s var(--ease);
}
.search:focus {
  border-color: var(--pine);
}
.search::placeholder {
  color: #b7bbb2;
}
.filter {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 30px 0 18px;
  border-bottom: 1px solid var(--line);
}
.filter-right {
  padding-bottom: 8px;
}
.mini-select {
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  outline: none;
  padding-right: 4px;
}
.tbl-wrap {
  position: relative;
}
</style>