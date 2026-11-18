<template>
  <div v-if="total > size" class="m-pager">
    <span>第 {{ start }}–{{ end }} 条 / 共 {{ total }} 条</span>
    <div class="acts">
      <button :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
      <button :disabled="page * size >= total" @click="$emit('change', page + 1)">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; size: number; total: number }>()
defineEmits<{ change: [page: number] }>()

const start = computed(() => (props.total ? (props.page - 1) * props.size + 1 : 0))
const end = computed(() => Math.min(props.page * props.size, props.total))
</script>

<style scoped>
.m-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 2px 2px;
  font-size: 11.5px;
  color: var(--ink-3);
}
.acts {
  display: flex;
  gap: 6px;
}
.acts button {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink-2);
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
}
.acts button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
