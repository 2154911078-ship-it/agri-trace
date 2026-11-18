<template>
  <div class="ph">
    <div class="page-head">
      <div>
        <p class="kicker">建设中</p>
        <h1>{{ title }}</h1>
        <p>接口契约已在 <code>src/api/index.ts</code> 定义，后端按同一份字段实现即可接上。</p>
      </div>
    </div>

    <div class="box">
      <p class="t">这一屏还差什么</p>
      <ul>
        <li v-for="i in items" :key="i">{{ i }}</li>
      </ul>
      <p class="hint">当前可完整走通的链路：登录 → 概览 → 地块 → 批次详情 → 追溯链。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '模块')

const MAP: Record<string, string[]> = {
  生产: ['农事录入表单（环节 / 投入品 / 用量 / 照片）', '安全间隔期实时校验', '今日流水与批量导入'],
  质检: ['检测单录入与逐项判定', '报告上传、哈希去重、归档', '不合格处置与批次锁定'],
  赋码: ['号段批量生成（含 HMAC 校验位）', 'A4 标签排版与打印', '激活、作废、扫码统计'],
  物流: ['运输单录入与发车', 'GPS 打点与温度曲线', '签收留痕与冷链超限预警'],
  追溯: ['追溯码列表与扫码日志', '批次码段管理'],
  系统: ['用户 / 角色 / 菜单', '数据权限（本农场 / 指定农场 / 全部）', '操作日志'],
}

const items = computed(() => MAP[title.value] || ['模块开发中'])
</script>

<style scoped>
.ph {
  max-width: 900px;
}
.kicker {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
  margin: 0 0 12px;
}
.page-head h1 {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}
.page-head p {
  margin: 9px 0 0;
  font-size: 12.5px;
  color: var(--ink-3);
}
.page-head code {
  font-family: var(--font-num);
  font-size: 11.5px;
  background: var(--paper-2);
  padding: 1px 5px;
  border-radius: 3px;
}
.box {
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
.t {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  margin: 0 0 14px;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
li {
  font-size: 13px;
  color: var(--ink-2);
  padding-left: 12px;
  border-left: 1px solid var(--line);
  line-height: 1.7;
}
.hint {
  margin: 24px 0 0;
  font-size: 12px;
  color: var(--ink-3);
}
</style>