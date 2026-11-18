<template>
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="open" class="mask" @click.self="$emit('close')">
        <aside class="panel" :style="{ width }" role="dialog" aria-modal="true">
          <header>
            <div class="head-text">
              <p v-if="kicker" class="kicker">{{ kicker }}</p>
              <h3>{{ title }}</h3>
              <p v-if="subtitle" class="sub">{{ subtitle }}</p>
            </div>
            <button class="close" aria-label="关闭" @click="$emit('close')">×</button>
          </header>
          <div class="body">
            <slot />
          </div>
          <footer v-if="$slots.footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    kicker?: string
    subtitle?: string
    width?: string
  }>(),
  { kicker: '', subtitle: '', width: '480px' },
)
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  v => {
    if (v) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(20, 24, 21, 0.28);
  display: flex;
  justify-content: flex-end;
}
.panel {
  max-width: 100vw;
  height: 100%;
  background: var(--paper);
  border-left: 1px solid var(--line);
  box-shadow: -18px 0 46px rgba(20, 24, 21, 0.12);
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 26px 18px;
  border-bottom: 1px solid var(--line);
}
.head-text {
  min-width: 0;
}
.kicker {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
  margin: 0 0 8px;
}
h3 {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  margin: 0;
  line-height: 1.35;
}
.sub {
  font-size: 12px;
  color: var(--ink-3);
  margin: 7px 0 0;
  line-height: 1.6;
}
.close {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  background: none;
  color: var(--ink-2);
  font-size: 18px;
  line-height: 1;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.14s var(--ease);
}
.close:hover {
  background: var(--paper-2);
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px 28px;
}
footer {
  flex: 0 0 auto;
  padding: 14px 26px 20px;
  border-top: 1px solid var(--line);
  background: var(--paper);
}
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s var(--ease);
}
.slide-enter-active .panel,
.slide-leave-active .panel {
  transition: transform 0.24s var(--ease);
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}
.slide-enter-from .panel,
.slide-leave-to .panel {
  transform: translateX(26px);
}
@media (max-width: 640px) {
  .panel {
    width: 100% !important;
  }
}
</style>
