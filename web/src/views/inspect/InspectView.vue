<template>
  <div class="module inspect">
    <div class="page-head">
      <div>
        <p class="kicker">质量检测 · QUALITY CONTROL</p>
        <h1>质检</h1>
        <p>农残检测与批次放行 · {{ page?.total ?? 0 }} 个批次 · 合格率 {{ page?.passRate ?? '—' }}%</p>
      </div>
      <div class="head-right">
        <button class="ghost" @click="tplOpen = true">检测模板</button>
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button class="primary" @click="openCreate">开检测单</button>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>待检测</span><b>{{ page?.pending ?? '—' }}</b><em>批</em></div>
      <div><span>合格</span><b>{{ page?.passed ?? '—' }}</b><em>批</em></div>
      <div><span>不合格</span><b :class="{ warn: (page?.failed || 0) > 0 }">{{ page?.failed ?? '—' }}</b><em>批</em></div>
      <div><span>合格率</span><b>{{ page?.passRate ?? '—' }}</b><em>%</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button v-for="t in TABS" :key="String(t.v)" :class="{ on: result === t.v }" @click="result = t.v">
          {{ t.t }}<span class="n">{{ t.n }}</span>
        </button>
      </div>
      <div class="right">
        <input v-model="kw" class="m-search" placeholder="搜批次 / 地块 / 机构" />
        <button v-if="kw || result !== null" class="m-link" @click="reset">清空</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:120px">检测日期</th>
            <th style="width:180px">检测单号</th>
            <th style="width:170px">批次 / 地块</th>
            <th style="width:110px">作物</th>
            <th>检测机构</th>
            <th style="width:70px" class="num-r">项目</th>
            <th style="width:96px">结论</th>
            <th style="width:64px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'sk' + i" class="loading-row">
            <td v-for="j in 8" :key="j"><span class="sk" :style="{ width: 32 + ((j * 11) % 52) + '%' }" /></td>
          </tr>
          <tr
            v-for="r in page?.records || []"
            v-else
            :key="r.id"
            :class="{ 'is-active': detail && detail.id === r.id }"
            @click="detail = r"
          >
            <td class="mono">{{ r.inspectDate }}</td>
            <td class="mono">{{ r.reportNo || '待生成' }}</td>
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.batchNo }}</span>
                <span class="sub">{{ r.plotNo }} {{ r.plotName }}</span>
              </div>
            </td>
            <td>{{ r.cropName }}<span v-if="r.variety" class="sub"> · {{ r.variety }}</span></td>
            <td class="org">{{ r.org }}</td>
            <td class="num-r">{{ r.itemCount }}</td>
            <td><span class="m-tag" :class="resultClass(r.result)">{{ resultText(r.result) }}</span></td>
            <td><button class="m-link" @click.stop="detail = r">查看</button></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">当前筛选下没有检测单。</div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; load() }" />
    </div>

    <SlidePanel
      :open="!!detail"
      title="检测单"
      kicker="INSPECTION REPORT"
      :subtitle="detail ? `${detail.reportNo || '待生成'} · ${detail.batchNo}` : ''"
      @close="detail = null"
    >
      <template v-if="detail">
        <div class="result-head">
          <span class="m-tag" :class="resultClass(detail.result)">{{ resultText(detail.result) }}</span>
          <span class="sub">{{ detail.inspectDate }} · {{ detail.org }}</span>
        </div>

        <dl class="m-kv">
          <div><dt>批次</dt><dd class="mono">{{ detail.batchNo }}</dd></div>
          <div><dt>地块</dt><dd>{{ detail.plotNo }} {{ detail.plotName }}</dd></div>
          <div><dt>作物</dt><dd>{{ detail.cropName }}<span v-if="detail.variety"> · {{ detail.variety }}</span></dd></div>
          <div><dt>检测项目</dt><dd class="mono">{{ detail.itemCount }} 项</dd></div>
        </dl>

        <div class="m-section">
          <div class="m-section-title"><b>农残检测明细</b><span>限量单位 mg/kg</span></div>
          <table class="tbl mini">
            <thead><tr><th>项目</th><th class="num-r">限量</th><th class="num-r">实测</th><th style="width:64px">判定</th></tr></thead>
            <tbody>
              <tr v-for="it in detail.items" :key="it.code">
                <td>{{ it.name }}</td>
                <td class="num-r">{{ it.limit.toFixed(2) }}</td>
                <td class="num-r" :class="{ bad: it.bad }">{{ it.value === null ? '未检出' : it.value.toFixed(3) }}</td>
                <td><span class="m-tag" :class="it.bad ? 'bad' : 'ok'">{{ it.bad ? '超标' : '合格' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="m-section">
          <div class="m-section-title"><b>检测报告</b></div>
          <div class="report-row">
            <a v-if="detail.reportUrl" :href="detail.reportUrl" target="_blank" class="m-link">查看报告 →</a>
            <span v-else class="sub">尚未上传报告</span>
            <label class="m-link upload">
              {{ uploading ? '上传中…' : detail.reportUrl ? '重新上传' : '上传报告' }}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" :disabled="uploading" hidden @change="onReport" />
            </label>
          </div>
          <p class="sub">支持 PDF / PNG / JPG，不超过 10MB；上传后自动归档。</p>
        </div>

        <div v-if="detail.result === 2" class="m-note bad">
          该批次检测不合格，已锁定并暂停赋码与出库；请完成复检或按不合格品流程处置。
        </div>
        <div v-else-if="detail.result === 0" class="m-note">
          检测结果尚未回传，批次保持待检状态；报告出具后可在此更新并放行。
        </div>
        <div v-if="detail.sourceInspectId" class="m-note">该单为复检单，来源检测单 #{{ detail.sourceInspectId }}。</div>
        <div v-if="detail.disposal" class="m-note">
          已处置：{{ detail.disposal }} · {{ detail.disposalNote || '—' }} · {{ detail.disposeTime }}
        </div>

        <div class="drawer-links">
          <button class="m-link" @click="openReport">查看检测报告 PDF</button>
          <button v-if="detail.result === 2" class="m-link" @click="openRecheck(detail)">发起复检</button>
          <button v-if="detail.result === 2 && !detail.disposal" class="m-link danger" @click="openDispose(detail)">不合格处置</button>
          <router-link class="m-link" :to="`/batch/${detail.batchId}`">查看批次详情 →</router-link>
        </div>
      </template>
    </SlidePanel>

    <SlidePanel :open="createOpen" title="开检测单" kicker="NEW INSPECTION" subtitle="按批次录入 6 项农残实测值，系统自动判定" @close="createOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field full">
          <span>批次 / 地块</span>
          <select v-model.number="form.batchId" required>
            <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.batchNo }} · {{ b.plotNo }} {{ b.cropName }}</option>
          </select>
        </label>
        <label class="m-field full">
          <span>检测模板</span>
          <select v-model.number="form.templateId">
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}{{ t.items.length ? `（${t.items.length} 项）` : '' }}</option>
          </select>
        </label>
        <label class="m-field full">
          <span>检测机构</span>
          <select v-model="form.org">
            <option v-for="o in ORGS" :key="o" :value="o">{{ o }}</option>
          </select>
        </label>
        <label class="m-field full">
          <span>检测日期</span>
          <input v-model="form.inspectDate" type="date" required />
        </label>

        <div class="m-field full">
          <span>检测项（留空视为未检出）</span>
          <div class="item-grid">
            <label v-for="it in ITEMS" :key="it.code" class="item-input">
              <span>{{ it.name }} <em>≤ {{ it.limit }}</em></span>
              <input v-model="form.values[it.code]" type="number" step="0.001" min="0" placeholder="未检出" />
            </label>
          </div>
        </div>

        <div class="m-form-actions">
          <button type="button" class="ghost" @click="createOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '提交中…' : '提交检测单' }}</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel :open="tplOpen" title="检测模板" kicker="TEMPLATE" subtitle="模板决定开单时使用的检测项目与限量" @close="tplOpen = false">
      <div class="tpl-list">
        <div v-for="t in templates" :key="t.id" class="tpl">
          <strong>{{ t.name }}</strong>
          <span>{{ t.items.map(i => `${i.name} ≤ ${i.limit}`).join(' · ') }}</span>
        </div>
      </div>
      <form class="m-form" @submit.prevent="saveTemplate">
        <label class="m-field full"><span>新模板名称</span><input v-model.trim="tplName" required placeholder="如：叶菜农残专项" /></label>
        <div class="m-field full">
          <span>检测项目与限量</span>
          <div class="item-grid">
            <label v-for="it in ITEMS" :key="it.code" class="item-input">
              <span>{{ it.name }}</span>
              <input v-model.number="tplLimits[it.code]" type="number" step="0.001" min="0.001" />
            </label>
          </div>
        </div>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="tplOpen = false">关闭</button>
          <button type="submit" class="primary" :disabled="saving">保存模板</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel
      :open="!!recheckTarget"
      title="发起复检"
      kicker="RECHECK"
      :subtitle="recheckTarget ? `${recheckTarget.batchNo} · ${recheckTarget.plotNo}` : ''"
      @close="recheckTarget = null"
    >
      <form v-if="recheckTarget" class="m-form" @submit.prevent="submitRecheck">
        <label class="m-field full">
          <span>检测机构</span>
          <select v-model="recheckForm.org">
            <option v-for="o in ORGS" :key="o" :value="o">{{ o }}</option>
          </select>
        </label>
        <label class="m-field full"><span>复检日期</span><input v-model="recheckForm.date" type="date" required /></label>
        <div class="m-field full">
          <span>复检项目（留空视为未检出）</span>
          <div class="item-grid">
            <label v-for="it in ITEMS" :key="it.code" class="item-input">
              <span>{{ it.name }} <em>≤ {{ it.limit }}</em></span>
              <input v-model="recheckForm.values[it.code]" type="number" step="0.001" min="0" placeholder="未检出" />
            </label>
          </div>
        </div>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="recheckTarget = null">取消</button>
          <button type="submit" class="primary" :disabled="saving">提交复检</button>
        </div>
      </form>
    </SlidePanel>

    <SlidePanel
      :open="!!disposeTarget"
      title="不合格处置"
      kicker="DISPOSAL"
      :subtitle="disposeTarget ? `${disposeTarget.batchNo} · ${disposeTarget.plotNo}` : ''"
      @close="disposeTarget = null"
    >
      <form v-if="disposeTarget" class="m-form" @submit.prevent="submitDispose">
        <label class="m-field full">
          <span>处置方式</span>
          <select v-model="disposeForm.action">
            <option value="DESTROY">销毁</option>
            <option value="RETURN">退回上游</option>
            <option value="DOWNGRADE">降级销售</option>
          </select>
        </label>
        <label class="m-field full"><span>处置说明</span><textarea v-model.trim="disposeForm.note" rows="3" required /></label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="disposeTarget = null">取消</button>
          <button type="submit" class="primary" :disabled="saving">确认处置</button>
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
import { apiCreateInspectTemplate, apiDisposeInspect, apiInspectTemplates, apiRecheckInspect, type InspectTemplate } from '@/api/p0'
import {
  apiBatches, apiInspectCreate, apiInspectPage, apiUploadReport,
  type BatchSummary, type InspectPage, type InspectionRow,
} from '@/api'

const ORGS = ['合肥市农产品质量检测中心', '安徽省农科院检测中心', '肥东县农产品质量安全检测站']
const ITEMS = [
  { code: 'PEST_CHLORPYRIFOS', name: '毒死蜱', limit: 0.02 },
  { code: 'PEST_CARBOFURAN', name: '克百威', limit: 0.02 },
  { code: 'PEST_OMETHOATE', name: '氧乐果', limit: 0.01 },
  { code: 'PEST_DICHLORVOS', name: '敌敌畏', limit: 0.01 },
  { code: 'PEST_CYPERMETHRIN', name: '氯氰菊酯', limit: 0.07 },
  { code: 'PEST_PHORATE', name: '甲拌磷', limit: 0.01 },
]

const TABS = computed(() => [
  { v: null as number | null, t: '全部', n: page.value?.total ?? 0 },
  { v: 0, t: '待检', n: page.value?.pending ?? 0 },
  { v: 1, t: '合格', n: page.value?.passed ?? 0 },
  { v: 2, t: '不合格', n: page.value?.failed ?? 0 },
])

const page = ref<InspectPage | null>(null)
const batches = ref<BatchSummary[]>([])
const loading = ref(false)
const pageNo = ref(1)
const size = 10
const saving = ref(false)
const uploading = ref(false)
const result = ref<number | null>(null)
const kw = ref('')
const detail = ref<InspectionRow | null>(null)
const createOpen = ref(false)
const tplOpen = ref(false)
const templates = ref<InspectTemplate[]>([])
const tplName = ref('')
const tplLimits = reactive<Record<string, number>>({})
const recheckTarget = ref<InspectionRow | null>(null)
const recheckForm = reactive({ org: ORGS[0], date: new Date().toISOString().slice(0, 10), values: {} as Record<string, string> })
const disposeTarget = ref<InspectionRow | null>(null)
const disposeForm = reactive({ action: 'DESTROY' as 'RETURN' | 'DESTROY' | 'DOWNGRADE', note: '' })
const form = reactive({
  batchId: 0,
  templateId: 1,
  org: ORGS[0],
  inspectDate: new Date().toISOString().slice(0, 10),
  values: {} as Record<string, string>,
})

const resultText = (r: number) => (r === 0 ? '待检' : r === 1 ? '合格' : '不合格')
const resultClass = (r: number) => (r === 0 ? 'muted' : r === 1 ? 'ok' : 'bad')

async function onReport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !detail.value) return
  uploading.value = true
  try {
    const r = await apiUploadReport(detail.value.id, file)
    detail.value = { ...detail.value, reportUrl: r.reportUrl }
    if (page.value) {
      const hit = page.value.records.find(x => x.id === detail.value!.id)
      if (hit) hit.reportUrl = r.reportUrl
    }
    toast('报告已上传并归档')
  } catch (err: any) {
    toast(err?.message || '上传失败', 'error')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function load() {
  loading.value = true
  try {
    page.value = await apiInspectPage({ kw: kw.value, result: result.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '检测单读取失败', 'error')
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
  form.batchId = batches.value[0]?.id || 0
  form.org = ORGS[0]
  form.inspectDate = new Date().toISOString().slice(0, 10)
  form.templateId = templates.value[0]?.id || 1
  form.values = {}
  ITEMS.forEach(it => (form.values[it.code] = ''))
  createOpen.value = true
}

async function submit() {
  if (!form.batchId) {
    toast('请选择批次', 'warn')
    return
  }
  saving.value = true
  try {
    const row = await apiInspectCreate({
      batchId: form.batchId,
      templateId: form.templateId,
      org: form.org,
      inspectDate: form.inspectDate,
      items: ITEMS.map(it => ({
        code: it.code,
        value: form.values[it.code] === '' ? null : Number(form.values[it.code]),
      })),
    })
    toast(`检测单已提交：${resultText(row.result)}`, row.result === 2 ? 'error' : 'ok')
    createOpen.value = false
    await load()
  } catch (e: any) {
    toast(e?.message || '提交失败', 'error')
  } finally {
    saving.value = false
  }
}

async function loadTemplates() {
  try {
    templates.value = await apiInspectTemplates()
    if (!templates.value.some(t => t.id === form.templateId)) form.templateId = templates.value[0]?.id || 1
    ITEMS.forEach(it => {
      if (tplLimits[it.code] == null) tplLimits[it.code] = it.limit
    })
  } catch {
    templates.value = []
  }
}

function openReport() {
  if (detail.value?.reportUrl) window.open(detail.value.reportUrl, '_blank')
  else toast('该检测单尚未上传报告', 'warn')
}

function openRecheck(row: InspectionRow) {
  recheckTarget.value = row
  recheckForm.org = row.org || ORGS[0]
  recheckForm.date = new Date().toISOString().slice(0, 10)
  recheckForm.values = {}
  ITEMS.forEach(it => {
    const hit = row.items.find(x => x.code === it.code)
    recheckForm.values[it.code] = hit?.value == null ? '' : String(hit.value)
  })
}

async function submitRecheck() {
  if (!recheckTarget.value) return
  saving.value = true
  try {
    const row = await apiRecheckInspect(recheckTarget.value.id, {
      org: recheckForm.org,
      inspectDate: recheckForm.date,
      templateId: 1,
      items: ITEMS.map(it => ({
        code: it.code,
        value: recheckForm.values[it.code] === '' ? null : Number(recheckForm.values[it.code]),
      })),
    })
    toast(row.result === 1 ? '复检合格，批次已放行' : '复检仍不合格，请处置', row.result === 1 ? 'ok' : 'error')
    recheckTarget.value = null
    await load()
  } catch (e: any) {
    toast(e?.message || '复检提交失败', 'error')
  } finally {
    saving.value = false
  }
}

function openDispose(row: InspectionRow) {
  disposeTarget.value = row
  disposeForm.action = 'DESTROY'
  disposeForm.note = ''
}

async function submitDispose() {
  if (!disposeTarget.value) return
  saving.value = true
  try {
    await apiDisposeInspect(disposeTarget.value.id, { action: disposeForm.action, note: disposeForm.note })
    toast('处置已登记')
    disposeTarget.value = null
    detail.value = null
    await load()
  } catch (e: any) {
    toast(e?.message || '处置失败', 'error')
  } finally {
    saving.value = false
  }
}

async function saveTemplate() {
  if (!tplName.value) {
    toast('请填写模板名称', 'warn')
    return
  }
  saving.value = true
  try {
    await apiCreateInspectTemplate({
      name: tplName.value,
      items: ITEMS.map(it => ({ code: it.code, name: it.name, limit: Number(tplLimits[it.code] || it.limit) })),
    })
    toast('模板已保存')
    tplName.value = ''
    await loadTemplates()
  } catch (e: any) {
    toast(e?.message || '保存模板失败', 'error')
  } finally {
    saving.value = false
  }
}

function reset() {
  kw.value = ''
  result.value = null
}

let timer = 0
watch(result, () => { pageNo.value = 1; load() })
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => { pageNo.value = 1; load() }, 300)
})
onMounted(async () => {
  await Promise.all([load(), loadBatches(), loadTemplates()])
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
.org {
  font-size: 12px;
  color: var(--ink-2);
}
.result-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.mini td {
  height: 36px;
  font-size: 12px;
  padding: 0 10px;
}
.mini th {
  padding: 0 10px 8px;
}
.mini .bad {
  color: var(--alert);
}
.drawer-links {
  display: flex;
  gap: 20px;
  margin-top: 22px;
}
.item-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 2px;
}
.item-input {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  color: var(--ink-2);
}
.item-input em {
  font-style: normal;
  color: var(--ink-3);
  font-family: var(--font-num);
  font-size: 10px;
}
.item-input input {
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: #fffefb;
  padding: 7px 8px;
  font-size: 12px;
  outline: none;
}
.item-input input:focus {
  border-color: var(--pine);
}
@media (max-width: 640px) {
  .item-grid {
    grid-template-columns: 1fr;
  }
}
.tpl-list { display:flex; flex-direction:column; gap:8px; margin-bottom:18px; }
.tpl { border:1px solid var(--line); border-radius:var(--r-sm); padding:10px 12px; display:flex; flex-direction:column; gap:4px; }
.tpl strong { font-size:12.5px; }
.tpl span { font-size:11px; color:var(--ink-3); line-height:1.6; }
</style>
