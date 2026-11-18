<template>
  <div class="module sys">
    <div class="page-head">
      <div>
        <p class="kicker">组织与设置 · SYSTEM</p>
        <h1>系统</h1>
        <p>农场、用户角色与操作日志 · {{ data?.users.length ?? 0 }} 个用户 · {{ data?.farms.length ?? 0 }} 个农场</p>
      </div>
      <div class="head-right">
        <button class="ghost" :disabled="loading" @click="load">刷新</button>
        <button v-if="tab === 'users'" class="primary" @click="openCreate">新增用户</button>
      </div>
    </div>

    <div class="m-toolbar">
      <div class="segs">
        <button :class="{ on: tab === 'base' }" @click="tab = 'base'">基础信息</button>
        <button :class="{ on: tab === 'users' }" @click="tab = 'users'">用户与角色<span class="n">{{ data?.users.length ?? 0 }}</span></button>
        <button :class="{ on: tab === 'logs' }" @click="tab = 'logs'">操作日志<span class="n">{{ data?.logs.length ?? 0 }}</span></button>
      </div>
      <div class="right"><span class="sub">当前数据源：实时业务库</span></div>
    </div>

    <div v-if="loading" class="loading-block">
      <span class="sk" /><span class="sk" /><span class="sk" />
    </div>

    <template v-else-if="tab === 'base'">
      <div class="farm-grid">
        <article v-for="f in data?.farms || []" :key="f.name" class="farm-card">
          <div class="farm-head">
            <h3>{{ f.name }}</h3>
            <span class="m-tag plain ok">运营中</span>
          </div>
          <p class="addr">{{ f.address }}</p>
          <div class="farm-metrics">
            <div><span>地块</span><b>{{ f.plots }}</b><em>块</em></div>
            <div><span>面积</span><b>{{ f.areaMu.toFixed(1) }}</b><em>亩</em></div>
          </div>
          <p class="farm-manager">负责人 · {{ f.manager }}</p>
        </article>
      </div>

      <div class="sys-info">
        <div class="m-section-title"><b>系统信息</b></div>
        <dl class="m-kv two">
          <div><dt>系统版本</dt><dd class="mono">agri-trace 0.1.0</dd></div>
          <div><dt>前端技术栈</dt><dd>Vue 3 · Vite · Three.js</dd></div>
          <div><dt>接口模式</dt><dd>实时接口（Spring Boot · MySQL）</dd></div>
          <div><dt>数据范围</dt><dd>{{ data?.farms.length }} 个农场 · 48 块地 · 全量业务数据</dd></div>
          <div><dt>权限模型</dt><dd>角色 + 农场数据范围</dd></div>
          <div><dt>最后同步</dt><dd class="mono">{{ lastSync }}</dd></div>
        </dl>
      </div>
    </template>

    <template v-else-if="tab === 'users'">
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>用户</th><th>角色</th><th>数据范围</th><th>状态</th><th>最近登录</th><th>联系方式</th><th style="width:80px">操作</th></tr></thead>
          <tbody>
            <tr v-for="u in data?.users || []" :key="u.id">
              <td>
                <span class="avatar">{{ u.name.charAt(0) }}</span>
                <span class="user-text"><b>{{ u.name }}</b><em>{{ u.account }}</em></span>
              </td>
              <td>{{ u.role }}</td>
              <td>{{ u.farm }}</td>
              <td><span class="m-tag" :class="u.status === 'active' ? 'ok' : 'muted'">{{ u.status === 'active' ? '启用' : '停用' }}</span></td>
              <td class="mono">{{ u.lastLogin }}</td>
              <td class="mono">{{ u.phone || '—' }}</td>
              <td><button class="m-link" :class="{ danger: u.status === 'active' }" @click="toggle(u)">{{ u.status === 'active' ? '停用' : '启用' }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="m-section">
        <div class="m-section-title"><b>角色权限</b><span>{{ data?.roles.length || 0 }} 个角色</span></div>
        <div class="role-grid">
          <article v-for="r in data?.roles || []" :key="r.key" class="role-card">
            <div class="role-head"><b>{{ r.name }}</b><span class="mono">{{ r.users }} 人</span></div>
            <p>{{ r.desc }}</p>
            <div class="perm-tags">
              <span v-for="p in r.permissions" :key="p" class="m-tag plain">{{ p }}</span>
            </div>
          </article>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th style="width:140px">时间</th><th style="width:100px">操作人</th><th style="width:130px">动作</th><th>对象</th><th style="width:130px" class="num-r">IP</th></tr></thead>
          <tbody>
            <tr v-for="l in data?.logs || []" :key="l.id">
              <td class="mono">{{ l.time }}</td>
              <td>{{ l.user }}</td>
              <td>{{ l.action }}</td>
              <td class="log-target">{{ l.target }}</td>
              <td class="num-r mono">{{ l.ip }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!(data?.logs || []).length" class="empty">暂无操作日志。</div>
      </div>
    </template>

    <SlidePanel :open="createOpen" title="新增用户" kicker="NEW USER" subtitle="新用户默认启用，可用新账号登录演示环境" @close="createOpen = false">
      <form class="m-form" @submit.prevent="submit">
        <label class="m-field">
          <span>姓名</span>
          <input v-model.trim="form.name" required />
        </label>
        <label class="m-field">
          <span>登录账号</span>
          <input v-model.trim="form.account" required placeholder="字母 / 数字" />
        </label>
        <label class="m-field">
          <span>角色</span>
          <select v-model="form.role">
            <option v-for="r in data?.roles || []" :key="r.key" :value="r.name">{{ r.name }}</option>
          </select>
        </label>
        <label class="m-field">
          <span>数据范围</span>
          <select v-model="form.farm">
            <option v-for="f in data?.farms || []" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
        </label>
        <label class="m-field full">
          <span>手机号</span>
          <input v-model.trim="form.phone" placeholder="可选" />
        </label>
        <div class="m-form-actions">
          <button type="button" class="ghost" @click="createOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '创建中…' : '创建用户' }}</button>
        </div>
      </form>
    </SlidePanel>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import { toast } from '@/utils/toast'
import { apiSysPage, apiSysUserCreate, apiSysUserToggle, type SysPage, type SysUser } from '@/api'

const data = ref<SysPage | null>(null)
const loading = ref(false)
const saving = ref(false)
const tab = ref<'base' | 'users' | 'logs'>('base')
const createOpen = ref(false)
const lastSync = new Date().toLocaleString('zh-CN', { hour12: false })
const form = reactive({ name: '', account: '', role: '农艺师', farm: '', phone: '' })

async function load() {
  loading.value = true
  try {
    data.value = await apiSysPage()
    if (!form.farm && data.value.farms[0]) form.farm = data.value.farms[0].name
    if (!data.value.roles.some(r => r.name === form.role) && data.value.roles[0]) form.role = data.value.roles[0].name
  } catch (e: any) {
    toast(e?.message || '系统信息读取失败', 'error')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.name = ''
  form.account = ''
  form.role = data.value?.roles[1]?.name || '农艺师'
  form.farm = data.value?.farms[0]?.name || ''
  form.phone = ''
  createOpen.value = true
}

async function submit() {
  if (!form.name || !form.account) {
    toast('请填写姓名和登录账号', 'warn')
    return
  }
  saving.value = true
  try {
    await apiSysUserCreate({ ...form })
    toast('用户已创建')
    createOpen.value = false
    await load()
  } catch (e: any) {
    toast(e?.message || '创建失败', 'error')
  } finally {
    saving.value = false
  }
}

async function toggle(u: SysUser) {
  try {
    await apiSysUserToggle(u.id)
    toast(u.status === 'active' ? '用户已停用' : '用户已启用')
    await load()
  } catch (e: any) {
    toast(e?.message || '操作失败', 'error')
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
.loading-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 36px 0;
}
.loading-block .sk {
  height: 18px;
}
.farm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.farm-card {
  padding: 20px 20px 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
}
.farm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.farm-head h3 {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.addr {
  margin: 7px 0 16px;
  font-size: 11px;
  color: var(--ink-3);
}
.farm-metrics {
  display: flex;
  gap: 30px;
  padding: 13px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.farm-metrics div {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.farm-metrics span {
  font-size: 10.5px;
  color: var(--ink-3);
}
.farm-metrics b {
  font-family: var(--font-num);
  font-size: 19px;
  font-weight: 500;
}
.farm-metrics em {
  font-style: normal;
  font-size: 10px;
  color: var(--ink-3);
}
.farm-manager {
  margin: 12px 0 0;
  font-size: 11.5px;
  color: var(--ink-2);
}
.sys-info {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.avatar {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-right: 9px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-size: 11px;
  color: var(--pine);
  vertical-align: middle;
}
.user-text {
  display: inline-flex;
  flex-direction: column;
  vertical-align: middle;
  gap: 1px;
}
.user-text b {
  font-size: 12.5px;
  font-weight: 500;
}
.user-text em {
  font-style: normal;
  font-family: var(--font-num);
  font-size: 10px;
  color: var(--ink-3);
}
.role-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.role-card {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
}
.role-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.role-head b {
  font-size: 13px;
  font-weight: 500;
}
.role-head span {
  font-size: 10.5px;
  color: var(--ink-3);
}
.role-card p {
  margin: 6px 0 12px;
  font-size: 11.5px;
  color: var(--ink-3);
}
.perm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.log-target {
  font-size: 12px;
  color: var(--ink-2);
}
@media (max-width: 1050px) {
  .farm-grid {
    grid-template-columns: 1fr;
  }
  .role-grid {
    grid-template-columns: 1fr;
  }
}
</style>
