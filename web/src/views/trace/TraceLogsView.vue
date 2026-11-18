<template>
  <div class="module trace-list">
    <div class="page-head">
      <div>
        <p class="kicker">追溯查询 · TRACEABILITY</p>
        <h1>追溯</h1>
        <p>消费者扫码记录与批次链路 · 最近 {{ page?.total ?? 0 }} 个追溯码</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button class="primary" @click="focusQuery">输入追溯码</button>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>追溯码</span><b>{{ page?.total ?? '—' }}</b><em>个</em></div>
      <div><span>今日扫码</span><b>{{ page?.scansToday ?? '—' }}</b><em>次</em></div>
      <div><span>首次查询</span><b>{{ page?.firstScans ?? '—' }}</b><em>次</em></div>
      <div><span>异常批次</span><b :class="{ warn: (page?.alerts || 0) > 0 }">{{ page?.alerts ?? '—' }}</b><em>个</em></div>
    </div>

    <div class="query-bar">
      <div class="query-input">
        <span class="q-label">追溯码</span>
        <input
          ref="queryEl"
          v-model.trim="kw"
          placeholder="输入完整追溯码，按 Enter 查询"
          @keyup.enter="queryExact"
        />
        <button class="primary" @click="queryExact">查询</button>
      </div>
      <p class="q-hint">支持扫码枪直接回车；也可按批次号、产品名筛选下方最近记录。</p>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: onlyAlert === false }" @click="onlyAlert = false">全部记录<span class="n">{{ page?.total ?? 0 }}</span></button>
        <button :class="{ on: onlyAlert === true }" @click="onlyAlert = true">异常批次<span class="n">{{ page?.alerts ?? 0 }}</span></button>
      </div>
      <div class="right">
        <span class="sub">最近扫码记录</span>
      </div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl trace-table">
        <thead>
          <tr>
            <th style="width:250px">追溯码</th>
            <th style="width:170px">批次 / 产品</th>
            <th style="width:150px">农场</th>
            <th style="width:80px" class="num-r">扫码</th>
            <th style="width:136px">最近扫码</th>
            <th>扫码位置</th>
            <th style="width:100px">状态</th>
            <th style="width:146px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 6" :key="'sk' + i" class="loading-row">
            <td v-for="j in 8" :key="j"><span class="sk" :style="{ width: 33 + ((j * 9) % 50) + '%' }" /></td>
          </tr>
          <tr v-for="r in rows" v-else :key="r.code" @click="openTrace(r.code)">
            <td class="mono code-cell">{{ r.code }}</td>
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ r.batchNo }}</span>
                <span class="sub">{{ r.productName }}</span>
              </div>
            </td>
            <td>{{ r.farmName }}</td>
            <td class="num-r">{{ r.scanCount }}</td>
            <td class="mono">{{ r.lastScanAt.slice(5, 16) }}</td>
            <td class="loc-cell" :title="r.location">{{ r.location }}</td>
            <td>
              <span v-if="r.alert" class="m-tag bad">异常</span>
              <span v-else-if="r.firstScan" class="m-tag warn">首次查询</span>
              <span v-else class="m-tag ok">正常</span>
            </td>
            <td>
              <div class="m-actions">
                <button class="m-link" @click.stop="openTrace(r.code)">链路</button>
                <a class="m-link" :href="`/t/${r.code}`" target="_blank" @click.stop>消费者页</a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !rows.length" class="empty">
        没有匹配的追溯记录。<a @click="kw = ''">清空关键词</a>
      </div>
      <MPager :page="pageNo" :size="size" :total="page?.total || 0" @change="p => { pageNo = p; load() }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/utils/toast'
import { apiTrace, apiTraceLogs, type TraceLogPage, type TraceLogRow } from '@/api'
import MPager from '@/components/ui/MPager.vue'

const router = useRouter()
const page = ref<TraceLogPage | null>(null)
const loading = ref(false)
const pageNo = ref(1)
const size = 10
const kw = ref('')
const onlyAlert = ref(false)
const queryEl = ref<HTMLInputElement>()

const rows = computed<TraceLogRow[]>(() => {
  const list = page.value?.records || []
  return onlyAlert.value ? list.filter(r => r.alert) : list
})

async function load() {
  loading.value = true
  try {
    page.value = await apiTraceLogs({ kw: kw.value, page: pageNo.value, size })
  } catch (e: any) {
    toast(e?.message || '追溯记录读取失败', 'error')
  } finally {
    loading.value = false
  }
}

async function queryExact() {
  const code = kw.value.trim()
  if (!code) {
    toast('请输入追溯码', 'warn')
    return
  }
  try {
    const t = await apiTrace(code)
    router.push(`/trace/${t.code}`)
  } catch (e: any) {
    toast(e?.message || '追溯码不存在', 'error')
  }
}

function openTrace(code: string) {
  router.push(`/trace/${code}`)
}

function focusQuery() {
  queryEl.value?.focus()
}

let timer = 0
watch(kw, () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => { pageNo.value = 1; load() }, 300)
})
onMounted(load)
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
.query-bar {
  margin-top: 22px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--paper-2);
}
.query-input {
  display: flex;
  align-items: center;
  gap: 12px;
}
.q-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  white-space: nowrap;
}
.query-input input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: 0;
  border-bottom: 1px solid var(--line-strong);
  background: none;
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink);
  outline: none;
}
.query-input input:focus {
  border-color: var(--pine);
}
.query-input .primary {
  height: 36px;
}
.q-hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--ink-3);
}
.code-cell {
  font-size: 10.5px;
  letter-spacing: 0;
}
.trace-table {
  min-width: 1160px;
}
.loc-cell {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--ink-2);
}
</style>
