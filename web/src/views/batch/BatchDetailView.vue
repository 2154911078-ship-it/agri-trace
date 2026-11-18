<template>
  <div class="batch">
    <div class="page-head">
      <div>
        <p class="kicker"><router-link to="/farm">地块 A-01</router-link> / 批次</p>
        <h1>{{ b?.batchNo || '—' }} <span v-if="b" class="m-tag" :class="statusCls">{{ statusText }}</span></h1>
        <p v-if="b">
          {{ b.cropName }}<span v-if="b.variety"> · {{ b.variety }}</span> ·
          {{ b.farmName }} · 播种 {{ b.sowDate }} · 采收 {{ b.harvestDate || '未采收' }}
        </p>
      </div>
      <div class="head-right">
        <router-link v-if="b" class="primary" :to="b.nextActionTo">{{ b.nextAction }}</router-link>
      </div>
    </div>

    <div class="stage-wrap">
      <StageTrack :stages="stages" />
    </div>

    <div v-for="g in b?.gaps || []" :key="g.key" class="gap">
      <span>{{ g.text }}</span>
      <router-link :to="g.to">{{ g.action }} →</router-link>
    </div>

    <div v-if="b" class="grid-12 cols">
      <section class="col-4">
        <div class="panel-head"><h2>生产</h2><span class="unit">{{ b.produceCount }} 条记录</span></div>
        <ol class="recs">
          <li v-for="r in b.produce" :key="r.id">
            <time class="mono">{{ r.happenTime.slice(5, 16) }}</time>
            <div><strong>{{ r.type }}</strong><p>{{ r.detail }}</p></div>
          </li>
        </ol>
      </section>

      <section class="col-4">
        <div class="panel-head">
          <h2>质量</h2>
          <span class="unit" v-if="b.inspect">
            <i class="dot" :class="b.inspect.result === 1 ? 'dot-growing' : 'dot-alert'" />
            {{ b.inspect.result === 1 ? '合格' : '不合格' }}
          </span>
        </div>

        <template v-if="b.inspect">
          <dl class="spec">
            <div><dt>检测机构</dt><dd>{{ b.inspect.org }}</dd></div>
            <div><dt>检测日期</dt><dd class="mono">{{ b.inspect.inspectDate }}</dd></div>
            <div><dt>检测项目</dt><dd class="mono">{{ b.inspect.itemCount }} 项</dd></div>
          </dl>

          <table class="tbl mini-tbl">
            <thead>
              <tr><th>项目</th><th class="num-r">限量</th><th class="num-r">实测</th></tr>
            </thead>
            <tbody>
              <tr v-for="it in b.inspect.items" :key="it.code">
                <td>{{ it.name }}</td>
                <td class="num-r">{{ it.limit.toFixed(2) }}</td>
                <td class="num-r" :class="{ bad: it.bad }">
                  {{ it.value === null ? '未检出' : it.value.toFixed(3) }}
                </td>
              </tr>
            </tbody>
          </table>
          <a v-if="b.inspect.reportUrl" class="file" :href="b.inspect.reportUrl">检测报告 PDF</a>
        </template>
      </section>

      <section class="col-4">
        <div class="panel-head"><h2>流通</h2><span class="unit">赋码 {{ b.codes.total }} 枚</span></div>
        <dl class="spec">
          <div><dt>已激活</dt><dd class="mono">{{ b.codes.active }} / {{ b.codes.total }}</dd></div>
          <div><dt>已扫码</dt><dd class="mono">{{ b.codes.scanned }} 次</dd></div>
          <div v-if="b.ship"><dt>承运</dt><dd>{{ b.ship.carrier }} {{ b.ship.plateNo }}</dd></div>
          <div v-if="b.ship"><dt>发车</dt><dd class="mono">{{ b.ship.startTime }}</dd></div>
          <div v-if="b.sale"><dt>经销</dt><dd>{{ b.sale.dealer }}</dd></div>
          <div v-if="b.sale"><dt>数量</dt><dd class="mono">{{ b.sale.qty }} 件</dd></div>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StageTrack from '@/components/batch/StageTrack.vue'
import type { Stage } from '@/components/batch/StageTrack.vue'
import { apiBatch, type BatchSummary } from '@/api'

const route = useRoute()
const b = ref<BatchSummary | null>(null)
const STATUS_TEXT: Record<string, string> = {
  GROWING: '生长中', PENDING_HARVEST: '待采收', HARVESTED: '已采收', PROCESSING: '加工中',
  INSPECTED: '已质检', CODED: '已赋码', SHIPPED: '已发运', BLOCKED: '预警锁定',
}
const statusText = computed(() => STATUS_TEXT[b.value?.status || ''] || b.value?.status || '—')
const statusCls = computed(() => b.value?.status === 'BLOCKED' ? 'bad' : b.value?.status === 'PENDING_HARVEST' ? 'warn' : 'ok')

const stages = computed<Stage[]>(() => {
  const v = b.value
  if (!v) return []
  return [
    { key: 'produce', name: '生产', time: v.sowDate, state: v.sowDate ? 'done' : 'todo' },
    { key: 'harvest', name: '采收', time: v.harvestDate, state: v.harvestDate ? 'done' : 'current' },
    { key: 'process', name: '加工', time: v.processAt, state: v.processAt ? 'done' : 'missing' },
    { key: 'inspect', name: '质检', time: v.inspect ? v.inspect.inspectDate : undefined, state: v.inspect ? 'done' : 'todo' },
    { key: 'code', name: '赋码', time: v.codesLastAt, state: v.codesLastAt ? 'done' : 'todo' },
    { key: 'ship', name: '流通', time: v.ship ? v.ship.startTime.slice(5, 10) : undefined, state: v.ship ? 'done' : 'todo' },
  ]
})

onMounted(async () => {
  b.value = await apiBatch(Number(route.params.id) || 1)
})
</script>

<style scoped>
.batch {
  max-width: 1440px;
}
.kicker a {
  color: var(--ink-3);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.kicker a:hover {
  color: var(--pine);
  border-color: var(--pine);
}
.head-right {
  display: flex;
  gap: 12px;
}
.stage-wrap {
  padding: 26px 0 30px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.gap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--paper-2);
  border-left: 2px solid var(--wheat);
  font-size: 12.5px;
  color: var(--ink-2);
}
.gap a {
  color: var(--pine);
  text-decoration: none;
  white-space: nowrap;
}
.cols {
  margin-top: 30px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
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
.recs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.recs li {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 10px;
  padding-left: 11px;
  border-left: 1px solid var(--line);
}
.recs time {
  font-size: 10.5px;
  color: var(--ink-3);
  padding-top: 2px;
}
.recs strong {
  font-size: 12.5px;
  font-weight: 500;
}
.recs p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--ink-3);
  line-height: 1.55;
}
.spec {
  margin: 0 0 16px;
}
.spec div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
}
.spec dt {
  font-size: 11.5px;
  color: var(--ink-3);
}
.spec dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink);
  text-align: right;
}
.mono {
  font-family: var(--font-num);
  font-size: 11.5px;
}
.mini-tbl td {
  height: 36px;
  font-size: 12px;
}
.mini-tbl .bad {
  color: var(--alert);
}
.file {
  display: inline-block;
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--pine);
  text-decoration: none;
  border-bottom: 1px solid var(--pine);
  padding-bottom: 1px;
}
</style>