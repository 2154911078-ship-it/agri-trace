<template>
  <div class="module sales">
    <div class="page-head">
      <div>
        <p class="kicker">销售去向 · SALES</p>
        <h1>销售</h1>
        <p>已售批次与经销商流向 · {{ sold.length }} 个已售批次</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <router-link class="primary" to="/ship">去物流发货</router-link>
      </div>
    </div>

    <div class="stat-strip">
      <div><span>已售批次</span><b>{{ sold.length }}</b><em>批</em></div>
      <div><span>销售总量</span><b>{{ totalQty.toLocaleString() }}</b><em>kg</em></div>
      <div><span>经销商</span><b>{{ dealers }}</b><em>家</em></div>
      <div><span>待售批次</span><b>{{ pending }}</b><em>批</em></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: !dealer }" @click="dealer = ''">全部流向<span class="n">{{ sold.length }}</span></button>
        <button v-for="d in dealerList" :key="d" :class="{ on: dealer === d }" @click="dealer = d">{{ shortName(d) }}</button>
      </div>
      <div class="right"><span class="sub">数据来自批次销售与物流记录</span></div>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:180px">批次 / 地块</th>
            <th style="width:110px">作物</th>
            <th>经销商</th>
            <th style="width:110px" class="num-r">数量 / kg</th>
            <th style="width:120px">采收日期</th>
            <th style="width:110px">物流</th>
            <th style="width:130px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in 5" :key="'sk' + i" class="loading-row">
            <td v-for="j in 7" :key="j"><span class="sk" :style="{ width: 35 + ((j * 10) % 48) + '%' }" /></td>
          </tr>
          <tr v-for="b in filtered" v-else :key="b.id">
            <td>
              <div class="m-cell">
                <span class="mono strong">{{ b.batchNo }}</span>
                <span class="sub">{{ b.plotNo }}</span>
              </div>
            </td>
            <td>{{ b.cropName }}<span v-if="b.variety" class="sub"> · {{ b.variety }}</span></td>
            <td>{{ b.sale?.dealer || '—' }}</td>
            <td class="num-r">{{ (b.sale?.qty || 0).toLocaleString() }}</td>
            <td class="mono">{{ b.harvestDate || '—' }}</td>
            <td>
              <span v-if="b.ship" class="m-tag ok">{{ b.ship.carrier }}</span>
              <span v-else class="m-tag muted">待发运</span>
            </td>
            <td>
              <div class="m-actions">
                <router-link class="m-link" :to="`/batch/${b.id}`">批次</router-link>
                <router-link class="m-link" :to="`/trace/${traceOf(b.id)}`">追溯</router-link>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !filtered.length" class="empty">该经销商暂无销售记录。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiBatches, type BatchSummary } from '@/api'
import { toast } from '@/utils/toast'

const rows = ref<BatchSummary[]>([])
const loading = ref(false)
const dealer = ref('')

const sold = computed(() => rows.value.filter(b => b.sale))
const dealerList = computed(() => [...new Set(sold.value.map(b => b.sale!.dealer))])
const filtered = computed(() => (dealer.value ? sold.value.filter(b => b.sale?.dealer === dealer.value) : sold.value))
const totalQty = computed(() => sold.value.reduce((s, b) => s + (b.sale?.qty || 0), 0))
const dealers = computed(() => dealerList.value.length)
const pending = computed(() => rows.value.filter(b => !b.sale).length)

const shortName = (s: string) => s.replace(/农产品市场|果品批发行|农副市场|市场/g, '').slice(0, 6)
const traceOf = (id: number) => {
  const b = rows.value.find(x => x.id === id)
  return b ? `AG34012201261028${String(b.id).padStart(4, '0')}A` : ''
}

async function load() {
  loading.value = true
  try {
    rows.value = await apiBatches()
  } catch (e: any) {
    toast(e?.message || '销售记录读取失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.module {
  max-width: 1440px;
}
.head-right {
  display: flex;
  gap: 12px;
}
</style>
