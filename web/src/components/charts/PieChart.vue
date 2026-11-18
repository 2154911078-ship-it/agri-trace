<template>
  <div class="pie-card" :style="{ height: height + 'px' }">
    <div ref="el" class="pie" />
    <ul v-if="rows.length" class="legend">
      <li v-for="(item, i) in rows" :key="item.name">
        <div class="line">
          <span class="dot" :style="{ background: color(i) }" />
          <span class="name">{{ item.name }}</span>
          <span class="pct">{{ item.pct }}<small>%</small></span>
        </div>
        <div class="track">
          <i :style="{ width: Math.max(Number(item.pct) || 0, 0) + '%', background: color(i) }" />
        </div>
      </li>
    </ul>
    <p v-else class="empty">暂无数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart as EChartsPie } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([EChartsPie, TooltipComponent, CanvasRenderer])

const props = withDefaults(
  defineProps<{
    data: { name: string; pct: number }[]
    height?: number
  }>(),
  { height: 220 },
)

const el = ref<HTMLDivElement>()
let chart: ReturnType<typeof echarts.init> | null = null
let ro: ResizeObserver | null = null

const COLORS = ['#2f5d50', '#d9a441', '#b5523b', '#54708c', '#8a6a8f', '#93a463']

const rows = computed(() => (props.data || []).filter(x => Number(x.pct) > 0))
const color = (i: number) => COLORS[i % COLORS.length]

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  chart.setOption(
    {
      color: COLORS,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1d1b',
        borderWidth: 0,
        padding: [8, 11],
        textStyle: { color: '#f7f6f2', fontSize: 12 },
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/><b>${p.value}%</b> · 占比 ${p.percent}%`,
      },
      series: [
        {
          name: '品类构成',
          type: 'pie',
          radius: '94%',
          center: ['50%', '50%'],
          data: rows.value.map(x => ({ name: x.name, value: Number(x.pct) })),
          minAngle: 3,
          itemStyle: { borderColor: '#fbfaf6', borderWidth: 3, borderRadius: 2 },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: { shadowBlur: 16, shadowColor: 'rgba(26,29,27,0.2)' },
          },
          animationDuration: 520,
          animationEasing: 'cubicOut',
        },
      ],
    },
    { notMerge: true },
  )
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => chart?.resize())
  if (el.value) ro.observe(el.value)
})
watch(rows, render, { deep: true })
onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.pie-card {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.pie {
  flex: 0 0 46%;
  height: 100%;
  min-width: 0;
}
.legend {
  flex: 1;
  min-width: 0;
  list-style: none;
  margin: 0;
  padding: 0 4px 0 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  max-height: 100%;
  overflow-y: auto;
}
.line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transform: translateY(-1px);
}
.name {
  flex: 1;
  min-width: 0;
  color: #4f564f;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pct {
  color: #1a1d1b;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pct small {
  margin-left: 1px;
  color: #8a9089;
  font-size: 10px;
  font-weight: 500;
}
.track {
  height: 5px;
  margin: 7px 0 0 16px;
  border-radius: 3px;
  background: #ecebe4;
  overflow: hidden;
}
.track i {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.empty {
  margin: 0;
  color: #8a9089;
  font-size: 12px;
}
</style>
