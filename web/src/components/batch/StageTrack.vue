<template>
  <div class="track">
    <div v-for="(s, i) in stages" :key="s.key" class="node" :data-state="s.state">
      <div class="line" v-if="i > 0" :data-state="s.state" />
      <div class="dot" />
      <span class="name">{{ s.name }}</span>
      <span class="time mono">{{ s.time || (s.state === 'missing' ? '缺记录' : '—') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface Stage {
  key: string
  name: string
  time?: string
  state: 'done' | 'current' | 'missing' | 'todo'
}
defineProps<{ stages: Stage[] }>()
</script>

<style scoped>
.track {
  display: flex;
  align-items: flex-start;
}
.node {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 18px;
}
.line {
  position: absolute;
  top: 5px;
  right: 50%;
  left: -50%;
  height: 1px;
  background: var(--line-strong);
}
.line[data-state='todo'],
.line[data-state='missing'] {
  background: repeating-linear-gradient(
    90deg,
    var(--line-strong) 0 4px,
    transparent 4px 9px
  );
}
.dot {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--line-strong);
  transition: all 0.2s var(--ease);
}
.node[data-state='done'] .dot {
  background: var(--pine);
  border-color: var(--pine);
}
.node[data-state='current'] .dot {
  background: var(--wheat);
  border-color: var(--wheat);
  box-shadow: 0 0 0 4px rgba(201, 164, 92, 0.16);
}
.node[data-state='missing'] .dot {
  background: var(--paper);
  border: 1px dashed var(--alert);
}
.name {
  font-size: 12.5px;
  color: var(--ink);
  letter-spacing: 0.02em;
}
.node[data-state='todo'] .name {
  color: var(--ink-3);
}
.node[data-state='missing'] .name {
  color: var(--alert);
}
.time {
  font-size: 10.5px;
  color: var(--ink-3);
  margin-top: 5px;
}
.node[data-state='missing'] .time {
  color: var(--alert);
}
</style>