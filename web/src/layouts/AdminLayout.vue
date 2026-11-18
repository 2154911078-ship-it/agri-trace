<template>
  <div class="shell">
    <nav class="rail">
      <router-link to="/dashboard" class="brand" title="青禾农业">
        <span class="brand-mark">青</span>
      </router-link>

      <div class="rail-scroll">
        <template v-for="(g, gi) in NAV" :key="g.group">
          <i v-if="gi > 0" class="sep" />
          <router-link
            v-for="it in g.items"
            :key="it.key"
            :to="it.to"
            class="item"
            :class="{ active: isActive(it.to) }"
          >
            <component :is="it.icon" :size="19" :stroke-width="1.6" />
            <span>{{ it.label }}</span>
          </router-link>
        </template>
      </div>

      <router-link :to="FOOT_NAV.to" class="item foot" :class="{ active: isActive(FOOT_NAV.to) }">
        <component :is="FOOT_NAV.icon" :size="19" :stroke-width="1.6" />
        <span>{{ FOOT_NAV.label }}</span>
      </router-link>
    </nav>

    <div class="main">
      <header class="topbar">
        <div class="crumb">
          <span v-for="(c, i) in crumbs" :key="i">
            <template v-if="i"> / </template>{{ c }}
          </span>
        </div>
        <div class="right">
          <span class="num clock">{{ clock }}</span>
          <span class="who">{{ me.name }} · {{ me.roleName }}</span>
          <button class="bell" title="通知" @click="router.push('/notifications')">
            <Bell :size="17" :stroke-width="1.6" />
            <i v-if="unread > 0">{{ unread > 99 ? '99+' : unread }}</i>
          </button>
          <button class="avatar" @click="menu = !menu; farmOpen = false">{{ me.name.charAt(0) }}</button>
          <transition name="pop">
            <div v-if="menu" class="menu">
              <div class="farm-cur">当前 · {{ farmName }}</div>
              <a @click="openAccount">账号设置</a>
              <a @click.stop="farmOpen = !farmOpen">
                切换农场
                <span class="caret" :class="{ up: farmOpen }">›</span>
              </a>
              <div v-if="farmOpen" class="farm-list">
                <button
                  v-for="f in farmOptions"
                  :key="f.id"
                  :class="{ on: f.id === farmId }"
                  @click="chooseFarm(f.id, f.name)"
                >
                  <span>{{ f.name }}</span>
                  <em>{{ f.plots ?? '—' }} 块</em>
                  <i v-if="f.id === farmId">✓</i>
                </button>
              </div>
              <i />
              <a class="danger" @click="logout">退出登录</a>
            </div>
          </transition>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <AccountPanel :open="accountOpen" @close="accountOpen = false" @updated="onMeUpdated" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAV, FOOT_NAV } from './nav'
import { Bell } from 'lucide-vue-next'
import AccountPanel from './AccountPanel.vue'
import { clearToken } from '@/utils/http'
import { apiLogout, apiMe } from '@/api'
import { apiNotificationSummary } from '@/api/p0'
import { farmId, farmName, farmOptions, loadFarms, setFarm } from '@/stores/farm'

const route = useRoute()
const router = useRouter()
const menu = ref(false)
const farmOpen = ref(false)
const accountOpen = ref(false)
const clock = ref('')
const unread = ref(0)
const me = ref({ name: '张耕', roleName: '合作社管理员' })

const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/')

const crumbs = computed(() => {
  const all = NAV.flatMap(g => g.items)
  const hit = all.find(i => isActive(i.to))
  const label = hit ? hit.label : (route.meta.title as string) || '概览'
  return [farmName.value, label]
})

let t = 0
let poll = 0
async function fetchUnread() {
  try { unread.value = (await apiNotificationSummary()).unread } catch { unread.value = 0 }
}
function tickClock() {
  const d = new Date()
  clock.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
onMounted(() => {
  tickClock()
  t = window.setInterval(tickClock, 20000)
  void loadFarms()
  void fetchUnread()
  poll = window.setInterval(fetchUnread, 60000)
  apiMe()
    .then(u => { me.value = { name: u.name, roleName: u.roleName } })
    .catch(() => {
      if (location.search.includes('demo=1')) return
      clearToken()
      router.replace('/login')
    })
})
onBeforeUnmount(() => { clearInterval(t); clearInterval(poll) })

function openAccount() {
  menu.value = false
  accountOpen.value = true
}

function onMeUpdated(u: { name: string; roleName: string }) {
  me.value = { name: u.name, roleName: u.roleName }
}

function chooseFarm(id: number, name: string) {
  if (id !== farmId.value) {
    setFarm(id, name)
    window.location.reload()
    return
  }
  menu.value = false
  farmOpen.value = false
}

async function logout() {
  await apiLogout().catch(() => undefined)
  clearToken()
  router.replace('/login')
}
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  background: var(--paper);
  color: var(--ink);
}

/* 左窄栏 72px */
.rail {
  width: 72px;
  flex: 0 0 72px;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0 12px;
}
.brand {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  text-decoration: none;
}
.brand-mark {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
  color: var(--pine);
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  transition: background 0.16s var(--ease);
}
.brand:hover .brand-mark {
  background: var(--paper-2);
}

.rail-scroll {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scrollbar-width: none;
}
.rail-scroll::-webkit-scrollbar {
  display: none;
}
.sep {
  display: block;
  height: 1px;
  width: 32px;
  margin: 10px auto;
  background: var(--line);
}

.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 9px 0 7px;
  color: var(--ink-3);
  text-decoration: none;
  transition: color 0.16s var(--ease);
}
.item span {
  font-size: 10px;
  letter-spacing: 0.04em;
  line-height: 1;
}
.item:hover {
  color: var(--ink-2);
}
.item.active {
  color: var(--pine);
}
.item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: var(--pine);
  border-radius: 0 2px 2px 0;
}
.foot {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  width: 100%;
}

/* 主区 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 56px;
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px 0 32px;
  border-bottom: 1px solid var(--line);
}
.crumb {
  font-size: 12px;
  color: var(--ink-3);
}
.right {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}
.clock {
  font-size: 12px;
  color: var(--ink-3);
}
.who {
  font-size: 12px;
  color: var(--ink-2);
}
.bell {
  position: relative;
  border: 0;
  background: none;
  color: var(--ink-2);
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
}
.bell i {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--alert);
  color: #fff;
  font-style: normal;
  font-size: 9px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 999px;
  min-width: 14px;
  text-align: center;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: none;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  transition: background 0.16s var(--ease);
}
.avatar:hover {
  background: var(--paper-2);
}
.menu {
  position: absolute;
  right: 0;
  top: 38px;
  z-index: 30;
  width: 196px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--sh-pop);
  padding: 6px;
  display: flex;
  flex-direction: column;
}
.menu a {
  font-size: 12.5px;
  color: var(--ink-2);
  padding: 8px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.menu a:hover {
  background: var(--paper-2);
}
.farm-cur {
  font-size: 10.5px;
  color: var(--ink-3);
  padding: 5px 10px 7px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}
.caret {
  font-family: var(--font-num);
  color: var(--ink-3);
  transform: rotate(90deg);
  transition: transform 0.16s var(--ease);
}
.caret.up {
  transform: rotate(-90deg);
}
.farm-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 6px;
}
.farm-list button {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  text-align: left;
  padding: 7px 8px;
  border-radius: var(--r-sm);
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
}
.farm-list button:hover {
  background: var(--paper-2);
}
.farm-list button.on {
  background: var(--pine-soft, #e7efeb);
  color: var(--pine);
}
.farm-list em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--ink-3);
}
.farm-list i {
  font-style: normal;
  color: var(--pine);
  font-size: 11px;
}
.menu > i {
  height: 1px;
  background: var(--line);
  margin: 5px 4px;
}
.menu .danger {
  color: var(--alert);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 26px 32px 40px;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.14s var(--ease), transform 0.14s var(--ease);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>