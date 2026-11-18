<template>
  <div class="module codes">
    <div class="page-head">
      <div>
        <p class="kicker">一物一码 · CODE ISSUING</p>
        <h1>赋码</h1>
        <p>追溯码段生成、激活与作废 · {{ page?.total ?? 0 }} 个码段 · 累计 {{ (page?.codes ?? 0).toLocaleString() }} 枚</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button class="primary" @click="openGenerate">生成码段</button>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>累计赋码</span><b>{{ (page?.codes ?? 0).toLocaleString() }}</b><em>枚</em></div>
      <div><span>已激活</span><b>{{ (page?.active ?? 0).toLocaleString() }}</b><em>枚</em></div>
      <div><span>已扫码</span><b>{{ (page?.scanned ?? 0).toLocaleString() }}</b><em>次</em></div>
      <div><span>已作废</span><b :class="{ warn: (page?.voided || 0) > 0 }">{{ (page?.voided ?? 0).toLocaleString() }}</b><em>枚</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button v-for="t in TABS" :key="String(t.v)" :class="{ on: status === t.v }" @click="status = t.v">
          {{ t.t }}<span class="n">{{ t.n }}</span>
        </button>
      </div>
      <div class="right">
        <input v-model="kw" class="m-search" placeholder="搜批次 / 地块 / 号段前缀" />
        <button v-if="kw || status" class="m-link" @click="reset">清空</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:210px">号段前缀</th>
            <th style="width:170px">批次 / 地块</th>
            <th style="width:104px">作物</th>
            <th style="width:80px" class="num-r">数量</th>
            <th style="width:132px">激活 / 扫码</th>
            <th style="width:126px">生成时间</th>
            <th style="width:86px">状态</th>
            <th style="width:146px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'sk' + i" class="loading-row">
            <td v-for="j in 8" :key="j"><span class="sk" :style="{ width: 34 + ((j * 8) % 48) + '%' }" /></td>
          </tr>
          <tr v-for="r in page?.records || []" v-else :key="r.id" @click="openQr(r)">
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.prefix }}</span>
                <span class="sub">{{ pad(r.startNo) }} – {{ pad(r.endNo) }}</span>
              </div>
            </td>
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.batchNo }}</span>
                <span class="sub">{{ r.plotNo }}</span>
              </div>
            </td>
            <td>{{ r.cropName }}</td>
            <td class="num-r">{{ r.count.toLocaleString() }}</td>
            <td class="mono">{{ r.activated.toLocaleString() }} / {{ r.scanned.toLocaleString() }}</td>
            <td class="mono">{{ r.createdAt.slice(0, 16) }}</td>
            <td><span class="m-tag" :class="statusClass(r.status)">{{ statusText(r.status) }}</span><span v-if="r.frozen" class="m-tag warn" style="margin-left:4px">已冻结</span></td>
            <td>
              <div class="m-actions">
                <button class="m-link" @click.stop="openQr(r)">二维码</button>
                <router-link class="m-link" :to="`/labels/${r.id}`" target="_blank" @click.stop>标签</router-link>
                <button v-if="r.status !== 'active'" class="m-link" @click.stop="activate(r)">激活</button>
                <button v-if="r.status !== 'void' && !r.frozen" class="m-link" @click.stop="freeze(r)">冻结</button>
                <button v-if="r.frozen" class="m-link" @click.stop="unfreeze(r)">解冻</button>
                <button v-if="r.status !== 'void'" class="m-link danger" @click.stop="voidIt(r)">作废</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">当前筛选下没有码段。</div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; load() }" />
    </div>

    <SlidePanel :open="generateOpen" title="生成追溯码段" kicker="NEW CODE SEGMENT" subtitle="按批次生成连续号段，生成后可激活并下载标签" @close="generateOpen = false">
      <form class="m-form" @submit.prevent="submitGenerate">
        <label class="m-field full">
          <span>批次 / 地块</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }} {{ b.cropName }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>生成数量</span>
          <input v-model.number="form.count" type="number" min="1" max="20000" required />
          <small class="hint">单段上限 20,000 枚；建议按亩产 6 枚估算</small>
        </label>
        <label class="m-field">
          <span>生成后状态</span>
          <select v-model="form.activate">
            <option :value="false">待激活</option>
            <option :value="true">立即激活</option>
          </select>
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="generateOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '生成中…' : '生成码段' }}</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel
      :open="!!current"
      title="追溯码"
      kicker="CODE SAMPLE"
      :subtitle="current ? `${current.batchNo} · ${current.cropName}` : ''"
      @close="current = null"
    >
      <template v-if="current">
        <div class="qr-wrap">
          <canvas ref="qrCanvas" class="qr" />
          <p class="m-code">{{ traceCode }}</p>
          <p class="qr-hint">手机与电脑需在同一局域网，扫描后打开 {{ publicOrigin }}/t/{{ traceCode }}</p>
        </div>

        <dl class="m-kv">
          <div><dt>号段</dt><dd class="mono">{{ current.prefix }}</dd></div>
          <div><dt>起止</dt><dd class="mono">{{ current.startNo }} – {{ current.endNo }}</dd></div>
          <div><dt>数量</dt><dd class="mono">{{ current.count.toLocaleString() }} 枚</dd></div>
          <div><dt>激活 / 扫码</dt><dd class="mono">{{ current.activated.toLocaleString() }} / {{ current.scanned.toLocaleString() }}</dd></div>
          <div><dt>状态</dt><dd><span class="m-tag" :class="statusClass(current.status)">{{ statusText(current.status) }}</span><span v-if="current.frozen" class="m-tag warn" style="margin-left:4px">已冻结</span></dd></div>
        </dl>

        <div class="drawer-links">
          <button class="m-link" @click="copyCode">复制追溯码</button>
          <a class="m-link" :href="`/t/${traceCode}`" target="_blank">消费者页预览 →</a>
          <router-link class="m-link" :to="`/trace/${traceCode}`">管理端链路 →</router-link>
          <router-link class="m-link" :to="`/labels/${current.id}`" target="_blank">打印标签 →</router-link>
          <button v-if="!current.frozen && current.status !== 'void'" class="m-link danger" @click="freeze(current)">冻结码段</button>
          <button v-if="current.frozen" class="m-link" @click="unfreeze(current)">解冻码段</button>
        </div>
      </template>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { toast } from '@/utils/toast'
import {
  apiBatches, apiCodesActivate, apiCodesGenerate, apiCodesPage, apiCodesVoid, apiLanAddress,
  type BatchSummary, type CodePage, type CodeSegment,
} from '@/api'
import { apiFreezeSegment, apiUnfreezeSegment } from '@/api/p0'

const TABS = computed(() => [
  { v: null as string | null, t: '全部', n: page.value?.statusCounts.all ?? 0 },
  { v: 'active', t: '已激活', n: page.value?.statusCounts.active ?? 0 },
  { v: 'exhausted', t: '已扫完', n: page.value?.statusCounts.exhausted ?? 0 },
  { v: 'void', t: '已作废', n: page.value?.statusCounts.void ?? 0 },
])

const page = ref<CodePage | null>(null)
const batches = ref<BatchSummary[]>([])
const loading = ref(false)
const pageNo = ref(1)
const size = 10
const saving = ref(false)
const status = ref<string | null>(null)
const kw = ref('')
const current = ref<CodeSegment | null>(null)
const generateOpen = ref(false)
const qrCanvas = ref<HTMLCanvasElement>()
const form = reactive({ batchId: 0, count: 1200, activate: false })

const statusText = (s: string) => (s === 'active' ? '已激活' : s === 'exhausted' ? '已扫完' : '已作废')
const statusClass = (s: string) => (s === 'active' ? 'ok' : s === 'exhausted' ? 'warn' : 'bad')
const pad = (n: number) => String(n).padStart(6, '0')
const traceCode = computed(() => current.value?.sampleCode || '')
const publicOrigin = ref('')

async function load() {
  loading.value = true
  try {
    page.value = await apiCodesPage({ kw: kw.value, status: status.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '码段读取失败', 'error')
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

async function openQr(seg: CodeSegment) {
  current.value = seg
  await nextTick()
  if (!qrCanvas.value) return
  const code = seg.sampleCode
  let origin = import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined
  if (!origin) {
    const host = window.location.hostname
    if (host === '127.0.0.1' || host === 'localhost') {
      try {
        const lan = await apiLanAddress()
        origin = `http://${lan.ip}:${window.location.port || '5181'}`
      } catch {
        origin = window.location.origin
      }
    } else {
      origin = window.location.origin
    }
  }
  publicOrigin.value = origin
  await QRCode.toCanvas(qrCanvas.value, `${origin}/t/${code}`, {
    width: 216,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1d1b', light: '#00000000' },
  })
}

function openGenerate() {
  form.batchId = batches.value[0]?.id || 0
  form.count = 1200
  form.activate = false
  generateOpen.value = true
}

async function submitGenerate() {
  if (!form.batchId || !form.count) {
    toast('请选择批次并填写数量', 'warn')
    return
  }
  saving.value = true
  try {
    const seg = await apiCodesGenerate({ batchId: form.batchId, count: form.count })
    if (form.activate) await apiCodesActivate(seg.id)
    toast(`已生成 ${form.count.toLocaleString()} 枚追溯码`)
    generateOpen.value = false
    await load()
  } catch (e: any) {
    toast(e?.message || '生成失败', 'error')
  } finally {
    saving.value = false
  }
}

async function activate(seg: CodeSegment) {
  try {
    await apiCodesActivate(seg.id)
    toast('码段已激活')
    await load()
  } catch (e: any) {
    toast(e?.message || '激活失败', 'error')
  }
}

async function freeze(seg: CodeSegment) {
  try {
    const r: any = await apiFreezeSegment(seg.id)
    if (current.value?.id === seg.id) current.value = { ...current.value, frozen: r?.frozen ?? true } as CodeSegment
    toast('码段已冻结，扫码将暂停')
    await load()
  } catch (e: any) {
    toast(e?.message || '冻结失败', 'error')
  }
}

async function unfreeze(seg: CodeSegment) {
  try {
    await apiUnfreezeSegment(seg.id)
    if (current.value?.id === seg.id) current.value = { ...current.value, frozen: false } as CodeSegment
    toast('码段已解冻')
    await load()
  } catch (e: any) {
    toast(e?.message || '解冻失败', 'error')
  }
}

async function voidIt(seg: CodeSegment) {
  if (!window.confirm(`确定作废 ${seg.prefix} 整个码段？作废后已打印标签将失效。`)) return
  try {
    await apiCodesVoid(seg.id)
    toast('码段已作废', 'warn')
    await load()
  } catch (e: any) {
    toast(e?.message || '作废失败', 'error')
  }
}

async function copyCode() {
  if (!current.value) return
  try {
    await navigator.clipboard.writeText(traceCode.value)
    toast('追溯码已复制')
  } catch {
    toast('复制失败，请手动选择', 'warn')
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
.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px;
  background: var(--paper-2);
  border-radius: var(--r-md);
  margin-bottom: 20px;
}
.qr {
  width: 216px;
  height: 216px;
  background: #f7f6f2;
}
.qr-wrap .m-code {
  margin: 12px 0 0;
  font-size: 11px;
  text-align: center;
}
.qr-hint {
  margin: 6px 0 0;
  font-size: 10.5px;
  color: var(--ink-3);
  text-align: center;
}
.drawer-links {
  display: flex;
  gap: 20px;
  margin-top: 22px;
}
</style>
