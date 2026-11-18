import { ref } from 'vue'
import { apiSysPage } from '@/api'

export interface FarmOption {
  id: number
  name: string
  plots?: number
  areaMu?: number
}

const ID_KEY = 'agri_farm_id'
const NAME_KEY = 'agri_farm_name'

export const farmId = ref(Number(localStorage.getItem(ID_KEY)) || 1)
export const farmName = ref(localStorage.getItem(NAME_KEY) || '青禾家庭农场')
export const farmOptions = ref<FarmOption[]>([
  { id: 1, name: '青禾家庭农场' },
  { id: 2, name: '青禾西沟基地' },
  { id: 3, name: '青禾新圩基地' },
])

export function setFarm(id: number, name?: string) {
  const hit = farmOptions.value.find(f => f.id === id)
  farmId.value = id
  farmName.value = name || hit?.name || farmName.value
  localStorage.setItem(ID_KEY, String(farmId.value))
  localStorage.setItem(NAME_KEY, farmName.value)
  window.dispatchEvent(new CustomEvent('agri-farm-changed', { detail: { id: farmId.value, name: farmName.value } }))
}

export function farmIdOfName(name: string): number {
  return farmOptions.value.find(f => f.name === name)?.id ?? 1
}

let loaded = false
export async function loadFarms() {
  if (loaded) return
  try {
    const data = await apiSysPage()
    farmOptions.value = data.farms.map((f, i) => ({
      id: Number((f as { id?: number }).id ?? i + 1),
      name: f.name,
      plots: f.plots,
      areaMu: f.areaMu,
    }))
    const hit = farmOptions.value.find(f => f.id === farmId.value)
    if (hit) {
      farmName.value = hit.name
      localStorage.setItem(NAME_KEY, hit.name)
    }
    loaded = true
  } catch {
    /* 网络异常时保留默认三个基地 */
  }
}
