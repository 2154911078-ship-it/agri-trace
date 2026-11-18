<template>
  <div ref="el" class="chart" :style="{ height: height + 'px' }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(
  defineProps<{
    labels: string[]
    data: number[]
    unit?: string
    height?: number
  }>(),
  { unit: '', height: 260 },
)

const el = ref<HTMLDivElement>()
let chart: ReturnType<typeof echarts.init> | null = null
let ro: ResizeObserver | null = null

const INK3 = '#8a9089'
const LINE = '#efede6'
const PINE = '#2f5d50'

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  chart.setOption(
    {
      grid: { left: 0, right: 10, top: 20, bottom: 26, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1d1b',
        borderWidth: 0,
        padding: [8, 11],
        textStyle: { color: '#f7f6f2', fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: LINE } },
        valueFormatter: (v: number) => `${v} ${props.unit}`,
      },
      xAxis: {
        type: 'category',
        data: props.labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2dfd5' } },
        axisTick: { show: false },
        axisLabel: { color: INK3, fontSize: 11, fontFamily: 'Consolas, monospace' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: LINE, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: INK3, fontSize: 11, fontFamily: 'Consolas, monospace' },
      },
      series: [
        {
          type: 'line',
          data: props.data,
          smooth: 0.28,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { color: PINE, width: 2 },
          itemStyle: { color: PINE },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(47,93,80,0.13)' },
                { offset: 1, color: 'rgba(47,93,80,0)' },
              ],
            },
          },
        },
      ],
    },
    true,
  )
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => chart && chart.resize())
  if (el.value) ro.observe(el.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})

watch(() => [props.labels, props.data], render, { deep: true })
</script>

<style scoped>
.chart {
  width: 100%;
}
</style>