<template>
  <div class="notif-page">
    <header class="page-head">
      <div>
        <p class="kicker">消息中心 · NOTIFICATIONS</p>
        <h1>通知</h1>
        <p>预警、订单与仓储消息统一收件；短信/企微通道在演示环境为模拟投递。</p>
      </div>
      <div class="head-acts">
        <button class="ghost" @click="load">刷新</button>
        <button class="ghost" :disabled="!page?.unread" @click="readAll">全部已读</button>
      </div>
    </header>

    <div class="stats">
      <div><span>未读</span><b class="bad">{{ page?.unread ?? '—' }}</b><em>条</em></div>
      <div><span>全部</span><b>{{ page?.total ?? '—' }}</b><em>条</em></div>
      <div><span>当前筛选</span><b class="farm">{{ channel ? channelText(channel) : '全部渠道' }}</b></div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: status === null }" @click="pickStatus(null)">全部</button>
        <button :class="{ on: status === 0 }" @click="pickStatus(0)">未读</button>
        <button :class="{ on: status === 1 }" @click="pickStatus(1)">已读</button>
      </div>
      <div class="right">
        <button v-for="c in CHANNELS" :key="String(c.v)" class="m-link" :class="{ on: channel === c.v }" @click="pickChannel(c.v)">
          {{ c.t }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="!page?.records.length" class="state">暂无通知</div>
    <div v-else class="list">
      <article v-for="n in page.records" :key="n.id" class="item" :class="[n.level, { unread: n.status === 0 }]">
        <div class="dot" />
        <div class="main">
          <div class="title">
            <strong>{{ n.title }}</strong>
            <span class="m-tag" :class="n.level === 'alert' ? 'bad' : n.level === 'warn' ? 'warn' : 'ok'">{{ n.category }}</span>
            <span class="m-tag channel">{{ channelText(n.channel) }}</span>
            <span v-if="n.escalated" class="m-tag bad">已升级</span>
          </div>
          <p>{{ n.content }}</p>
          <div class="meta">
            <span class="mono">{{ n.createTime }}</span>
            <a v-if="n.link" class="m-link" @click="openLink(n)">查看详情 →</a>
            <button v-if="n.status === 0" class="m-link" @click="read(n)">标为已读</button>
            <span v-else class="sub">已读 {{ n.readAt || '' }}</span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiNotifications, apiReadAllNotifications, apiReadNotification, type NotificationRow } from '@/api/p0'
import { toast } from '@/utils/toast'

const router = useRouter()
const page = ref<{ records: NotificationRow[]; total: number; unread: number } | null>(null)
const loading = ref(false)
const status = ref<number | null>(null)
const channel = ref<string | null>(null)
const CHANNELS = [
  { v: null, t: '全部渠道' },
  { v: 'INBOX', t: '站内信' },
  { v: 'SMS', t: '短信' },
  { v: 'WECOM', t: '企微' },
]
const channelText = (c: string) => (c === 'INBOX' ? '站内信' : c === 'SMS' ? '短信' : '企微')

async function load() {
  loading.value = true
  try {
    page.value = await apiNotifications({ status: status.value, channel: channel.value, page: 1, size: 100 })
  } catch (e: any) {
    toast(e?.message || '通知读取失败', 'error')
  } finally {
    loading.value = false
  }
}

function pickStatus(v: number | null) {
  status.value = v
  load()
}
function pickChannel(v: string | null) {
  channel.value = v
  load()
}

async function read(n: NotificationRow) {
  try {
    await apiReadNotification(n.id)
    await load()
  } catch (e: any) {
    toast(e?.message || '操作失败', 'error')
  }
}

async function readAll() {
  try {
    await apiReadAllNotifications()
    toast('全部通知已读')
    await load()
  } catch (e: any) {
    toast(e?.message || '操作失败', 'error')
  }
}

function openLink(n: NotificationRow) {
  if (n.status === 0) void read(n)
  if (n.link) router.push(n.link)
}

watch([status, channel], load)
onMounted(load)
</script>

<style scoped>
.notif-page { display: flex; flex-direction: column; gap: 18px; max-width: 1000px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.kicker { margin: 0 0 6px; font-size: 10.5px; letter-spacing: .08em; color: var(--ink-3); }
h1 { margin: 0 0 6px; font-family: var(--font-serif); font-size: 30px; font-weight: 500; }
.page-head p { margin: 0; font-size: 12px; color: var(--ink-3); }
.head-acts { display: flex; gap: 8px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); }
.stats div { padding: 16px 18px; border-right: 1px solid var(--line); }
.stats div:last-child { border-right: 0; }
.stats span { display: block; font-size: 11px; color: var(--ink-3); margin-bottom: 6px; }
.stats b { font-family: var(--font-num); font-size: 24px; font-weight: 500; }
.stats b.bad { color: var(--alert); }
.stats b.farm { font-family: inherit; font-size: 15px; }
.stats em { font-style: normal; font-size: 11px; color: var(--ink-3); margin-left: 4px; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; gap: 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); padding: 14px 16px; }
.item.unread { border-left: 3px solid var(--pine); background: #fbfaf7; }
.item.alert .dot { background: var(--alert); }
.item.warn .dot { background: #c9a45c; }
.item.info .dot { background: var(--pine); }
.dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex: 0 0 7px; }
.main { flex: 1; min-width: 0; }
.title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.title strong { font-size: 13px; }
.main p { margin: 6px 0 8px; font-size: 12px; color: var(--ink-2); line-height: 1.6; }
.meta { display: flex; align-items: center; gap: 16px; font-size: 11px; color: var(--ink-3); }
.channel { background: var(--paper-2); color: var(--ink-2); }
.segs button.on, .right .m-link.on { color: var(--pine); font-weight: 600; }
.state { padding: 60px; text-align: center; color: var(--ink-3); }
</style>
