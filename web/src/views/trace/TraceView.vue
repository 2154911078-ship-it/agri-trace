<template>
  <div class="trace">
    <div class="page-head">
      <div>
        <p class="kicker">追溯码</p>
        <h1 class="code mono">{{ code }}</h1>
        <p v-if="t">
          {{ t.productName }}<span v-if="t.variety"> · {{ t.variety }}</span> ·
          {{ t.farmName }} · 采收 {{ t.harvestDate }}
        </p>
      </div>
      <div class="head-right">
        <span v-if="t" class="scan">
          已被扫描 <b class="mono">{{ t.scanCount }}</b> 次
        </span>
        <router-link class="ghost" to="/farm">返回地块</router-link>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>产品</span><b class="serif">{{ t?.productName || '—' }}</b><em>{{ t?.grade }}</em></div>
      <div><span>批次</span><b class="mono small">{{ t?.batchNo || '—' }}</b></div>
      <div><span>产地</span><b class="serif small">{{ t?.region || '—' }}</b></div>
      <div><span>检测结论</span><b class="serif" :class="{ warn: t?.inspectResult !== '合格' }">{{ t?.inspectResult || '—' }}</b></div>
      <div><span>节点数</span><b class="mono">{{ t?.timeline.length || 0 }}</b><em>条</em></div>
    </div>

    <div class="grid-12 sec">
      <section class="col-7">
        <div class="panel-head">
          <h2>全链路记录</h2>
          <span class="unit">按发生时间正序</span>
        </div>
        <TraceTimeline :events="t?.timeline || []" />
      </section>

      <section class="col-5">
        <div class="panel-head"><h2>产品档案</h2></div>
        <dl class="spec">
          <div><dt>批次号</dt><dd class="mono">{{ t?.batchNo }}</dd></div>
          <div><dt>品种 / 等级</dt><dd>{{ t?.variety }} · {{ t?.grade }}</dd></div>
          <div><dt>规格</dt><dd>{{ t?.packageSpec }}</dd></div>
          <div><dt>地块</dt><dd>{{ t?.plotNo }}</dd></div>
          <div><dt>采收日期</dt><dd class="mono">{{ t?.harvestDate }}</dd></div>
          <div><dt>产量</dt><dd class="mono">{{ (t?.yieldKg || 0).toLocaleString() }} kg</dd></div>
          <div><dt>检测机构</dt><dd>{{ t?.inspectOrg || '—' }}</dd></div>
          <div><dt>报告编号</dt><dd class="mono">{{ t?.reportNo || '—' }}</dd></div>
        </dl>
        <a v-if="t?.reportUrl" class="file" :href="t.reportUrl">下载检测报告</a>

        <div class="chain">
          <div class="chain-head">
            <h3>存证</h3>
            <button class="ghost tiny" :disabled="verifying" @click="verify">
              {{ verifying ? '校验中…' : '校验一致性' }}
            </button>
          </div>
          <p class="lbl">数据摘要</p>
          <p class="hash mono">{{ t?.dataHash || '—' }}</p>
          <p class="lbl">链上交易</p>
          <p class="hash mono">{{ t?.chainTx || '—' }}</p>
          <p v-if="verified !== null" class="ok" :data-ok="verified">
            {{ verified ? '校验通过：链上摘要与本条记录一致' : '校验不一致：请以检测机构原始报告为准' }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TraceTimeline from '@/components/trace/TraceTimeline.vue'
import { apiTrace, apiTraceVerify, type TraceVO } from '@/api'

const route = useRoute()
const t = ref<TraceVO | null>(null)
const verifying = ref(false)
const verified = ref<boolean | null>(null)
const code = ref(String(route.params.code || ''))

const load = async () => {
  t.value = await apiTrace(code.value)
}

async function verify() {
  verifying.value = true
  try {
    const r = await apiTraceVerify(code.value)
    verified.value = r.ok
  } finally {
    verifying.value = false
  }
}

onMounted(load)
watch(() => route.params.code, c => {
  if (!c) return
  code.value = String(c)
  verified.value = null
  load()
})
</script>

<style scoped>
.trace {
  max-width: 1440px;
}
.code {
  font-size: 22px !important;
  letter-spacing: 0.04em !important;
  font-family: var(--font-num) !important;
  font-weight: 500 !important;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.scan {
  font-size: 11.5px;
  color: var(--ink-3);
}
.scan b {
  color: var(--ink);
  font-size: 12.5px;
}
.serif {
  font-family: var(--font-serif);
  font-size: 19px !important;
  font-weight: 600 !important;
}
.small {
  font-size: 13px !important;
  font-weight: 500 !important;
}
.mono {
  font-family: var(--font-num);
}
.sec {
  margin-top: 30px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.panel-head h2 {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.unit {
  font-size: 11px;
  color: var(--ink-3);
}
.spec {
  margin: 0;
}
.spec div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.spec dt {
  font-size: 11.5px;
  color: var(--ink-3);
}
.spec dd {
  margin: 0;
  font-size: 12.5px;
  text-align: right;
}
.file {
  display: inline-block;
  margin-top: 14px;
  font-size: 11.5px;
  color: var(--pine);
  text-decoration: none;
  border-bottom: 1px solid var(--pine);
  padding-bottom: 1px;
}
.chain {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.chain-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.chain-head h3 {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  font-weight: 400;
  margin: 0;
}
.tiny {
  height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}
.lbl {
  font-size: 10.5px;
  color: var(--ink-3);
  margin: 12px 0 4px;
}
.hash {
  font-family: var(--font-num);
  font-size: 10.5px;
  color: var(--ink-2);
  word-break: break-all;
  line-height: 1.6;
  margin: 0;
}
.ok {
  margin: 16px 0 0;
  font-size: 11.5px;
  color: var(--pine);
  padding-left: 10px;
  border-left: 2px solid var(--pine);
}
.ok[data-ok='false'] {
  color: var(--alert);
  border-left-color: var(--alert);
}
</style>