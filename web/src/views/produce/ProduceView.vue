<template>
  <div class="module produce">
    <div class="page-head">
      <div>
        <p class="kicker">农事作业 · FIELD LOG</p>
        <h1>生产</h1>
        <p>农事记录与安全间隔 · {{ page?.total ?? 0 }} 条记录 · {{ batches.length }} 个在田批次</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button class="primary" @click="openCreate">新增农事记录</button>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>今日记录</span><b>{{ page?.today ?? '—' }}</b><em>条</em></div>
      <div><span>近 7 天</span><b>{{ page?.week ?? '—' }}</b><em>条</em></div>
      <div><span>安全间隔未到</span><b :class="{ warn: (page?.safetyAlerts || 0) > 0 }">{{ page?.safetyAlerts ?? '—' }}</b><em>条施药</em></div>
      <div><span>累计记录</span><b>{{ page?.counts.all ?? '—' }}</b><em>条</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button v-for="t in TYPES" :key="t.v" :class="{ on: type === t.v }" @click="type = t.v">
          {{ t.t }}<span class="n">{{ t.n }}</span>
        </button>
      </div>
      <div class="right">
        <input v-model="kw" class="m-search" placeholder="搜批次 / 地块 / 作物 / 负责人" />
        <select v-model="batchId" class="m-select">
          <option :value="null">全部批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.cropName }}</option>
        </select>
        <button v-if="kw || type !== 'all' || batchId" class="m-link" @click="reset">清空</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:126px">发生时间</th>
            <th style="width:170px">批次 / 地块</th>
            <th style="width:112px">作物</th>
            <th style="width:84px">环节</th>
            <th>记录内容</th>
            <th style="width:86px">负责人</th>
            <th style="width:112px">安全间隔</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'sk' + i" class="loading-row">
            <td v-for="j in 7" :key="j"><span class="sk" :style="{ width: 35 + ((j * 9) % 50) + '%' }" /></td>
          </tr>
          <tr v-for="r in page?.records || []" v-else :key="r.id" @click="openDetail(r)">
            <td class="mono">{{ r.happenTime.slice(5, 16) }}</td>
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.batchNo }}</span>
                <span class="sub">{{ r.plotNo }} {{ r.plotName }}</span>
              </div>
            </td>
            <td>{{ r.cropName }}<span v-if="r.variety" class="sub"> · {{ r.variety }}</span></td>
            <td><span class="type">{{ r.type }}</span></td>
            <td class="detail-cell">{{ r.detail }}</td>
            <td>{{ r.operator }}</td>
            <td>
              <span v-if="r.safeDate" class="m-tag" :class="safeLeft(r.safeDate) > 0 ? 'warn' : 'ok'">
                {{ safeLeft(r.safeDate) > 0 ? `剩 ${safeLeft(r.safeDate)} 天` : '已可采收' }}
              </span>
              <span v-else class="sub">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">
        当前筛选下没有农事记录。<a @click="reset">清空筛选</a>
      </div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; load() }" />
    </div>

    <SlidePanel
      :open="!!detail"
      title="农事记录"
      kicker="FIELD RECORD"
      :subtitle="detail ? `${detail.batchNo} · ${detail.type}` : ''"
      @close="detail = null"
    >
      <template v-if="detail">
        <dl class="m-kv">
          <div><dt>发生时间</dt><dd class="mono">{{ detail.happenTime }}</dd></div>
          <div><dt>批次</dt><dd class="mono">{{ detail.batchNo }}</dd></div>
          <div><dt>地块</dt><dd>{{ detail.plotNo }} {{ detail.plotName }}</dd></div>
          <div><dt>作物</dt><dd>{{ detail.cropName }}<span v-if="detail.variety"> · {{ detail.variety }}</span></dd></div>
          <div><dt>环节</dt><dd>{{ detail.type }}</dd></div>
          <div><dt>负责人</dt><dd>{{ detail.operator }}</dd></div>
          <div v-if="detail.safeDays"><dt>安全间隔</dt><dd>{{ detail.safeDays }} 天 · {{ detail.safeDate }}</dd></div>
          <div v-if="detail.quantityKg"><dt>采收重量</dt><dd>{{ detail.quantityKg.toLocaleString() }} kg</dd></div>
        </dl>

        <div class="m-section">
          <div class="m-section-title"><b>记录详情</b></div>
          <p class="detail-text">{{ detail.detail }}</p>
        </div>

        <div v-if="detail.safeDate" class="m-note" :class="{ bad: safeLeft(detail.safeDate) > 0 }">
          {{ safeLeft(detail.safeDate) > 0
            ? `该次施药距安全间隔到期还有 ${safeLeft(detail.safeDate)} 天，当前不可采收。`
            : '该次施药已过安全间隔，可以安排采收。' }}
        </div>

        <div class="drawer-links">
          <router-link class="m-link" :to="`/batch/${detail.batchId}`">查看批次详情 →</router-link>
          <router-link class="m-link" to="/farm">查看地块台账 →</router-link>
        </div>
      </template>
    </SlidePanel>

    <SlidePanel :open="createOpen" title="新增农事记录" kicker="NEW FIELD LOG" @close="createOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field full">
          <span>批次 / 地块</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }} {{ b.cropName }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>环节</span>
          <select v-model="form.type">
            <option v-for="t in LOG_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>负责人</span>
          <input v-model.trim="form.operator" placeholder="姓名" required />
        </label>
        <label class="m-field full">
          <span>发生时间</span>
          <input v-model="form.happenTime" type="datetime-local" required />
        </label>
        <label v-if="form.type === '打药'" class="m-field">
          <span>安全间隔（天）</span>
          <input v-model.number="form.safeDays" type="number" min="1" max="60" />
        </label>
        <label v-if="form.type === '采收' || form.type === '测产'" class="m-field">
          <span>重量（kg）</span>
          <input v-model.number="form.quantityKg" type="number" min="1" placeholder="用于今日采收统计" />
        </label>
        <label class="m-field full">
          <span>记录内容</span>
          <textarea v-model.trim="form.detail" placeholder="投入品、用量、作业方式、天气或现场情况" required />
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="createOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '保存中…' : '保存记录' }}</button>
        </div>
      </form>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { toast } from '@/utils/toast'
import {
  apiBatches, apiProduceCreate, apiProducePage,
  type BatchSummary, type ProducePage, type ProduceRecord,
} from '@/api'

const TYPES = computed(() => [
  { v: 'all', t: '全部', n: page.value?.counts.all ?? 0 },
  { v: 'fertilize', t: '施肥', n: page.value?.counts.fertilize ?? 0 },
  { v: 'spray', t: '打药', n: page.value?.counts.spray ?? 0 },
  { v: 'irrigate', t: '灌溉', n: page.value?.counts.irrigate ?? 0 },
  { v: 'harvest', t: '采收', n: page.value?.counts.harvest ?? 0 },
  { v: 'other', t: '其它', n: page.value?.counts.other ?? 0 },
])
const LOG_TYPES = ['定植', '播种', '施肥', '灌溉', '打药', '除草', '疏花', '疏果', '晒田', '采收', '测产', '清园']

const page = ref<ProducePage | null>(null)
const batches = ref<BatchSummary[]>([])
const loading = ref(false)
const pageNo = ref(1)
const size = 20
const saving = ref(false)
const kw = ref('')
const type = ref('all')
const batchId = ref<number | null>(null)
const detail = ref<ProduceRecord | null>(null)
const createOpen = ref(false)
const form = reactive({
  batchId: 0,
  type: '施肥',
  happenTime: '',
  operator: '张耕',
  safeDays: 14,
  quantityKg: undefined as number | undefined,
  detail: '',
})

const safeLeft = (date: string) => {
  const a = new Date(date + 'T00:00:00+08:00').getTime()
  const b = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00+08:00').getTime()
  return Math.ceil((a - b) / 86400000)
}

async function load() {
  loading.value = true
  try {
    page.value = await apiProducePage({ kw: kw.value, type: type.value, batchId: batchId.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '生产记录读取失败', 'error')
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

function openDetail(r: ProduceRecord) {
  detail.value = r
}

function openCreate() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  form.batchId = batches.value[0]?.id || 0
  form.type = '施肥'
  form.happenTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  form.operator = '张耕'
  form.safeDays = 14
  form.quantityKg = undefined
  form.detail = ''
  createOpen.value = true
}

async function submit() {
  if (!form.batchId || !form.detail) {
    toast('请选择批次并填写记录内容', 'warn')
    return
  }
  saving.value = true
  try {
    await apiProduceCreate({
      batchId: form.batchId,
      type: form.type,
      happenTime: form.happenTime.replace('T', ' ').slice(0, 16),
      detail: form.detail,
      operator: form.operator,
      safeDays: form.type === '打药' ? form.safeDays : undefined,
      quantityKg: ['采收', '测产'].includes(form.type) ? form.quantityKg : undefined,
    })
    toast('农事记录已保存')
    createOpen.value = false
    await load()
  } catch (e: any) {
    toast(e?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function reset() {
  kw.value = ''
  type.value = 'all'
  batchId.value = null
}

let timer = 0
watch([type, batchId], () => { pageNo.value = 1; load() })
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
.batch-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detail-cell {
  max-width: 430px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.type {
  font-size: 12px;
  color: var(--ink);
}
.detail-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--ink-2);
  padding: 14px 16px;
  background: var(--paper-2);
  border-radius: var(--r-sm);
}
.drawer-links {
  display: flex;
  gap: 20px;
  margin-top: 24px;
}
</style>
