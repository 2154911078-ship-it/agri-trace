<template>
  <div class="login">
    <!-- 左：田垄舞台 -->
    <section class="stage">
      <div ref="meadowEl" class="meadow" aria-hidden="true" />
      <div class="wash top" />
      <div class="wash bottom" />
      <div class="vignette" />


      <div class="brand">
        <p class="mark">青禾农业</p>
        <h1>从一块地<br />到一张餐桌</h1>
        <p class="sub">每一次施肥、每一张检测单、每一段运输温度，都留在这条链上。</p>
      </div>

      <div class="today">
        <div><span>在田地块</span><b class="mono">18<i>块</i></b></div>
        <div><span>今日采收</span><b class="mono">1,240<i>kg</i></b></div>
        <div><span>今日扫码</span><b class="mono">1,873<i>次</i></b></div>
      </div>

      <p class="caption">草野与河流 · 低空漫游</p>

      <p class="legal">
        皖公网安备 34012202000188 号 · 皖 ICP 备 2026001888 号
      </p>
    </section>

    <!-- 右：登录 -->
    <section class="panel">
      <div class="inner">
        <div class="tabs">
          <button :class="{ on: tab === 'pwd' }" @click="switchTab('pwd')">密码登录</button>
          <button :class="{ on: tab === 'qr' }" @click="switchTab('qr')">扫码登录</button>
        </div>

        <template v-if="tab === 'pwd'">
          <div class="buddy-slot">
            <VeggieBuddy :mood="mood" />
          </div>

          <form @submit.prevent="submit" class="form">
            <label class="f">
              <span>账号</span>
              <input v-model.trim="username" autocomplete="username" placeholder="admin" />
            </label>

            <label class="f">
              <span>密码</span>
              <div class="pwd-row">
                <input
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••"
                  @focus="mood = 'cover'"
                  @blur="mood = 'idle'"
                />
                <button type="button" class="eye" @click="showPwd = !showPwd">
                  {{ showPwd ? '隐藏' : '显示' }}
                </button>
              </div>
            </label>

            <div class="row">
              <label class="remember">
                <input type="checkbox" v-model="remember" /> 记住这台设备
              </label>
              <a class="link">忘记密码</a>
            </div>

            <p v-if="err" class="err">{{ err }}</p>

            <button class="submit" type="submit" :disabled="loading">
              {{ loading ? '正在登录…' : '进入系统' }}
            </button>

            <p class="hint">演示账号 admin / 123456</p>
          </form>
        </template>

        <template v-else>
          <div class="qr-wrap">
            <div class="qr-box">
              <canvas ref="qrEl" width="216" height="216" />
              <i class="c tl" /><i class="c tr" /><i class="c bl" /><i class="c br" />
              <span class="scanline" />
            </div>
            <p class="qr-tip">用青禾管理端 App 扫码确认登录</p>
            <p class="qr-note">演示环境下扫码通道未接通，请用密码登录。</p>
            <button class="link-btn" @click="switchTab('pwd')">改用密码登录</button>
          </div>
        </template>
      </div>

      <footer class="foot">
        <span>© 2026 青禾家庭农场</span>
        <span class="mono">v0.1.0</span>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import VeggieBuddy from './VeggieBuddy.vue'
import { createMeadow } from './useMeadow'
import { apiLogin } from '@/api'
import { setToken } from '@/utils/http'

const router = useRouter()
const qrEl = ref<HTMLCanvasElement>()
const meadowEl = ref<HTMLDivElement>()
const meadow = shallowRef<ReturnType<typeof createMeadow>>()

const tab = ref<'pwd' | 'qr'>('pwd')
const username = ref('admin')
const password = ref('123456')
const remember = ref(false)
const showPwd = ref(false)
const loading = ref(false)
const err = ref('')
const mood = ref<'idle' | 'cover' | 'error' | 'success'>('idle')

function drawQr() {
  if (!qrEl.value) return
  QRCode.toCanvas(qrEl.value, `agri://login?t=${Date.now().toString(36)}`, {
    width: 216,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1d1b', light: '#00000000' },
  })
}

function switchTab(t: 'pwd' | 'qr') {
  tab.value = t
  mood.value = 'idle'
  if (t === 'qr') requestAnimationFrame(drawQr)
}

async function submit() {
  err.value = ''
  if (!username.value || !password.value) {
    err.value = '账号和密码都要填'
    mood.value = 'error'
    return
  }
  loading.value = true
  try {
    const r = await apiLogin(username.value, password.value)
    setToken(r.token)
    mood.value = 'success'
    setTimeout(() => router.replace('/dashboard'), 620)
  } catch (e: any) {
    err.value = e?.message || '登录失败'
    mood.value = 'error'
    setTimeout(() => { if (mood.value === 'error') mood.value = 'idle' }, 2600)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (meadowEl.value) meadow.value = createMeadow(meadowEl.value)
  drawQr()
})
onBeforeUnmount(() => meadow.value?.dispose())
</script>

<style scoped>
.login {
  display: grid;
  grid-template-columns: 1.22fr 0.78fr;
  height: 100vh;
  overflow: hidden;
  background: var(--paper);
}

/* ---------- 左 ---------- */
.stage {
  position: relative;
  overflow: hidden;
  border-right: 1px solid var(--line);
}
.meadow {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #dfe9c4;
}
.wash {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 2;
}
.wash.top {
  top: 0;
  height: 230px;
  background: linear-gradient(
    to bottom,
    rgba(247, 246, 242, 0.86) 0%,
    rgba(247, 246, 242, 0.5) 46%,
    rgba(247, 246, 242, 0) 100%
  );
}
.wash.bottom {
  bottom: 0;
  height: 200px;
  background: linear-gradient(
    to top,
    rgba(247, 246, 242, 0.97) 0%,
    rgba(247, 246, 242, 0.74) 42%,
    rgba(247, 246, 242, 0) 100%
  );
}
.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse at 46% 52%,
      rgba(247, 246, 242, 0) 40%,
      rgba(247, 246, 242, 0.34) 78%,
      rgba(247, 246, 242, 0.62) 100%
    );
}
.caption {
  position: absolute;
  right: 40px;
  bottom: 44px;
  margin: 0;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--ink-2);
  background: rgba(247, 246, 242, 0.9);
  border: 1px solid var(--line);
  padding: 7px 12px;
  pointer-events: none;
  z-index: 4;
}

.brand {
  position: absolute;
  left: 56px;
  top: 62px;
  max-width: 400px;
  pointer-events: none;
}
.mark {
  font-size: 11px;
  letter-spacing: 0.32em;
  color: var(--ink-3);
  margin: 0 0 26px;
}
.brand h1 {
  font-family: var(--font-serif);
  font-size: 36px;
  line-height: 1.34;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.01em;
}
.sub {
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.85;
  margin: 20px 0 0;
  max-width: 320px;
}
.today {
  position: absolute;
  left: 56px;
  bottom: 74px;
  display: flex;
  gap: 40px;
  padding: 10px 15px 11px;
  background: rgba(247, 246, 242, 0.9);
  border: 1px solid var(--line);
  backdrop-filter: blur(2px);
  pointer-events: none;
}
.today span {
  display: block;
  font-size: 10.5px;
  color: var(--ink-3);
  margin-bottom: 7px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.today b {
  font-family: var(--font-num);
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.today i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--ink-3);
  margin-left: 4px;
}
.legal {
  position: absolute;
  left: 56px;
  bottom: 40px;
  margin: 0;
  font-size: 10px;
  color: #aeb2a9;
  letter-spacing: 0.03em;
  pointer-events: none;
}

/* ---------- 右 ---------- */
.panel {
  display: flex;
  flex-direction: column;
  padding: 40px 56px 26px;
  background: var(--paper);
}
.inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 340px;
  width: 100%;
  margin: 0 auto;
}
.tabs {
  display: flex;
  gap: 26px;
  margin-bottom: 30px;
  border-bottom: 1px solid var(--line);
}
.tabs button {
  position: relative;
  border: 0;
  background: none;
  padding: 0 0 11px;
  font-size: 13px;
  color: var(--ink-3);
  cursor: pointer;
  transition: color 0.16s var(--ease);
}
.tabs button.on {
  color: var(--ink);
}
.tabs button.on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--pine);
}
.buddy-slot {
  display: grid;
  place-items: center;
  margin: 2px 0 26px;
}
.form {
  display: flex;
  flex-direction: column;
}
.f {
  display: block;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--line);
  transition: border-color 0.18s var(--ease);
}
.f:focus-within {
  border-color: var(--pine);
}
.f > span {
  display: block;
  font-size: 10.5px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}
.f input {
  width: 100%;
  height: 40px;
  border: 0;
  background: none;
  outline: none;
  font-size: 15px;
  color: var(--ink);
  letter-spacing: 0.01em;
}
.f input::placeholder {
  color: #c1c5bb;
}
.pwd-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.eye {
  border: 0;
  background: none;
  font-size: 10.5px;
  color: var(--ink-3);
  cursor: pointer;
  white-space: nowrap;
  padding: 0;
}
.eye:hover {
  color: var(--ink-2);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 26px;
  font-size: 11.5px;
  color: var(--ink-3);
}
.remember {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}
.remember input {
  accent-color: var(--pine);
}
.link {
  color: var(--ink-3);
  text-decoration: none;
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 1px;
  cursor: pointer;
}
.link:hover {
  color: var(--ink-2);
}
.err {
  font-size: 11.5px;
  color: var(--alert);
  margin: -12px 0 16px;
  padding-left: 9px;
  border-left: 2px solid var(--alert);
}
.submit {
  height: 44px;
  border: 0;
  border-radius: var(--r-sm);
  background: var(--pine);
  color: #fff;
  font-size: 13.5px;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: background 0.16s var(--ease), transform 0.16s var(--ease);
}
.submit:hover:not(:disabled) {
  background: var(--pine-dim);
}
.submit:active:not(:disabled) {
  transform: translateY(1px);
}
.submit:disabled {
  opacity: 0.6;
  cursor: default;
}
.hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 11px;
  color: #a9aea5;
  font-family: var(--font-num);
}

/* 二维码 */
.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 4px;
}
.qr-box {
  position: relative;
  width: 216px;
  height: 216px;
  padding: 0;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
}
.qr-box canvas {
  display: block;
  width: 216px;
  height: 216px;
}
.c {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid var(--pine);
}
.c.tl { left: 6px; top: 6px; border-right: 0; border-bottom: 0; }
.c.tr { right: 6px; top: 6px; border-left: 0; border-bottom: 0; }
.c.bl { left: 6px; bottom: 6px; border-right: 0; border-top: 0; }
.c.br { right: 6px; bottom: 6px; border-left: 0; border-top: 0; }
.scanline {
  position: absolute;
  left: 8px;
  right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--pine), transparent);
  opacity: 0.7;
  animation: scan 2.4s ease-in-out infinite;
}
@keyframes scan {
  0% { top: 12px; opacity: 0; }
  12% { opacity: 0.7; }
  88% { opacity: 0.7; }
  100% { top: 202px; opacity: 0; }
}
.qr-tip {
  font-size: 12.5px;
  color: var(--ink-2);
  margin: 0;
}
.qr-note {
  font-size: 11px;
  color: var(--ink-3);
  margin: 0;
  text-align: center;
  line-height: 1.7;
  max-width: 260px;
}
.link-btn {
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--pine);
  cursor: pointer;
  border-bottom: 1px solid var(--pine);
  padding: 0 0 2px;
}

.foot {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #a9aea5;
}

@media (max-width: 960px) {
  .login {
    grid-template-columns: 1fr;
    grid-template-rows: 38vh 1fr;
    border-top: 0;
  }
  /* 手机上不再砍掉 3D，改作顶部横幅：场景仍在跑，只是降了 LOD */
  .stage {
    display: block;
    min-height: 210px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .wash.top {
    height: 96px;
  }
  .wash.bottom {
    height: 92px;
  }
  .vignette {
    background: radial-gradient(
      ellipse at 50% 55%,
      rgba(247, 246, 242, 0) 52%,
      rgba(247, 246, 242, 0.4) 100%
    );
  }
  .brand {
    left: 18px;
    top: 14px;
  }
  .brand h1 {
    font-size: 22px;
  }
  .brand .sub,
  .today,
  .legal,
  .caption {
    display: none;
  }
  .panel {
    padding: 24px 22px 18px;
    overflow-y: auto;
  }
  .panel .foot {
    padding-top: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scanline {
    animation: none;
    top: 100px;
  }
}
</style>