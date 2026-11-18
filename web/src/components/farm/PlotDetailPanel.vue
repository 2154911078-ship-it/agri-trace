<template>
  <transition name="drawer">
    <aside v-if="plotId" class="panel">
      <button class="x" @click="$emit('close')">×</button>

      <template v-if="d">
        <p class="kicker">{{ d.plotNo }} · {{ d.name }}</p>
        <h2 class="crop">{{ d.cropName }}<span v-if="d.variety"> / {{ d.variety }}</span></h2>

        <div class="stats">
          <div><span>面积</span><b class="mono">{{ d.areaMu.toFixed(2) }} 亩</b></div>
          <div><span>土壤</span><b>{{ d.soilType || '—' }}</b></div>
          <div><span>负责人</span><b>{{ d.manager || '—' }}</b></div>
          <div><span>在田批次</span><b class="mono">{{ d.batchNo || '—' }}</b></div>
        </div>

        <section v-if="d.plantDate" class="prog">
          <div class="pt">
            <span>生长进度</span>
            <span class="mono">第 {{ d.growthDays }} 天 · {{ Math.round((d.progress || 0) * 100) }}%</span>
          </div>
          <div class="bar"><i :style="{ width: `${(d.progress || 0) * 100}%` }" /></div>
          <p class="note">播种 {{ d.plantDate }} · 预计产量 {{ d.expectYieldKg }} kg</p>
        </section>

        <section class="rec">
          <h3>最近农事</h3>
          <ol>
            <li v-for="r in d.records.slice(0, 4)" :key="r.id">
              <time class="mono">{{ r.happenTime.slice(5, 16) }}</time>
              <div><strong>{{ r.type }}</strong><p>{{ r.detail }}</p></div>
              <em>{{ r.operator }}</em>
            </li>
          </ol>
        </section>

        <footer class="acts">
          <router-link class="primary" :to="batchTo" :class="{ off: !batch }">{{ batch ? '查看批次' : '暂无批次' }}</router-link>
          <router-link class="ghost" :to="traceTo">追溯链</router-link>
        </footer>
      </template>

      <div v-else class="sk-wrap">
        <i /><i /><i /><i />
      </div>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiPlotBatch, apiPlotDetail, type BatchSummary, type PlotDetail } from '@/api'

const props = defineProps<{ plotId: number | null }>()
defineEmits<{ close: [] }>()

const d = ref<PlotDetail | null>(null)
const batch = ref<BatchSummary | null>(null)

const batchTo = computed(() => (batch.value ? `/batch/${batch.value.id}` : '/farm'))
const traceTo = computed(() => batch.value?.nextActionTo || '/trace')

watch(
  () => props.plotId,
  async id => {
    d.value = null
    batch.value = null
    if (!id) return
    d.value = await apiPlotDetail(id)
    batch.value = await apiPlotBatch(id).catch(() => null)
  },
  { immediate: true },
)
</script>

<style scoped>
.panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  background: var(--paper);
  border-left: 1px solid var(--line);
  padding: 40px 30px 26px;
  overflow-y: auto;
  box-shadow: var(--sh-pop);
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 20;
}
.x {
  position: absolute;
  right: 16px;
  top: 14px;
  border: 0;
  background: none;
  font-size: 20px;
  line-height: 1;
  color: var(--ink-3);
  cursor: pointer;
  border-radius: 4px;
}
.x:hover { color: var(--ink); }
.kicker {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
  margin: 0;
}
.crop {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  line-height: 1.3;
}
.crop span {
  color: var(--ink-2);
  font-size: 17px;
  font-weight: 400;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 12px;
  padding: 18px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.stats span {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 5px;
}
.stats b {
  font-size: 13.5px;
  font-weight: 500;
}
.mono { font-family: var(--font-num); }
.pt {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ink-2);
  margin-bottom: 9px;
}
.bar {
  height: 3px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--pine);
  transition: width 0.45s var(--ease);
}
.note {
  font-size: 11.5px;
  color: var(--ink-3);
  margin: 9px 0 0;
}
.rec h3 {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  margin: 0 0 14px;
  font-weight: 400;
}
.rec ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.rec li {
  display: grid;
  grid-template-columns: 62px 1fr auto;
  gap: 10px;
  font-size: 12.5px;
  padding-left: 11px;
  border-left: 1px solid var(--line);
}
.rec time {
  color: var(--ink-3);
  font-size: 10.5px;
  padding-top: 2px;
}
.rec strong { font-weight: 500; }
.rec p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--ink-2);
  line-height: 1.55;
}
.rec em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--ink-3);
}
.acts {
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
}
.acts .primary,
.acts .ghost { flex: 1; }
.sk-wrap i {
  display: block;
  height: 13px;
  background: var(--paper-2);
  border-radius: 4px;
  margin-bottom: 12px;
}
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.26s var(--ease), opacity 0.26s var(--ease);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(16px);
  opacity: 0;
}
</style>