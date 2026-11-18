<template>
  <div class="buddy" :data-mood="mood" ref="host">
    <div class="stage">
      <svg class="side carrot" viewBox="0 0 80 140" aria-hidden="true">
        <defs>
          <linearGradient id="carrot-body" x1="0" y1="0" x2=".35" y2="1">
            <stop offset="0" stop-color="#ed9a4d" />
            <stop offset="1" stop-color="#d9772f" />
          </linearGradient>
        </defs>
        <g class="veg-body">
          <path d="M40 32 C57 32 64 48 61 68 C58 90 47 116 40 133 C33 116 22 90 19 68 C16 48 23 32 40 32 Z" fill="url(#carrot-body)" />
          <g stroke="#c8641f" stroke-width="1.6" stroke-linecap="round" opacity=".55" fill="none">
            <path d="M28 62 Q36 60 44 63" />
            <path d="M27 80 Q36 78 46 81" />
            <path d="M31 98 Q37 96 43 99" />
            <path d="M35 114 Q40 112 44 115" />
          </g>
          <g fill="#4a7a4e">
            <path d="M40 34 C38 22 39 12 44 4 C46 14 44 25 40 34 Z" />
            <path d="M38 35 C30 25 22 22 14 22 C20 31 28 35 38 35 Z" />
            <path d="M42 35 C50 25 58 22 66 22 C60 31 52 35 42 35 Z" />
          </g>
          <path d="M40 35 C36 27 30 23 24 23 C29 30 34 34 40 35 Z" fill="#3f6b44" />
          <g class="veg-face">
            <ellipse cx="32" cy="72" rx="7.2" ry="7.8" fill="#ffffff" />
            <ellipse cx="48" cy="72" rx="7.2" ry="7.8" fill="#ffffff" />
            <g class="pupil">
              <circle cx="33.4" cy="73" r="3.9" fill="#23282a" />
              <circle cx="49.4" cy="73" r="3.9" fill="#23282a" />
              <circle cx="32.2" cy="71.4" r="1.3" fill="#ffffff" />
              <circle cx="48.2" cy="71.4" r="1.3" fill="#ffffff" />
            </g>
            <ellipse class="lid" cx="32" cy="72" rx="7.2" ry="7.8" fill="#e08a3f" />
            <ellipse class="lid" cx="48" cy="72" rx="7.2" ry="7.8" fill="#e08a3f" />
            <g class="mouth" transform="translate(40 86)">
              <path class="m-idle" d="M-4.5 0 Q0 4.5 4.5 0" fill="none" stroke="#7a3a18" stroke-width="2.2" stroke-linecap="round" />
              <path class="m-flat" d="M-4 0 L4 0" fill="none" stroke="#7a3a18" stroke-width="2.2" stroke-linecap="round" />
              <ellipse class="m-open" cx="0" cy="1.5" rx="3.6" ry="4.4" fill="#7a3a18" />
            </g>
            <ellipse cx="24" cy="82" rx="4.6" ry="2.8" fill="#c8641f" opacity=".35" />
            <ellipse cx="56" cy="82" rx="4.6" ry="2.8" fill="#c8641f" opacity=".35" />
          </g>
          <g class="arm left" transform="translate(21 92)">
            <rect x="-9" y="-6" width="18" height="12" rx="6" fill="#cf6c28" />
          </g>
          <g class="arm right" transform="translate(59 92)">
            <rect x="-9" y="-6" width="18" height="12" rx="6" fill="#cf6c28" />
          </g>
        </g>
      </svg>

      <svg class="main" viewBox="0 0 200 224" role="img" aria-label="番茄吉祥物">
      <defs>
        <clipPath id="buddy-body">
          <path d="M100 60 C140 60 163 88 163 124 C163 166 135 196 100 196 C65 196 37 166 37 124 C37 88 60 60 100 60 Z" />
        </clipPath>
        <radialGradient id="buddy-gloss" cx="0.34" cy="0.26" r="0.55">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".55" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- 身体 -->
      <g class="body">
        <path
          d="M100 60 C140 60 163 88 163 124 C163 166 135 196 100 196 C65 196 37 166 37 124 C37 88 60 60 100 60 Z"
          fill="#d9543f" />
        <g clip-path="url(#buddy-body)">
          <ellipse cx="74" cy="168" rx="78" ry="58" fill="#1a1d1b" opacity=".085" />
          <ellipse cx="132" cy="90" rx="46" ry="34" fill="url(#buddy-gloss)" />
        </g>
      </g>

      <!-- 蒂 -->
      <g class="calyx">
        <path d="M100 62 L88 44 L97 50 L100 32 L104 50 L113 44 Z" fill="#4a7a4e" />
        <path d="M100 63 C82 61 70 52 66 40 C78 42 90 50 100 63 Z" fill="#3f6b44" />
        <path d="M100 63 C118 61 130 52 134 40 C122 42 110 50 100 63 Z" fill="#3f6b44" />
        <circle cx="100" cy="60" r="4.6" fill="#3f6b44" />
      </g>

      <!-- 眼 -->
      <g class="eyes" transform="translate(100 124)">
        <g class="eye left">
          <ellipse cx="-22" cy="0" rx="14.5" ry="15.5" fill="#ffffff" />
          <g class="pupil">
            <circle cx="-21" cy="1" r="8.2" fill="#23282a" />
            <circle cx="-24.4" cy="-2.6" r="2.6" fill="#ffffff" />
          </g>
          <ellipse class="lid" cx="-22" cy="-13" rx="15.5" ry="15" fill="#d9543f" />
        </g>
        <g class="eye right">
          <ellipse cx="22" cy="0" rx="14.5" ry="15.5" fill="#ffffff" />
          <g class="pupil">
            <circle cx="23" cy="1" r="8.2" fill="#23282a" />
            <circle cx="19.6" cy="-2.6" r="2.6" fill="#ffffff" />
          </g>
          <ellipse class="lid" cx="22" cy="-13" rx="15.5" ry="15" fill="#d9543f" />
        </g>
      </g>

      <!-- 腮红 -->
      <g class="cheeks" opacity=".5">
        <ellipse cx="52" cy="146" rx="10" ry="6.4" fill="#c0453a" />
        <ellipse cx="148" cy="146" rx="10" ry="6.4" fill="#c0453a" />
      </g>

      <!-- 嘴 -->
      <g class="mouth" transform="translate(100 150)">
        <path class="m-idle" d="M-9 0 Q0 7 9 0" fill="none" stroke="#7d2a20"
          stroke-width="2.4" stroke-linecap="round" />
        <ellipse class="m-open" cx="0" cy="3" rx="6" ry="7" fill="#7d2a20" />
        <path class="m-flat" d="M-8 3 L8 3" fill="none" stroke="#7d2a20"
          stroke-width="2.4" stroke-linecap="round" />
      </g>

      <!-- 手：遮眼 / 举高 -->
      <g class="hand left" transform="translate(38 178)">
        <rect x="-20" y="-14" width="40" height="28" rx="14" fill="#cf4d3a" />
      </g>
      <g class="hand right" transform="translate(162 178)">
        <rect x="-20" y="-14" width="40" height="28" rx="14" fill="#cf4d3a" />
      </g>
      </svg>

      <svg class="side broccoli" viewBox="0 0 90 140" aria-hidden="true">
        <defs>
          <linearGradient id="broccoli-stem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#cbdcae" />
            <stop offset="1" stop-color="#aec98b" />
          </linearGradient>
        </defs>
        <g class="veg-body">
          <path d="M36 76 C34 96 34 112 36 126 C38 133 52 133 54 126 C56 112 56 96 54 76 Z" fill="url(#broccoli-stem)" />
          <g fill="#4f7d4a">
            <circle cx="27" cy="58" r="17" />
            <circle cx="45" cy="46" r="20" />
            <circle cx="64" cy="57" r="17" />
            <circle cx="36" cy="72" r="15" />
            <circle cx="54" cy="71" r="15" />
            <circle cx="45" cy="62" r="16" />
          </g>
          <g fill="#5f914f" opacity=".9">
            <circle cx="34" cy="40" r="9" />
            <circle cx="24" cy="52" r="7" />
            <circle cx="55" cy="46" r="8" />
            <circle cx="62" cy="60" r="6" />
          </g>
          <g fill="#3f6b3c" opacity=".42">
            <circle cx="38" cy="78" r="10" />
            <circle cx="55" cy="76" r="9" />
          </g>
          <g class="veg-face">
            <ellipse cx="37" cy="66" rx="7" ry="7.6" fill="#ffffff" />
            <ellipse cx="53" cy="66" rx="7" ry="7.6" fill="#ffffff" />
            <g class="pupil">
              <circle cx="38.3" cy="67" r="3.8" fill="#23282a" />
              <circle cx="54.3" cy="67" r="3.8" fill="#23282a" />
              <circle cx="37.2" cy="65.4" r="1.2" fill="#ffffff" />
              <circle cx="53.2" cy="65.4" r="1.2" fill="#ffffff" />
            </g>
            <ellipse class="lid" cx="37" cy="66" rx="7" ry="7.6" fill="#4f7d4a" />
            <ellipse class="lid" cx="53" cy="66" rx="7" ry="7.6" fill="#4f7d4a" />
            <g class="mouth" transform="translate(45 79)">
              <path class="m-idle" d="M-4 0 Q0 4 4 0" fill="none" stroke="#26452a" stroke-width="2.2" stroke-linecap="round" />
              <path class="m-flat" d="M-3.5 1 L3.5 1" fill="none" stroke="#26452a" stroke-width="2.2" stroke-linecap="round" />
              <ellipse class="m-open" cx="0" cy="2" rx="3.4" ry="4.2" fill="#26452a" />
            </g>
            <ellipse cx="27" cy="76" rx="4.4" ry="2.8" fill="#3f6b3c" opacity=".5" />
            <ellipse cx="63" cy="76" rx="4.4" ry="2.8" fill="#3f6b3c" opacity=".5" />
          </g>
          <g class="arm left" transform="translate(16.5 89)">
            <rect x="-8.5" y="-6" width="17" height="12" rx="6" fill="#8fb573" />
          </g>
          <g class="arm right" transform="translate(73.5 89)">
            <rect x="-8.5" y="-6" width="17" height="12" rx="6" fill="#8fb573" />
          </g>
        </g>
      </svg>
    </div>
    <p class="tip">{{ TIPS[mood] }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Mood = 'idle' | 'cover' | 'error' | 'success'
const props = withDefaults(defineProps<{ mood?: Mood }>(), { mood: 'idle' })

const TIPS: Record<Mood, string> = {
  idle: '慢慢来，田不会跑',
  cover: '我什么都没看见',
  error: '这个不对哦，再看看',
  success: '请进，茶已经泡好了',
}

const host = ref<HTMLDivElement>()
const mood = computed(() => props.mood)

/* 眼球随指针微转，不追踪到变形 */
let rx = 0
let ry = 0
let tx = 0
let ty = 0
let raf = 0
let idle = true

function loop() {
  rx += (tx - rx) * 0.085
  ry += (ty - ry) * 0.085
  if (host.value) {
    const pupils = host.value.querySelectorAll<SVGGElement>('.pupil')
    pupils.forEach(p => {
      p.style.transform = `translate(${rx.toFixed(2)}px, ${ry.toFixed(2)}px)`
    })
  }
  raf = requestAnimationFrame(loop)
}

function onMove(e: PointerEvent) {
  if (!host.value || !idle) return
  const r = host.value.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy
  const len = Math.hypot(dx, dy) || 1
  const k = Math.min(4.8, len / 30)
  tx = (dx / len) * k
  ty = (dy / len) * k
}

let io: IntersectionObserver | null = null
onMounted(() => {
  window.addEventListener('pointermove', onMove, { passive: true })
  raf = requestAnimationFrame(loop)
  if (host.value) {
    io = new IntersectionObserver(entries => {
      idle = entries[0].isIntersecting
    })
    io.observe(host.value)
  }
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('pointermove', onMove)
  io?.disconnect()
})

watch(mood, m => {
  if (m === 'cover' || m === 'error') { tx = 0; ty = 0 }
})
</script>

<style scoped>
.buddy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  user-select: none;
}
.stage {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
svg {
  overflow: visible;
}
.main {
  width: 132px;
  height: 148px;
}
.side {
  transform-origin: 50% 100%;
}
.carrot {
  width: 56px;
  height: 98px;
  margin-bottom: 14px;
}
.broccoli {
  width: 64px;
  height: 100px;
  margin-bottom: 14px;
}
.side .veg-body {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: breathe 3.8s ease-in-out infinite;
}
.arm {
  transition: transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.body {
  transform-origin: 100px 200px;
  animation: breathe 3.8s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.014, 0.986); }
}

/* 眨眼 */
.lid {
  transform-box: fill-box;
  transform-origin: top center;
  transform: scaleY(0);
  transition: transform 0.09s ease-out;
  animation: blink 5.6s infinite;
}
@keyframes blink {
  0%, 93%, 100% { transform: scaleY(0); }
  95%, 97% { transform: scaleY(1); }
}

.hand {
  transition: transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pupil {
  transition: transform 0.06s linear;
}

/*  moods  */
.m-open,
.m-flat {
  display: none;
}
.buddy[data-mood='cover'] .hand.left {
  transform: translate(38px, 90px) rotate(-6deg);
}
.buddy[data-mood='cover'] .hand.right {
  transform: translate(162px, 90px) rotate(6deg);
}
.buddy[data-mood='cover'] .cheeks {
  opacity: 0.75;
}

/* 两侧蔬菜与番茄同一套情绪动作 */
.buddy[data-mood='cover'] .carrot .arm.left {
  transform: translate(28px, 74px) rotate(-8deg);
}
.buddy[data-mood='cover'] .carrot .arm.right {
  transform: translate(52px, 74px) rotate(8deg);
}
.buddy[data-mood='error'] .carrot .arm.left {
  transform: translate(16px, 102px) rotate(-14deg);
}
.buddy[data-mood='error'] .carrot .arm.right {
  transform: translate(64px, 102px) rotate(14deg);
}
.buddy[data-mood='success'] .carrot .arm.left {
  transform: translate(14px, 74px) rotate(-24deg);
}
.buddy[data-mood='success'] .carrot .arm.right {
  transform: translate(66px, 74px) rotate(24deg);
}

.buddy[data-mood='cover'] .broccoli .arm.left {
  transform: translate(23px, 74px) rotate(-8deg);
}
.buddy[data-mood='cover'] .broccoli .arm.right {
  transform: translate(67px, 74px) rotate(8deg);
}
.buddy[data-mood='error'] .broccoli .arm.left {
  transform: translate(11px, 102px) rotate(-14deg);
}
.buddy[data-mood='error'] .broccoli .arm.right {
  transform: translate(79px, 102px) rotate(14deg);
}
.buddy[data-mood='success'] .broccoli .arm.left {
  transform: translate(9px, 74px) rotate(-24deg);
}
.buddy[data-mood='success'] .broccoli .arm.right {
  transform: translate(81px, 74px) rotate(24deg);
}

.buddy[data-mood='error'] .m-idle {
  display: none;
}
.buddy[data-mood='error'] .m-flat {
  display: block;
}
.buddy[data-mood='error'] .hand.left {
  transform: translate(38px, 160px) rotate(-14deg);
}
.buddy[data-mood='error'] .hand.right {
  transform: translate(162px, 160px) rotate(14deg);
}

.buddy[data-mood='success'] .m-idle {
  display: none;
}
.buddy[data-mood='success'] .m-open {
  display: block;
}
.buddy[data-mood='success'] .hand.left {
  transform: translate(46px, 132px) rotate(-24deg);
}
.buddy[data-mood='success'] .hand.right {
  transform: translate(154px, 132px) rotate(24deg);
}

.tip {
  margin: 0;
  font-size: 11.5px;
  color: var(--ink-3);
  letter-spacing: 0.02em;
  transition: opacity 0.2s var(--ease);
}
</style>