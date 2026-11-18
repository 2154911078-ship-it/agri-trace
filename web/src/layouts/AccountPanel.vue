<template>
  <SlidePanel
    :open="open"
    title="账号设置"
    kicker="ACCOUNT"
    subtitle="查看账号信息，更新联系方式或修改登录密码"
    @close="$emit('close')"
  >
    <div class="acc">
      <section class="who">
        <span class="avatar">{{ me?.name?.charAt(0) || '张' }}</span>
        <div>
          <strong>{{ me?.name || '—' }}</strong>
          <p>{{ me?.roleName || '—' }} · {{ me?.farmName || '—' }}</p>
        </div>
        <span class="account mono">{{ me?.account || '' }}</span>
      </section>

      <section class="grid">
        <div><span>账号</span><b class="mono">{{ me?.account || '—' }}</b></div>
        <div><span>角色</span><b>{{ me?.roleName || '—' }}</b></div>
        <div><span>所属农场</span><b>{{ me?.farmName || '—' }}</b></div>
        <div><span>最近登录</span><b class="mono">{{ me?.lastLogin || '—' }}</b></div>
      </section>

      <form class="m-form" @submit.prevent="saveProfile">
        <label>
          <span>手机号</span>
          <input v-model.trim="phone" placeholder="选填，用于接收预警通知" maxlength="20" />
        </label>
        <div class="m-form-actions">
          <button class="primary" type="submit" :disabled="savingProfile">
            {{ savingProfile ? '保存中…' : '保存资料' }}
          </button>
        </div>
      </form>

      <i class="sep" />

      <form class="m-form" @submit.prevent="changePassword">
        <label>
          <span>原密码</span>
          <input v-model="oldPwd" type="password" autocomplete="current-password" required />
        </label>
        <label>
          <span>新密码</span>
          <input v-model="newPwd" type="password" autocomplete="new-password" minlength="6" required />
        </label>
        <label>
          <span>确认新密码</span>
          <input v-model="newPwd2" type="password" autocomplete="new-password" required />
        </label>
        <p class="hint">新密码至少 6 位；修改后下次登录使用新密码。</p>
        <div class="m-form-actions">
          <button class="primary" type="submit" :disabled="savingPwd">
            {{ savingPwd ? '提交中…' : '修改密码' }}
          </button>
        </div>
      </form>
    </div>
  </SlidePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SlidePanel from '@/components/ui/SlidePanel.vue'
import { apiChangePassword, apiMe, apiUpdateProfile, type AuthMe } from '@/api'
import { toast } from '@/utils/toast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; updated: [AuthMe] }>()

const me = ref<AuthMe | null>(null)
const phone = ref('')
const oldPwd = ref('')
const newPwd = ref('')
const newPwd2 = ref('')
const savingProfile = ref(false)
const savingPwd = ref(false)

async function load() {
  try {
    me.value = await apiMe()
    phone.value = me.value.phone || ''
  } catch (e: any) {
    toast(e?.message || '账号信息读取失败', 'error')
  }
}

watch(
  () => props.open,
  v => {
    if (v) load()
    else {
      oldPwd.value = ''
      newPwd.value = ''
      newPwd2.value = ''
    }
  },
  { immediate: true },
)

async function saveProfile() {
  savingProfile.value = true
  try {
    me.value = await apiUpdateProfile({ phone: phone.value })
    toast('资料已保存')
    emit('updated', me.value)
  } catch (e: any) {
    toast(e?.message || '保存失败', 'error')
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (newPwd.value.length < 6) {
    toast('新密码至少 6 位', 'error')
    return
  }
  if (newPwd.value !== newPwd2.value) {
    toast('两次输入的新密码不一致', 'error')
    return
  }
  savingPwd.value = true
  try {
    await apiChangePassword({ oldPassword: oldPwd.value, newPassword: newPwd.value })
    toast('密码已修改，下次登录请使用新密码')
    oldPwd.value = ''
    newPwd.value = ''
    newPwd2.value = ''
  } catch (e: any) {
    toast(e?.message || '修改失败', 'error')
  } finally {
    savingPwd.value = false
  }
}
</script>

<style scoped>
.acc {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.who {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--pine-soft, #e7efeb);
  color: var(--pine);
  font-size: 17px;
  font-family: var(--font-serif);
}
.who strong {
  font-size: 15px;
  font-weight: 600;
}
.who p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--ink-3);
}
.account {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-3);
  background: var(--paper-2);
  padding: 3px 8px;
  border-radius: 999px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.grid div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.grid span {
  font-size: 11px;
  color: var(--ink-3);
}
.grid b {
  font-size: 12.5px;
  font-weight: 500;
}
.sep {
  display: block;
  height: 1px;
  background: var(--line);
}
.hint {
  margin: -6px 0 0;
  font-size: 11px;
  color: var(--ink-3);
}
</style>
