<template>
  <div class="label-page">
    <header class="label-toolbar no-print">
      <div>
        <p class="kicker">LABEL PRINT · 追溯标签</p>
        <h1>标签打印</h1>
        <p v-if="data">批次 {{ data.batch.batchNo }} · {{ data.batch.cropName }} · {{ data.codes.length }} 枚</p>
      </div>
      <div class="acts">
        <button class="ghost" @click="back">返回赋码</button>
        <button class="ghost" :disabled="busy" @click="exportPng">下载 PNG</button>
        <button class="ghost" :disabled="busy" @click="exportPdf">下载 PDF</button>
        <button class="primary" :disabled="busy" @click="print">打印</button>
      </div>
    </header>

    <div class="settings no-print" v-if="data">
      <label><span>标题</span><input v-model.trim="title" /></label>
      <label><span>规格</span><input v-model.trim="spec" /></label>
      <label><span>打印数量</span>
        <select v-model.number="limit" @change="reload">
          <option :value="12">12 枚</option>
          <option :value="24">24 枚</option>
          <option :value="40">40 枚</option>
          <option :value="60">60 枚</option>
        </select>
      </label>
      <p class="hint">手机与电脑需在同一局域网；二维码指向 {{ origin }}</p>
    </div>

    <div v-if="loading" class="state">正在生成二维码…</div>
    <div v-else-if="error" class="state bad">{{ error }}</div>
    <div v-else class="sheet">
      <article v-for="c in data?.codes || []" :key="c.code" class="label">
        <img v-if="qrMap[c.code]" :src="qrMap[c.code]" alt="二维码" />
        <div class="label-text">
          <strong>{{ title }}</strong>
          <p>{{ data?.batch.cropName }} {{ data?.batch.variety || '' }} · {{ spec }}</p>
          <p>批次 {{ data?.batch.batchNo }} · {{ data?.batch.farmName }}</p>
          <p>地块 {{ data?.batch.plotNo }} · 采收 {{ data?.batch.harvestDate || '—' }}</p>
          <code>{{ c.code }}</code>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { apiLanAddress } from '@/api'
import { apiSegmentCodes, type LabelData } from '@/api/p0'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const data = ref<LabelData | null>(null)
const qrMap = ref<Record<string, string>>({})
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const title = ref('青禾农业 · 产品追溯')
const spec = ref('')
const limit = ref(24)
const origin = ref('')

const cropSpec = (crop?: string) => crop === '晚稻' ? '25 kg / 袋' : crop === '油菜' ? '50 kg / 袋' : crop === '草莓' ? '0.5 kg / 盒' : '2.5 kg / 箱'

async function resolveOrigin() {
  const env = import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined
  if (env) return env
  const host = window.location.hostname
  if (host === '127.0.0.1' || host === 'localhost') {
    try {
      const lan = await apiLanAddress()
      return `http://${lan.ip}:${window.location.port || '5181'}`
    } catch {
      return window.location.origin
    }
  }
  return window.location.origin
}

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const id = Number(route.params.id)
    const d = await apiSegmentCodes(id, limit.value)
    data.value = d
    origin.value = await resolveOrigin()
    if (!spec.value) spec.value = cropSpec(d.batch.cropName)
    const entries = await Promise.all(d.codes.map(async c => {
      const url = `${origin.value}/t/${c.code}`
      return [c.code, await QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' })] as const
    }))
    qrMap.value = Object.fromEntries(entries)
  } catch (e: any) {
    error.value = e?.message || '码段数据读取失败'
  } finally {
    loading.value = false
  }
}

function back() {
  router.push('/codes')
}

function print() {
  window.print()
}

async function exportPng() {
  if (!data.value) return
  busy.value = true
  try {
    const codes = data.value.codes
    const cols = 3
    const cw = 420
    const ch = 300
    const rows = Math.ceil(codes.length / cols)
    const canvas = document.createElement('canvas')
    canvas.width = cols * cw
    canvas.height = rows * ch
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const images = await Promise.all(codes.map(c => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = qrMap.value[c.code]
    })))
    codes.forEach((c, i) => {
      const x = (i % cols) * cw
      const y = Math.floor(i / cols) * ch
      ctx.strokeStyle = '#ddd'
      ctx.strokeRect(x + 8, y + 8, cw - 16, ch - 16)
      ctx.drawImage(images[i], x + 20, y + 30, 150, 150)
      ctx.fillStyle = '#1a1d1b'
      ctx.font = '600 17px sans-serif'
      ctx.fillText(title.value, x + 190, y + 48)
      ctx.font = '14px sans-serif'
      const lines = [
        `${data.value!.batch.cropName} ${data.value!.batch.variety || ''} · ${spec.value}`,
        `批次 ${data.value!.batch.batchNo}`,
        `${data.value!.batch.farmName} · ${data.value!.batch.plotNo}`,
        `采收 ${data.value!.batch.harvestDate || '—'}`,
      ]
      lines.forEach((line, k) => ctx.fillText(line, x + 190, y + 78 + k * 24))
      ctx.font = '12px monospace'
      ctx.fillText(c.code, x + 20, y + 210)
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `labels-${data.value.batch.batchNo}.png`
    a.click()
    toast('PNG 已生成')
  } catch (e: any) {
    toast(e?.message || '导出失败', 'error')
  } finally {
    busy.value = false
  }
}

async function exportPdf() {
  if (!data.value) return
  busy.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const cols = 3
    const cw = 62
    const ch = 64
    const marginX = 10
    const marginY = 12
    const codes = data.value.codes
    for (let i = 0; i < codes.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols) % 4
      if (i > 0 && i % 12 === 0) doc.addPage()
      const x = marginX + col * cw
      const y = marginY + row * ch
      doc.setDrawColor(220)
      doc.rect(x, y, cw - 4, ch - 4)
      doc.addImage(qrMap.value[codes[i].code], 'PNG', x + 3, y + 4, 28, 28)
      doc.setFontSize(7)
      doc.setTextColor(26, 29, 27)
      doc.text(title.value.slice(0, 24), x + 34, y + 9)
      doc.setFontSize(6)
      doc.text(`${data.value.batch.cropName} ${data.value.batch.variety || ''}`, x + 34, y + 14)
      doc.text(spec.value, x + 34, y + 18)
      doc.text(`批次 ${data.value.batch.batchNo}`.slice(0, 30), x + 34, y + 22)
      doc.text(`${data.value.batch.farmName}`.slice(0, 24), x + 34, y + 26)
      doc.text(`采收 ${data.value.batch.harvestDate || '—'}`, x + 34, y + 30)
      doc.setFontSize(5.5)
      doc.text(codes[i].code, x + 4, y + 38)
    }
    doc.save(`labels-${data.value.batch.batchNo}.pdf`)
    toast('PDF 已生成')
  } catch (e: any) {
    toast(e?.message || '导出失败', 'error')
  } finally {
    busy.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.label-page { min-height: 100vh; background: var(--paper-2, #f2f0ea); padding: 24px 30px 40px; color: var(--ink); }
.label-toolbar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
.kicker { margin: 0 0 6px; font-size: 10.5px; letter-spacing: .08em; color: var(--ink-3); }
h1 { margin: 0 0 6px; font-family: var(--font-serif); font-size: 28px; font-weight: 500; }
.label-toolbar p { margin: 0; font-size: 12px; color: var(--ink-3); }
.acts { display: flex; gap: 8px; }
.settings { display: flex; align-items: flex-end; gap: 14px; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; margin-bottom: 18px; flex-wrap: wrap; }
.settings label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: var(--ink-3); }
.settings input, .settings select { border: 1px solid var(--line); background: var(--paper-2); border-radius: var(--r-sm); padding: 7px 10px; font-size: 12px; color: var(--ink); min-width: 150px; }
.settings .hint { margin: 0 0 8px auto; font-size: 11px; color: var(--ink-3); }
.sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #fff; padding: 18px; border-radius: var(--r-md); }
.label { display: flex; gap: 10px; border: 1px solid #ddd; border-radius: 4px; padding: 10px; min-height: 128px; }
.label img { width: 84px; height: 84px; image-rendering: pixelated; }
.label-text { display: flex; flex-direction: column; gap: 3px; font-size: 10px; color: #333; min-width: 0; }
.label-text strong { font-size: 11.5px; }
.label-text p { margin: 0; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label-text code { font-size: 9px; color: #1a1d1b; margin-top: auto; word-break: break-all; }
.state { padding: 60px; text-align: center; color: var(--ink-3); }
.state.bad { color: var(--alert); }
@media print {
  .no-print { display: none !important; }
  .label-page { background: #fff; padding: 0; }
  .sheet { grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0; border: 0; }
  .label { break-inside: avoid; border-color: #ccc; }
}
</style>
