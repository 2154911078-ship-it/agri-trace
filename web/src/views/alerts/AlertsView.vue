<template>
  <div class="alerts-page">
    <header class="page-head">
      <div>
        <p class="kicker">风险处置 · ALERT CENTER</p>
        <h1>预警</h1>
        <p>质量与冷链异常统一处置：认领、跟进、解除后自动恢复批次状态。</p>
      </div>
      <button class="ghost" :disabled="loading" @click="load">刷新</button>
    </header>

    <div class="stats">
      <div><span>待处理</span><b class="bad">{{ page?.pending ?? '—' }}</b><em>条</em></div>
      <div><span>处理中</span><b class="warn">{{ page?.acked ?? '—' }}</b><em>条</em></div>
      <div><span>已解除</span><b>{{ page?.resolved ?? '—' }}</b><em>条</em></div>
      <div><span>当前农场</span><b class="farm">{{ farmName }}</b></div>
    </div>

    <div class="toolbar">
      <div class="tabs">
        <button v-for="t in TABS" :key="String(t.v)" :class="{ on: status === t.v }" @click="pick(t.v)">
          {{ t.t }}<span>{{ t.n }}</span>
        </button>
      </div>
      <input v-model="kw" class="m-search" placeholder="搜批次 / 地块 / 预警内容" />
    </div>

    <div class="table-wrap">
      <table class="m-table">
        <thead>
          <tr>
            <th style="width:80px">级别</th>
            <th style="width:110px">类型</th>
            <th style="width:200px">对象</th>
            <th>预警内容</th>
            <th style="width:150px">状态</th>
            <th style="width:140px">发生时间</th>
            <th style="width:72px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 4" :key="'sk' + i" class="loading-row">
            <td colspan="7"><span class="sk" style="width: 100%" /></td>
          </tr>
          <tr v-for="r in page?.records || []" v-else :key="r.id" @click="openDetail(r)">
            <td><span class="m-tag" :class="levelClass(r.level)">{{ r.levelName }}</span></td>
            <td>{{ r.typeName }}</td>
            <td class="mono obj" :title="r.plotNo ? `${r.batchNo || '—'} · ${r.plotNo}` : (r.batchNo || '—')">
              <span class="batch">{{ r.batchNo || '—' }}</span><span v-if="r.plotNo" class="sub"> · {{ r.plotNo }}</span>
            </td>
            <td class="msg" :title="r.message">{{ listMsg(r) }}</td>
            <td class="status-cell">
              <span class="m-tag" :class="statusClass(r.status)">{{ r.statusName }}</span>
              <span v-if="r.escalated" class="m-tag bad esc">已升级</span>
            </td>
            <td class="mono sub">{{ r.createTime }}</td>
            <td><button class="m-link" @click.stop="openDetail(r)">处置</button></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !(page?.records || []).length" class="empty">
        当前筛选下没有预警。
        <a @click="reset">清空筛选</a>
      </div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="changePage" />
    </div>

    <SlidePanel
      :open="!!detail"
      title="预警处置"
      kicker="ALERT"
      :subtitle="detail ? `${detail.typeName} · ${detail.batchNo || ''}` : ''"
      @close="detail = null"
    >
      <template v-if="detail">
        <div class="alert-head">
          <span class="m-tag" :class="levelClass(detail.level)">{{ detail.levelName }}</span>
          <span class="m-tag" :class="statusClass(detail.status)">{{ detail.statusName }}</span>
          <span v-if="detail.escalated" class="m-tag bad">已升级</span>
          <span class="sub mono">{{ detail.createTime }}</span>
        </div>
        <p class="alert-msg">{{ detail.message }}</p>
        <dl class="kv two">
          <div><dt>批次</dt><dd class="mono">{{ detail.batchNo || '—' }}</dd></div>
          <div><dt>地块</dt><dd>{{ detail.plotNo || '—' }} {{ detail.plotName || '' }}</dd></div>
          <div><dt>农场</dt><dd>{{ detail.farmName || '—' }}</dd></div>
          <div><dt>类型</dt><dd>{{ detail.typeName }}</dd></div>
          <div v-if="detail.ackUser"><dt>认领人</dt><dd>{{ detail.ackUser }}</dd></div>
          <div v-if="detail.ackTime"><dt>认领时间</dt><dd class="mono">{{ detail.ackTime }}</dd></div>
          <div v-if="detail.resolveUser"><dt>解除人</dt><dd>{{ detail.resolveUser }}</dd></div>
          <div v-if="detail.resolveTime"><dt>解除时间</dt><dd class="mono">{{ detail.resolveTime }}</dd></div>
        </dl>
        <p v-if="detail.resolveNote" class="m-note">处理说明：{{ detail.resolveNote }}</p>

        <div v-if="detail.status !== 2" class="assign-row">
          <span>指派给</span>
          <select v-model.number="assignee">
            <option v-for="u in assignableUsers" :key="u.id" :value="u.id">{{ u.name }} · {{ u.role }}</option>
          </select>
          <button class="ghost" :disabled="saving" @click="assign">指派</button>
        </div>

        <label v-if="detail.status !== 2" class="note">
          <span>处理说明</span>
          <textarea v-model.trim="note" rows="3" placeholder="记录处置措施，解除预警时写入审计日志" />
        </label>

        <div class="acts">
          <button v-if="detail.status === 0" class="ghost" :disabled="saving" @click="ack">认领预警</button>
          <button v-if="detail.status !== 2" class="primary" :disabled="saving" @click="resolve">
            {{ saving ? '处理中…' : '解除预警' }}
          </button>
          <router-link v-if="detail.batchId" class="m-link" :to="`/batch/${detail.batchId}`">查看批次 →</router-link>
        </div>
      </template>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import MPager from '@/components/ui/MPager.vue'
import { apiAlertAck, apiAlertResolve, apiAlerts, apiSysPage, type AlertPage, type AlertRow } from '@/api'
import { apiAssignAlert } from '@/api/p0'
import { farmName } from '@/stores/farm'
import { toast } from '@/utils/toast'

const page = ref<AlertPage | null>(null)
const loading = ref(false)
const saving = ref(false)
const detail = ref<AlertRow | null>(null)
const note = ref('')
const users = ref<{ id: number; name: string; role: string; farm: string }[]>([])
const assignee = ref(0)
const status = ref<number | null>(null)
const kw = ref('')
const pageNo = ref(1)
const size = 20

const TABS = computed(() => [
  { v: null, t: '全部', n: page.value?.total ?? 0 },
  { v: 0, t: '待处理', n: page.value?.pending ?? 0 },
  { v: 1, t: '处理中', n: page.value?.acked ?? 0 },
  { v: 2, t: '已解除', n: page.value?.resolved ?? 0 },
])
const assignableUsers = computed(() =>
  users.value.filter(u => u.id === 1 || !detail.value?.farmName || u.farm === detail.value.farmName))

const levelClass = (l: number) => (l >= 3 ? 'bad' : l === 2 ? 'warn' : 'ok')
const statusClass = (s: number) => (s === 0 ? 'bad' : s === 1 ? 'warn' : 'ok')
const listMsg = (r: AlertRow) => {
  const msg = r.message || ''
  const batch = r.batchNo || ''
  if (!batch || !msg.startsWith(batch)) return msg
  return msg.slice(batch.length).replace(/^[\s·:：—-]+/, '') || msg
}

async function load() {
  loading.value = true
  try {
    page.value = await apiAlerts({ kw: kw.value, status: status.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '预警读取失败', 'error')
  } finally {
    loading.value = false
  }
}

function pick(v: number | null) {
  status.value = v
  pageNo.value = 1
  load()
}
function changePage(p: number) {
  pageNo.value = p
  load()
}
function reset() {
  kw.value = ''
  status.value = null
  pageNo.value = 1
  load()
}

function openDetail(r: AlertRow) {
  detail.value = { ...r }
  note.value = r.resolveNote || ''
  assignee.value = assignableUsers.value.find(u => u.id !== 1)?.id || assignableUsers.value[0]?.id || 0
}

async function loadUsers() {
  try {
    const data = await apiSysPage()
    users.value = data.users.map(u => ({ id: u.id, name: u.name, role: u.role, farm: u.farm }))
  } catch {
    users.value = []
  }
}

async function assign() {
  if (!detail.value || !assignee.value) return
  saving.value = true
  try {
    const row = await apiAssignAlert(detail.value.id, assignee.value)
    detail.value = { ...row }
    toast('已指派并通知处理人')
    await load()
  } catch (e: any) {
    toast(e?.message || '指派失败', 'error')
  } finally {
    saving.value = false
  }
}

async function refreshDetail(id: number) {
  const data = await apiAlerts({ page: 1, size: 200 })
  const hit = data.records.find(r => r.id === id)
  if (hit) detail.value = hit
  await load()
}

async function ack() {
  if (!detail.value) return
  saving.value = true
  try {
    await apiAlertAck(detail.value.id)
    toast('已认领，请跟进处置')
    await refreshDetail(detail.value.id)
  } catch (e: any) {
    toast(e?.message || '认领失败', 'error')
  } finally {
    saving.value = false
  }
}

async function resolve() {
  if (!detail.value) return
  saving.value = true
  try {
    await apiAlertResolve(detail.value.id, note.value)
    toast('预警已解除，批次与地块状态已联动恢复')
    await refreshDetail(detail.value.id)
    window.dispatchEvent(new CustomEvent('agri-farm-changed', { detail: {} }))
  } catch (e: any) {
    toast(e?.message || '解除失败', 'error')
  } finally {
    saving.value = false
  }
}

let timer = 0
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    pageNo.value = 1
    load()
  }, 300)
})
onMounted(() => { load(); loadUsers() })
</script>

<style scoped>
.alerts-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.kicker {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  margin: 0 0 6px;
}
h1 {
  font-family: var(--font-serif);
  font-size: 30px;
  font-weight: 500;
  margin: 0 0 6px;
}
.page-head p {
  margin: 0;
  font-size: 12px;
  color: var(--ink-3);
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--paper);
}
.stats div {
  padding: 16px 18px;
  border-right: 1px solid var(--line);
}
.stats div:last-child {
  border-right: 0;
}
.stats span {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 6px;
}
.stats b {
  font-family: var(--font-num);
  font-size: 24px;
  font-weight: 500;
}
.stats b.bad {
  color: var(--alert);
}
.stats b.warn {
  color: #a8813c;
}
.stats b.farm {
  font-family: inherit;
  font-size: 15px;
}
.stats em {
  font-style: normal;
  font-size: 11px;
  color: var(--ink-3);
  margin-left: 4px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tabs {
  display: flex;
  gap: 4px;
}
.tabs button {
  border: 1px solid transparent;
  background: none;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--ink-3);
  cursor: pointer;
}
.tabs button span {
  margin-left: 5px;
  font-size: 10.5px;
  opacity: 0.7;
}
.tabs button.on {
  background: var(--pine-soft, #e7efeb);
  color: var(--pine);
}
.table-wrap {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 4px 16px 12px;
  background: var(--paper);
  overflow-x: auto;
}
.m-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12.5px;
}
.m-table th {
  padding: 13px 12px 10px;
  border-bottom: 1px solid var(--line-strong);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  text-align: left;
  white-space: nowrap;
}
.m-table td {
  height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-2);
  vertical-align: middle;
  white-space: nowrap;
}
.m-table tbody tr {
  cursor: pointer;
  transition: background 0.14s var(--ease);
}
.m-table tbody tr:hover {
  background: var(--paper-2);
}
.m-table tbody tr:last-child td {
  border-bottom: 0;
}
.m-table .m-tag {
  vertical-align: middle;
}
.m-table .obj,
.m-table .msg {
  overflow: hidden;
  text-overflow: ellipsis;
}
.m-table .obj .batch {
  color: var(--ink);
}
.msg {
  color: var(--ink-2);
}
.status-cell .esc {
  margin-left: 5px;
  height: 19px;
  padding: 0 7px;
  font-size: 10px;
  background: transparent;
  border: 1px solid rgba(180, 70, 47, 0.3);
}
.empty {
  padding: 38px 0;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}
.empty a {
  color: var(--pine);
  cursor: pointer;
  margin-left: 6px;
}
.alert-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.alert-msg {
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 18px;
}
.assign-row { display:flex; align-items:center; gap:8px; margin:16px 0; font-size:11.5px; color:var(--ink-3); }
.assign-row select { border:1px solid var(--line); border-radius:var(--r-sm); padding:6px 8px; font-size:12px; background:var(--paper-2); color:var(--ink); }
.note {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 18px 0;
  font-size: 11.5px;
  color: var(--ink-3);
}
.note textarea {
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--paper-2);
  padding: 10px 12px;
  font: inherit;
  color: var(--ink);
  resize: vertical;
}
.acts {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
