<template>
  <ol class="tl" :class="{ dense }">
    <li v-for="e in events" :key="e.id" :data-alert="e.alert ? '1' : '0'">
      <time class="t mono">{{ e.happenTime.slice(5, 16) }}</time>
      <span class="rail" />
      <span class="dot" />
      <div class="body">
        <div class="row">
          <strong>{{ e.title }}</strong>
          <em class="stage">{{ e.stage }}</em>
        </div>
        <p class="detail">{{ e.detail }}</p>
        <p class="meta">
          <span v-if="e.operator">{{ e.operator }}</span>
          <a v-if="e.certUrl" :href="e.certUrl">查看凭证</a>
          <span v-if="e.hash" class="hash mono">#{{ e.hash.slice(0, 8) }}</span>
        </p>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { TraceEvent } from '@/api'
withDefaults(defineProps<{ events: TraceEvent[]; dense?: boolean }>(), { dense: false })
</script>

<style scoped>
.tl {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  position: relative;
  display: grid;
  grid-template-columns: 78px 1px 1fr;
  gap: 0 14px;
  padding-bottom: 26px;
}
li:last-child {
  padding-bottom: 0;
}
.t {
  grid-column: 1;
  font-size: 10.5px;
  color: var(--ink-3);
  text-align: right;
  padding-top: 3px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.rail {
  grid-column: 2;
  position: relative;
  background: var(--line);
}
li:last-child .rail {
  background: linear-gradient(to bottom, var(--line) 0 22px, transparent 22px);
}
.dot {
  position: absolute;
  left: 92px;
  top: 3px;
  width: 9px;
  height: 9px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--line-strong);
  z-index: 1;
  box-sizing: border-box;
}
li[data-alert='1'] .dot {
  background: var(--alert);
  border-color: var(--alert);
  box-shadow: 0 0 0 3px rgba(180, 70, 47, 0.12);
}
li:first-child .dot {
  background: var(--pine);
  border-color: var(--pine);
}
.body {
  grid-column: 3;
  padding-bottom: 2px;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
strong {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
}
.stage {
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 5px;
}
.detail {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ink-2);
  line-height: 1.62;
}
.meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 7px 0 0;
  font-size: 10.5px;
  color: var(--ink-3);
}
.meta a {
  color: var(--pine);
  text-decoration: none;
  border-bottom: 1px solid rgba(47, 93, 80, 0.35);
  padding-bottom: 1px;
}
.hash {
  margin-left: auto;
  letter-spacing: 0.02em;
  color: #a8ada4;
}

/* 手机端：时间放标题下面，省掉左栏 */
.dense li {
  grid-template-columns: 1px 1fr;
  padding-left: 14px;
  gap: 0 14px;
}
.dense li .t {
  display: none;
}
.dense li .rail {
  grid-column: 1;
}
.dense .dot {
  left: 0;
}
.dense .body {
  grid-column: 2;
}
.dense .detail {
  font-size: 12.5px;
}
</style>