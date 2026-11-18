<template>
  <div class="consumer">
    <div class="shell">
      <header class="brand">
        <div class="mark">青</div>
        <div class="brand-text">
          <b>青禾农业</b>
          <span>一物一码 · 产品溯源</span>
        </div>
        <button class="share" @click="share">
          <Link2 :size="14" :stroke-width="1.8" />
          分享
        </button>
      </header>

      <template v-if="loading">
        <div class="skeleton hero-sk">
          <span class="sk" /><span class="sk" /><span class="sk" />
        </div>
        <div class="skeleton">
          <span class="sk" /><span class="sk" /><span class="sk" /><span class="sk" />
        </div>
      </template>

      <section v-else-if="error" class="not-found">
        <p class="kicker">TRACE NOT FOUND</p>
        <h1>没有找到这个追溯码</h1>
        <p>{{ error }}</p>
        <form class="retry" @submit.prevent="retry">
          <input v-model.trim="input" placeholder="重新输入追溯码" />
          <button type="submit">查询</button>
        </form>
        <p class="tiny">追溯码通常印在包装标签二维码下方，共 21 位。</p>
      </section>

      <template v-else-if="t">
        <section class="hero">
          <div class="hero-top">
            <span class="badge" :class="passed ? 'ok' : 'bad'">
              <ShieldCheck :size="14" :stroke-width="2" />
              {{ passed ? '农残检测合格' : '检测异常' }}
            </span>
            <span class="scan">已被查询 {{ t.scanCount }} 次</span>
          </div>
          <h1>{{ t.productName }}</h1>
          <p class="variety">{{ t.variety || '当季鲜品' }} · {{ t.grade || '标准级' }} · {{ t.packageSpec || '散装' }}</p>
          <p class="origin"><MapPin :size="14" :stroke-width="1.8" /> {{ t.farmName }} · {{ t.plotNo }} · {{ t.region }}</p>
          <div class="code-line">
            <span>追溯码</span>
            <b class="mono">{{ t.code }}</b>
          </div>
        </section>

        <section class="facts">
          <div>
            <CalendarDays :size="17" :stroke-width="1.6" />
            <span>采收日期</span>
            <b>{{ t.harvestDate }}</b>
          </div>
          <div>
            <Package :size="17" :stroke-width="1.6" />
            <span>批次</span>
            <b class="mono">{{ t.batchNo }}</b>
          </div>
          <div>
            <Wheat :size="17" :stroke-width="1.6" />
            <span>本批产量</span>
            <b>{{ t.yieldKg.toLocaleString() }} kg</b>
          </div>
          <div>
            <MapPin :size="17" :stroke-width="1.6" />
            <span>产地</span>
            <b>{{ t.region }}</b>
          </div>
        </section>

        <section class="card inspect-card">
          <header>
            <h2>农残检测</h2>
            <span class="badge sm" :class="passed ? 'ok' : 'bad'">{{ t.inspectResult }}</span>
          </header>
          <dl class="kv">
            <div><dt>检测机构</dt><dd>{{ t.inspectOrg || '—' }}</dd></div>
            <div><dt>报告编号</dt><dd class="mono">{{ t.reportNo || '—' }}</dd></div>
          </dl>
          <button v-if="t.reportUrl" class="txt-btn" @click="reportHint">查看检测报告 →</button>
        </section>

        <section class="card">
          <header>
            <h2>从田间到餐桌</h2>
            <span>{{ t.timeline.length }} 个节点</span>
          </header>
          <TraceTimeline :events="publicEvents" />
        </section>

        <section class="card chain-card">
          <header>
            <h2>存证校验</h2>
            <button class="txt-btn" :disabled="verifying" @click="verify">{{ verifying ? '校验中…' : '校验一致性' }}</button>
          </header>
          <p class="lbl">数据摘要</p>
          <p class="hash mono">{{ t.dataHash }}</p>
          <p class="lbl">链上交易</p>
          <p class="hash mono">{{ t.chainTx }}</p>
          <p v-if="verified !== null" class="verify-result" :class="verified ? 'ok' : 'bad'">
            {{ verified ? '校验通过，链上摘要与本条记录一致' : '校验不一致，请以检测机构原始报告为准' }}
          </p>
        </section>

        <footer>
          <p>本页信息由青禾农业提供，来自生产记录与检测报告。</p>
          <p class="mono">{{ t.code }} · {{ t.farmName }}</p>
        </footer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ShieldCheck, MapPin, CalendarDays, Package, Wheat, Link2,
} from 'lucide-vue-next'
import TraceTimeline from '@/components/trace/TraceTimeline.vue'
import { apiScanCode, apiTrace, apiTraceVerify, type TraceVO } from '@/api'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const t = ref<TraceVO | null>(null)
const loading = ref(true)
const error = ref('')
const verifying = ref(false)
const verified = ref<boolean | null>(null)
const input = ref('')

const passed = computed(() => t.value?.inspectResult === '合格')
const publicEvents = computed(() =>
  (t.value?.timeline || []).map(e => ({ ...e, certUrl: undefined })),
)

async function load(code: string) {
  loading.value = true
  error.value = ''
  verified.value = null
  t.value = null
  input.value = code
  try {
    await apiScanCode(code).catch(() => undefined)
    t.value = await apiTrace(code)
    input.value = t.value.code
  } catch (e: any) {
    error.value = e?.message || '追溯码不存在或尚未激活'
  } finally {
    loading.value = false
  }
}

async function verify() {
  if (!t.value) return
  verifying.value = true
  try {
    const r = await apiTraceVerify(t.value.code)
    verified.value = r.ok
  } catch (e: any) {
    toast(e?.message || '校验失败', 'error')
  } finally {
    verifying.value = false
  }
}

function retry() {
  if (!input.value) return
  if (input.value === String(route.params.code)) load(input.value)
  else router.push(`/t/${input.value}`)
}

async function share() {
  const url = window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: t.value ? `${t.value.productName} · 青禾农业溯源` : '青禾农业溯源', url })
    } else {
      await navigator.clipboard.writeText(url)
      toast('页面链接已复制')
    }
  } catch {
    /* 用户取消分享 */
  }
}

function reportHint() {
  toast('演示环境未附 PDF 文件，正式环境将展示检测报告', 'warn')
}

onMounted(() => load(String(route.params.code || '')))
watch(() => route.params.code, c => {
  if (c) load(String(c))
})
watch(t, v => {
  document.title = v ? `${v.productName} · 青禾农业溯源` : '产品溯源 · 青禾农业'
})
onBeforeUnmount(() => {
  document.title = '青禾农业 · 农产品溯源'
})
</script>

<style scoped>
.consumer {
  min-height: 100vh;
  background:
    radial-gradient(900px 380px at 50% -80px, rgba(111, 143, 99, 0.14), transparent 70%),
    var(--paper);
  color: var(--ink);
  padding: 0 18px 52px;
}
.shell {
  max-width: 720px;
  margin: 0 auto;
  padding-top: 22px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 20px;
}
.mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--pine);
}
.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.brand-text b {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.brand-text span {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}
.share {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: none;
  color: var(--ink-2);
  font-size: 11.5px;
  cursor: pointer;
}
.share:hover {
  background: var(--paper-2);
}
.hero {
  position: relative;
  overflow: hidden;
  padding: 24px 22px 20px;
  border-radius: 14px;
  background: linear-gradient(145deg, #2f5d50 0%, #244a40 100%);
  color: #f4f2e9;
  box-shadow: 0 18px 44px rgba(47, 93, 80, 0.18);
}
.hero::after {
  content: '';
  position: absolute;
  right: -52px;
  top: -70px;
  width: 210px;
  height: 210px;
  border: 1px solid rgba(244, 242, 233, 0.16);
  border-radius: 50%;
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 23px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 10.5px;
  background: rgba(244, 242, 233, 0.12);
  color: #eaf3df;
  border: 1px solid rgba(234, 243, 223, 0.3);
}
.badge.bad {
  color: #ffd9cf;
  border-color: rgba(255, 217, 207, 0.4);
}
.badge.sm {
  height: 20px;
  font-size: 10px;
  background: rgba(111, 143, 99, 0.13);
  color: var(--pine);
  border-color: transparent;
}
.badge.sm.bad {
  background: rgba(180, 70, 47, 0.1);
  color: var(--alert);
}
.scan {
  font-size: 10.5px;
  color: rgba(244, 242, 233, 0.62);
}
.hero h1 {
  font-family: var(--font-serif);
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin: 18px 0 6px;
}
.variety {
  margin: 0;
  font-size: 12.5px;
  color: rgba(244, 242, 233, 0.72);
}
.origin {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 16px 0 0;
  font-size: 11.5px;
  color: rgba(244, 242, 233, 0.78);
}
.code-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
  padding-top: 13px;
  border-top: 1px solid rgba(244, 242, 233, 0.18);
}
.code-line span {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(244, 242, 233, 0.55);
}
.code-line b {
  font-size: 10.5px;
  font-weight: 400;
  color: rgba(244, 242, 233, 0.88);
  word-break: break-all;
  text-align: right;
}
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-top: 14px;
  padding: 4px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
}
.facts > div {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 2px 8px;
  align-items: center;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}
.facts > div:nth-child(odd) {
  padding-right: 14px;
}
.facts > div:nth-child(even) {
  padding-left: 14px;
  border-left: 1px solid var(--line);
}
.facts > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}
.facts svg {
  grid-row: 1 / span 2;
  color: var(--pine);
  opacity: 0.7;
}
.facts span {
  font-size: 10px;
  color: var(--ink-3);
}
.facts b {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.card {
  margin-top: 14px;
  padding: 19px 20px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
}
.card header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.card h2 {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}
.card header > span {
  font-size: 10.5px;
  color: var(--ink-3);
}
.kv {
  margin: 0;
}
.kv > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.kv > div:last-child {
  border-bottom: 0;
}
.kv dt {
  font-size: 11.5px;
  color: var(--ink-3);
}
.kv dd {
  margin: 0;
  font-size: 12px;
  text-align: right;
}
.txt-btn {
  border: 0;
  background: none;
  padding: 0;
  margin-top: 12px;
  color: var(--pine);
  font-size: 11.5px;
  cursor: pointer;
  border-bottom: 1px solid rgba(47, 93, 80, 0.35);
}
.chain-card .hash {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 5px;
  background: var(--paper-2);
  font-size: 9.5px;
  color: var(--ink-3);
  line-height: 1.6;
  word-break: break-all;
}
.lbl {
  margin: 0 0 5px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
.verify-result {
  margin: 12px 0 0;
  padding: 9px 11px;
  border-left: 2px solid var(--pine);
  background: rgba(111, 143, 99, 0.1);
  font-size: 11px;
  color: var(--pine);
}
.verify-result.bad {
  border-left-color: var(--alert);
  background: rgba(180, 70, 47, 0.08);
  color: var(--alert);
}
footer {
  padding: 26px 0 0;
  text-align: center;
  font-size: 10.5px;
  line-height: 1.8;
  color: var(--ink-3);
}
footer p {
  margin: 0;
}
footer .mono {
  font-size: 9.5px;
  color: #b0b4ac;
}
.not-found {
  margin-top: 40px;
  padding: 34px 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
  text-align: center;
}
.kicker {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
  margin: 0 0 10px;
}
.not-found h1 {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
.not-found > p {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ink-3);
}
.retry {
  display: flex;
  gap: 8px;
  max-width: 340px;
  margin: 20px auto 0;
}
.retry input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: #fffefb;
  padding: 0 10px;
  font-family: var(--font-num);
  font-size: 11px;
  outline: none;
}
.retry input:focus {
  border-color: var(--pine);
}
.retry button {
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--r-sm);
  background: var(--pine);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.tiny {
  margin-top: 14px !important;
  font-size: 10px !important;
  color: #b0b4ac !important;
}
.skeleton {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hero-sk {
  height: 220px;
  justify-content: flex-end;
}
.skeleton .sk {
  height: 14px;
}
@media (max-width: 520px) {
  .consumer {
    padding: 0 12px 40px;
  }
  .shell {
    padding-top: 14px;
  }
  .hero h1 {
    font-size: 28px;
  }
  .facts {
    grid-template-columns: 1fr;
    padding: 4px 15px;
  }
  .facts > div:nth-child(odd) {
    padding-right: 0;
  }
  .facts > div:nth-child(even) {
    padding-left: 0;
    border-left: 0;
  }
  .facts > div:nth-last-child(2) {
    border-bottom: 1px solid var(--line);
  }
  .facts > div:last-child {
    border-bottom: 0;
  }
  .card {
    padding: 16px;
  }
}
</style>
