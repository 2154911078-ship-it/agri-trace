import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  RoundedBoxGeometry, canvasTex, disposeObject, makeBrickTexture, makeEnvTexture, makeMulchTexture,
  makePlasterTexture, makeRoofTexture, makeSkyTexture, makeSmokeTexture, makeSoilTexture,
  makeSolarTexture, makeStoneTexture, makeStrataTexture, makeWoodTexture, mergeAll, paintGeo, rng,
  setShadows,
} from './parkKit'
import {
  makeBambooGeometry, makeBroadleafGeometry, makeBushGeometry, makeCabbageGeometry,
  makeCypressGeometry, makeFlowerGeometry, makeFruitTreeGeometry, makeGrapeHedgeGeometry,
  makeGrapeVineGeometry, makeGrassTuftGeometry,
  makeRapePlantGeometry, makeReedGeometry, makeRiceTuftGeometry, makeStrawberryGeometry,
  makeTrayPlantGeometry, makeWeedGeometry, makeWillowGeometry,
} from './parkFlora'
import { addCanopyShadows, buildHomestead, createWindBladeMaterial, createWindFoliageMaterial, updateWind } from '@/three-opt'

/* ==========================================================================
   青禾智慧农业园区 · 数据驱动沙盘
   8 块真实地块（编号 / 作物 / 状态 / 进度 / 负责人 / 批次）落在固定田位，
   作物长势、预警、采收筐、土壤传感器与批次牌全部来自真实接口数据。
   ========================================================================== */

export type DeviceKind = 'robot' | 'solar' | 'sensor' | 'fert' | 'wallsensor' | 'tower'
export type ParkCrop = 'grape' | 'rice' | 'rape' | 'berry'
export type ParkTheme = 'homestead' | 'water' | 'tower'
export type PlotRef = { id: number; plotNo: string; cropName: string; status: 1 | 2 | 3 | 4 }
export type ParkViewKey =
  | 'full'
  | 'village'
  | 'greenhouse'
  | 'field'
  | 'tower'
  | 'homestead'
  | 'shed'
  | 'pond'
  | 'solar'
  | 'gate'
export type ParkFacilityId = 'greenhouse' | 'tower' | 'homestead' | 'shed' | 'pond' | 'solar' | 'gate'

export type DeviceInfo = {
  id: string
  kind: DeviceKind
  name: string
  model: string
  status: string
  battery: number
  signal: number
  uptime: string
  metrics: { label: string; value: string }[]
  pos: [number, number, number]
  plot?: PlotRef
}

export type ParkPlot = {
  id: number
  plotNo: string
  name: string
  cropName: string
  variety?: string
  status: 1 | 2 | 3 | 4
  areaMu: number
  manager?: string
  batchNo?: string
  soilType?: string
  plantDate?: string
  growthDays?: number
  progress: number
  expectYieldKg?: number
  crop: ParkCrop
  lastRecord?: { type: string; happenTime: string; detail: string; operator: string }
}

export type ParkOptions = {
  plots?: ParkPlot[]
  theme?: ParkTheme
  onPick?: (d: DeviceInfo | null) => void
  onPlot?: (id: number | null) => void
  onFacility?: (id: ParkFacilityId | null) => void
}

export type VehicleState = {
  id: string
  name: string
  running: boolean
  cruise: number
  live: number
  progress: number
  routeLen: number
  dist: number
  battery: number
  following: boolean
}

export type ParkApi = {
  focus: (v: ParkViewKey) => void
  focusDevice: (id: string) => void
  followDevice: (id: string) => void
  focusPlot: (id: number) => void
  selectPlot: (id: number | null) => void
  setPatrol: (on: boolean) => void
  replayGrowth: () => void
  resize: () => void
  dispose: () => void
  devices: () => DeviceInfo[]
  vehicles: () => VehicleState[]
  setRunning: (id: string, on: boolean) => void
  setCruise: (id: string, mps: number) => void
  setProgress: (id: string, ratio: number) => void
  setFollow: (id: string | null) => void
}

export function cropKindOf(name: string): ParkCrop {
  if (/葡萄|阳光玫瑰|夏黑|巨峰/.test(name)) return 'grape'
  if (/稻/.test(name)) return 'rice'
  if (/油菜|菜籽/.test(name)) return 'rape'
  if (/草莓/.test(name)) return 'berry'
  return 'rice'
}

export const STATUS_HEX: Record<1 | 2 | 3 | 4, string> = {
  1: '#6f8f63',
  2: '#c9a45c',
  3: '#9aa79b',
  4: '#c4633f',
}
const STATUS_NAME: Record<1 | 2 | 3 | 4, string> = { 1: '生长中', 2: '待采收', 3: '休耕', 4: '预警' }
const CROP_LABEL: Record<ParkCrop, string> = { grape: '阳光玫瑰', rice: '晚稻', rape: '油菜', berry: '草莓' }
const GROUND_R = 40
const PX = 2048

type Slot = { x: number; z: number; w: number; d: number }

const SLOTS: Record<ParkCrop, Slot[]> = {
  grape: [
    { x: -33.4, z: 3.8, w: 2.9, d: 12.2 },
    { x: -27.6, z: 3.8, w: 2.9, d: 12.2 },
  ],
  rape: [
    { x: -13.2, z: 7.5, w: 11.4, d: 3.1 },
    { x: -13.2, z: 11.8, w: 11.4, d: 3.1 },
  ],
  rice: [
    { x: -17.9, z: 23.4, w: 7.2, d: 6.5 },
    { x: -8.8, z: 23.4, w: 7.2, d: 6.5 },
  ],
  berry: [
    { x: 6.9, z: 13.5, w: 5.8, d: 3.0 },
    { x: 6.9, z: 17.3, w: 5.8, d: 3.0 },
  ],
}

const VIEWS: Record<ParkViewKey, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [36, 25, 42], target: [-2, 1.2, 3] },
  village: { pos: [-1.5, 9.5, 6.5], target: [-23.5, 1.6, -16.5] },
  greenhouse: { pos: [1.5, 5.2, 6.5], target: [-8.6, 1.5, -6] },
  field: { pos: [4, 9, 38], target: [-12, 0.6, 17] },
  tower: { pos: [25, 7, 13], target: [14.8, 2.2, 0] },
  homestead: { pos: [-11.5, 7.5, -3.5], target: [-23.5, 2.0, -18] },
  shed: { pos: [34, 6.5, -3], target: [28.5, 1.4, -13] },
  pond: { pos: [24, 8.5, 32], target: [25.5, 0.4, 19.5] },
  solar: { pos: [41, 9, 9], target: [26.4, 0.8, -1.2] },
  gate: { pos: [0.5, 6.5, 45], target: [0, 1.6, 33] },
}

type TreeSpot = { x: number; z: number; type: 'broad' | 'cypress'; s: number; seed: number }
type BushSpot = [number, number, number, number]

const TREE_SPOTS: Record<ParkTheme, TreeSpot[]> = {
  homestead: [
    { x: -36.2, z: -6, type: 'broad', s: 1.0, seed: 3 },
    { x: -33.9, z: 16.0, type: 'broad', s: 0.92, seed: 8 },
    { x: -32, z: 20, type: 'cypress', s: 1.0, seed: 5 },
    { x: -26.5, z: 28.5, type: 'broad', s: 1.05, seed: 11 },
    { x: -19, z: 32.5, type: 'cypress', s: 0.85, seed: 6 },
    { x: -11.5, z: 30.5, type: 'broad', s: 0.9, seed: 13 },
    { x: 12, z: 31.5, type: 'broad', s: 0.84, seed: 17 },
    { x: 21.5, z: 28, type: 'broad', s: 0.95, seed: 19 },
    { x: 25.5, z: 27.2, type: 'cypress', s: 0.95, seed: 7 },
    { x: 36.2, z: 11.5, type: 'broad', s: 0.92, seed: 23 },
    { x: 35, z: -2, type: 'cypress', s: 0.8, seed: 9 },
    { x: 29, z: -25, type: 'broad', s: 1.08, seed: 29 },
    { x: 18, z: -33.5, type: 'cypress', s: 1.0, seed: 10 },
    { x: 6, z: -35, type: 'broad', s: 0.9, seed: 31 },
    { x: -8, z: -34, type: 'broad', s: 0.88, seed: 37 },
    { x: -24, z: -30.5, type: 'cypress', s: 0.92, seed: 12 },
    { x: -32, z: -21, type: 'broad', s: 0.98, seed: 41 },
  ],
  water: [
    { x: -36.2, z: -6, type: 'broad', s: 1.0, seed: 3 },
    { x: -33.9, z: 16.0, type: 'broad', s: 0.92, seed: 8 },
    { x: -32, z: 20.8, type: 'cypress', s: 1.0, seed: 5 },
    { x: -26.5, z: 28.5, type: 'broad', s: 1.05, seed: 11 },
    { x: -19, z: 32.5, type: 'cypress', s: 0.85, seed: 6 },
    { x: -11.5, z: 30.5, type: 'broad', s: 0.9, seed: 13 },
    { x: 12, z: 31.5, type: 'broad', s: 0.84, seed: 17 },
    { x: 20.8, z: 27.6, type: 'broad', s: 0.95, seed: 19 },
    { x: 25.5, z: 27.2, type: 'cypress', s: 0.95, seed: 7 },
    { x: 37.0, z: 4.0, type: 'broad', s: 0.86, seed: 43 },
    { x: 36.4, z: 12.0, type: 'broad', s: 0.92, seed: 23 },
    { x: 35.4, z: -3.0, type: 'cypress', s: 0.8, seed: 9 },
    { x: 29, z: -25.5, type: 'broad', s: 1.08, seed: 29 },
    { x: 18, z: -33.5, type: 'cypress', s: 1.0, seed: 10 },
    { x: 6, z: -35, type: 'broad', s: 0.9, seed: 31 },
    { x: -8, z: -34, type: 'broad', s: 0.88, seed: 37 },
    { x: -24, z: -30.5, type: 'cypress', s: 0.92, seed: 12 },
    { x: -32, z: -21, type: 'broad', s: 0.98, seed: 41 },
  ],
  tower: [
    { x: -36.2, z: -6, type: 'broad', s: 1.0, seed: 3 },
    { x: -33.9, z: 16.0, type: 'broad', s: 0.92, seed: 8 },
    { x: -32, z: 20.8, type: 'cypress', s: 1.0, seed: 5 },
    { x: -26.5, z: 28.5, type: 'broad', s: 1.05, seed: 11 },
    { x: -19, z: 32.5, type: 'cypress', s: 0.85, seed: 6 },
    { x: -11.5, z: 30.5, type: 'broad', s: 0.9, seed: 13 },
    { x: 12, z: 31.5, type: 'broad', s: 0.84, seed: 17 },
    { x: 21.5, z: 28, type: 'broad', s: 0.95, seed: 19 },
    { x: 25.5, z: 27.2, type: 'cypress', s: 0.95, seed: 7 },
    { x: 33.0, z: 18.0, type: 'broad', s: 0.9, seed: 23 },
    { x: 35.4, z: -14.0, type: 'cypress', s: 0.82, seed: 9 },
    { x: 20.5, z: 11.6, type: 'cypress', s: 0.72, seed: 47 },
    { x: 25.0, z: 11.6, type: 'cypress', s: 0.72, seed: 48 },
    { x: 30.0, z: 11.6, type: 'cypress', s: 0.72, seed: 49 },
    { x: 29, z: -25, type: 'broad', s: 1.08, seed: 29 },
    { x: 18, z: -33.5, type: 'cypress', s: 1.0, seed: 10 },
    { x: 6, z: -35, type: 'broad', s: 0.9, seed: 31 },
    { x: -8, z: -34, type: 'broad', s: 0.88, seed: 37 },
    { x: -24, z: -30.5, type: 'cypress', s: 0.92, seed: 12 },
    { x: -32, z: -21, type: 'broad', s: 0.98, seed: 41 },
  ],
}

const BUSH_SPOTS: Record<ParkTheme, BushSpot[]> = {
  homestead: [
    [-19.2, -7.3, 1.1, 1], [-25.7, -7.2, 0.9, 2], [-31.8, -17.2, 1.0, 3],
    [-17.4, -6.2, 0.8, 4], [-4.2, 1.2, 0.9, 5], [-0.3, -12.5, 1.1, 6],
    [-14.8, 0.6, 0.85, 7], [-20.6, 0.6, 0.9, 8], [3.4, 8.6, 0.8, 9],
    [10.5, 6.5, 0.9, 10], [4.2, 22.8, 0.85, 11], [10.8, 24.0, 0.9, 12],
    [16.8, 26.2, 1.0, 13], [23.0, 30.0, 0.9, 14], [32.4, -8.5, 1.1, 15],
    [23.0, -6.8, 0.95, 16], [-29.5, 22.5, 0.9, 17], [-7.0, 30.2, 0.85, 18],
  ],
  water: [
    [-19.2, -7.3, 1.1, 1], [-25.7, -7.2, 0.9, 2], [-31.8, -17.2, 1.0, 3],
    [-17.4, -6.2, 0.8, 4], [-4.2, 1.2, 0.9, 5], [-0.3, -12.5, 1.1, 6],
    [-14.8, 0.6, 0.85, 7], [-20.6, 0.6, 0.9, 8], [3.4, 8.6, 0.8, 9],
    [10.5, 6.5, 0.9, 10], [4.2, 22.8, 0.85, 11], [10.8, 24.0, 0.9, 12],
    [16.8, 26.2, 1.0, 13], [23.0, 30.0, 0.85, 14], [28.2, -12.6, 0.78, 15],
    [33.7, -5.5, 0.8, 16], [28.2, 4.0, 0.78, 17], [33.8, 7.0, 0.8, 18],
    [27.6, 12.5, 0.72, 19], [26.0, 9.0, 0.9, 20], [-29.5, 22.5, 0.9, 21],
    [-7.0, 30.2, 0.85, 22],
  ],
  tower: [
    [-19.2, -7.3, 1.1, 1], [-25.7, -7.2, 0.9, 2], [-31.8, -17.2, 1.0, 3],
    [-17.4, -6.2, 0.8, 4], [-4.2, 1.2, 0.9, 5], [-0.3, -12.5, 1.1, 6],
    [-14.8, 0.6, 0.85, 7], [-20.6, 0.6, 0.9, 8], [3.4, 8.6, 0.8, 9],
    [10.5, 6.5, 0.9, 10], [4.2, 22.8, 0.85, 11], [10.8, 24.0, 0.9, 12],
    [16.8, 26.2, 1.0, 13], [23.0, 30.0, 0.85, 14], [19.4, 10.9, 0.78, 15],
    [24.5, 11.0, 0.75, 16], [29.5, 11.0, 0.78, 17], [35.4, 9.6, 0.9, 18],
    [19.3, -13.4, 0.8, 19], [25.0, -13.6, 0.78, 20], [31.0, -13.6, 0.8, 21],
    [-29.5, 22.5, 0.9, 22], [-7.0, 30.2, 0.85, 23],
  ],
}

type ForestSpot = { x: number; z: number; s: number; seed: number; cypress: boolean }

// 后山林带：填满沙盘背面的空地，与山脊原有树木自然衔接
const FOREST_SPOTS: ForestSpot[] = (() => {
  const r = rng(1403)
  const spots: ForestSpot[] = []
  const fruit: [number, number][] = [[12.5, -17.5], [16.2, -21.5], [20.4, -17.8], [24.0, -22.5], [19.0, -25.5]]
  const ridge: [number, number][] = [[6, -35], [-8, -34], [18, -33.5], [29, -25], [-24, -30.5], [-32, -21]]
  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) > 37.6) return true
    if (Math.abs(x + 23.5) < 6.6 && Math.abs(z + 18) < 6.2) return true
    if (Math.abs(x + 8.6) < 8.2 && Math.abs(z + 6) < 5.6) return true
    if (Math.abs(x - 28.5) < 5.6 && Math.abs(z + 13) < 4.6) return true
    if (Math.abs(x - 14.8) < 4.2 && Math.abs(z + 1.4) < 12.4) return true
    if (Math.hypot(x - 25.5, z - 19.5) < 7) return true
    if (Math.hypot(x + 15.2, z + 26.5) < 3.6) return true
    if (Math.abs(x - 29.4) < 4.2 && z > -19.6) return true
    if (fruit.some(([fx, fz]) => Math.hypot(x - fx, z - fz) < 3.4)) return true
    if (Math.hypot(x - 24.5, z + 17) < 2.4) return true
    if (ridge.some(([fx, fz]) => Math.hypot(x - fx, z - fz) < 3.0)) return true
    if (spots.some(sp => Math.hypot(x - sp.x, z - sp.z) < 2.9)) return true
    return false
  }
  for (let i = 0; i < 4000 && spots.length < 70; i++) {
    const left = r() < 0.22
    const x = left ? -29 + r() * 14 : -14 + r() * 47
    const z = left ? -33 + r() * 11 : -35 + r() * 18.5
    if (!left && z > -20 && r() > 0.3) continue
    if (blocked(x, z)) continue
    const depth = Math.min(1, Math.max(0, (-21 - z) / 14))
    const s = 1.15 + depth * 0.5 + r() * 0.25
    const cypress = r() < 0.07
    spots.push({ x, z, s: cypress ? s * 0.95 : s, seed: Math.floor(r() * 997) + 3, cypress })
  }
  return spots
})()

const FOREST_SHRUBS: BushSpot[] = FOREST_SPOTS
  .filter(sp => !sp.cypress && sp.z > -29)
  .flatMap(sp => {
    const a = sp.seed * 0.73
    const out: BushSpot[] = [
      [sp.x + Math.cos(a) * 1.6, sp.z + Math.sin(a) * 1.5, 0.82 + (sp.seed % 5) * 0.07, sp.seed],
    ]
    if (sp.seed % 3 === 0) {
      out.push([sp.x + Math.cos(a + 2.4) * 2.1, sp.z + Math.sin(a + 2.4) * 2.0, 0.7 + (sp.seed % 4) * 0.08, sp.seed + 7])
    }
    return out
  })
  .filter(([x, z]) => Math.hypot(x, z) < 35.4)

const FOREST_SAPLINGS: BushSpot[] = FOREST_SPOTS
  .filter(sp => !sp.cypress && sp.seed % 2 === 0)
  .map(sp => {
    const a = sp.seed * 1.31
    return [sp.x + Math.cos(a) * 1.45, sp.z + Math.sin(a) * 1.35, 0.62 + (sp.seed % 6) * 0.05, sp.seed] as BushSpot
  })
  .filter(([x, z]) => Math.hypot(x, z) < 34.8)

const THEME_STYLE: Record<ParkTheme, {
  bg: number
  sky: number
  ground: number
  sun: number
  sunIntensity: number
  exposure: number
  fov: number
  full: { pos: [number, number, number]; target: [number, number, number] }
  village: { pos: [number, number, number]; target: [number, number, number] }
}> = {
  homestead: {
    bg: 0xdfe8e4, sky: 0xffffff, ground: 0xffffff, sun: 0xfff0d4, sunIntensity: 2.35, exposure: 1.04, fov: 44,
    full: { pos: [31, 30, 52], target: [1, 0.8, 4] }, village: VIEWS.village,
  },
  water: {
    bg: 0xd6e6e4, sky: 0xe4f1ee, ground: 0xdff0e6, sun: 0xf5f3e0, sunIntensity: 2.15, exposure: 1.03, fov: 42,
    full: { pos: [38, 26, 49], target: [5, 0.8, 5] },
    village: { pos: [17, 8, 31], target: [25, 1.2, 18] },
  },
  tower: {
    bg: 0xe6e3d7, sky: 0xf4ecdc, ground: 0xefe9d8, sun: 0xffe3bd, sunIntensity: 2.5, exposure: 1.06, fov: 42,
    full: { pos: [39, 26, 48], target: [7, 0.8, -2] },
    village: { pos: [26, 8, 18], target: [26.4, 1, 0] },
  },
}

const ROADS: { pts: [number, number][]; w: number }[] = [
  { pts: [[0, 34], [0.4, 27], [0.2, 19], [0.4, 11], [0.9, 6], [2.4, 2.2]], w: 2.8 },
  { pts: [[2.4, 2.2], [-2.5, -0.5], [-8.5, -3.5], [-14.5, -6.2], [-18.5, -9.5]], w: 2.2 },
  { pts: [[2.4, 2.2], [6.5, 1.2], [10.5, 1.2]], w: 2.0 },
  { pts: [[-23, 2], [-23, 30]], w: 1.7 },
  { pts: [[-22, 18.7], [-6, 18.9], [6, 19.1], [17.5, 19.4]], w: 1.7 },
  { pts: [[10.2, 12.4], [11.6, 14.2], [11.8, 18.4]], w: 1.5 },
  { pts: [[-13.5, 14.3], [-13.5, 17.8]], w: 1.4 },
  { pts: [[17.5, 19.4], [20.4, 19.4]], w: 1.6 },
]

const ROBOT_ROUTE: [number, number][] = [
  [2.8, 2.5], [5.2, 1.8], [7.8, 1.55], [9.9, 1.9], [10.4, 4.2], [10.3, 7.2],
  [10.2, 10.2], [10.6, 12.6], [11.3, 14.4], [11.55, 16.6], [11.5, 18.4],
  [10.0, 19.45], [7.4, 19.55], [4.4, 19.5], [1.7, 19.2], [0.55, 18.1],
  [0.3, 15.4], [0.3, 12.2], [0.5, 8.8], [0.8, 5.6], [1.6, 3.4],
]

const CART_ROUTE: [number, number][] = [
  [-5.0, 4.6], [-7.0, 4.0], [-11.0, 3.8], [-15.0, 3.8], [-18.6, 4.2], [-20.6, 5.8],
  [-21.0, 9.0], [-21.0, 12.0], [-20.4, 14.6], [-18.0, 15.4], [-14.0, 15.5], [-10.0, 15.5],
  [-7.2, 15.2], [-5.4, 14.0], [-4.8, 11.0], [-4.8, 8.0],
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const pxOf = (v: number) => (v / (GROUND_R * 2) + 0.5) * PX
const unitPx = PX / (GROUND_R * 2)

const SLOT_ORDER: Slot[] = [
  SLOTS.grape[0], SLOTS.grape[1],
  SLOTS.rice[0], SLOTS.rice[1],
  SLOTS.rape[0], SLOTS.rape[1],
  SLOTS.berry[0], SLOTS.berry[1],
]

function assignSlots(plots: ParkPlot[]) {
  return plots.slice(0, SLOT_ORDER.length).map((plot, i) => ({ plot, slot: SLOT_ORDER[i] }))
}

/* ------------------------------ 贴图 ------------------------------ */

function makeGroundTexture(stations: { plot: ParkPlot; slot: Slot }[], theme: ParkTheme) {
  return canvasTex(PX, PX, ctx => {
    const r = rng(2026)
    ctx.fillStyle = '#75975a'
    ctx.fillRect(0, 0, PX, PX)

    for (let i = 0; i < 40; i++) {
      // 渐变内外圆必须同心：起点圆落在终点圆外时浏览器会折出尖锐三角碎片
      const cx = r() * PX
      const cy = r() * PX
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 + r() * 320)
      g.addColorStop(0, r() > 0.5 ? 'rgba(96,128,70,0.30)' : 'rgba(156,178,116,0.24)')
      g.addColorStop(1, 'rgba(117,151,90,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, PX, PX)
    }
    // 草纹
    for (let i = 0; i < 5200; i++) {
      const x = r() * PX
      const y = r() * PX
      ctx.strokeStyle = r() > 0.55 ? `rgba(96,122,72,${0.12 + r() * 0.2})` : `rgba(168,184,131,${0.1 + r() * 0.16})`
      ctx.lineWidth = 0.7 + r() * 1.2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (r() - 0.5) * 5, y - 2 - r() * 5)
      ctx.stroke()
    }

    // 林下地表：后山铺一层柔和深绿并撒落叶，让林地与草坪自然区分
    {
      const cx = pxOf(2)
      const cy = pxOf(-28.5)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 31 * unitPx)
      g.addColorStop(0, 'rgba(50,74,39,0.48)')
      g.addColorStop(0.6, 'rgba(56,82,44,0.3)')
      g.addColorStop(1, 'rgba(70,96,54,0)')
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(cx, cy, 31 * unitPx, 12.5 * unitPx, 0, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = g
      ctx.fillRect(0, 0, PX, PX)
      for (let i = 0; i < 380; i++) {
        const a = r() * Math.PI * 2
        const rad = Math.sqrt(r())
        const x = cx + Math.cos(a) * rad * 30 * unitPx
        const y = cy + Math.sin(a) * rad * 12 * unitPx
        ctx.fillStyle = r() > 0.55 ? `rgba(84,66,44,${0.05 + r() * 0.1})` : `rgba(52,72,40,${0.05 + r() * 0.1})`
        ctx.beginPath()
        ctx.ellipse(x, y, 1 + r() * 2.6, 0.8 + r() * 1.6, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      // 林隙光斑
      for (let i = 0; i < 150; i++) {
        const a = r() * Math.PI * 2
        const rad = Math.sqrt(r())
        const x = cx + Math.cos(a) * rad * 29 * unitPx
        const y = cy + Math.sin(a) * rad * 11.6 * unitPx
        ctx.fillStyle = `rgba(143,160,92,${0.03 + r() * 0.05})`
        ctx.beginPath()
        ctx.ellipse(x, y, 2 + r() * 7, 1.4 + r() * 4, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // 田块土面
    stations.forEach(({ plot, slot }) => {
      const x = pxOf(slot.x - slot.w / 2)
      const y = pxOf(slot.z - slot.d / 2)
      const w = slot.w * unitPx
      const h = slot.d * unitPx
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 8)
      ctx.clip()
      const g = ctx.createLinearGradient(x, y, x + w, y + h)
      g.addColorStop(0, plot.crop === 'rice' ? '#685744' : '#725640')
      g.addColorStop(1, plot.crop === 'berry' ? '#5d4937' : '#644b37')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      for (let i = 0; i < 130; i++) {
        ctx.fillStyle = r() > 0.5 ? `rgba(45,32,22,${0.1 + r() * 0.2})` : `rgba(150,120,84,${0.08 + r() * 0.16})`
        ctx.beginPath()
        ctx.ellipse(x + r() * w, y + r() * h, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      // 耕作行
      ctx.strokeStyle = 'rgba(48,35,24,0.28)'
      ctx.lineWidth = 2
      if (plot.crop === 'grape') {
        for (let gx = x + 14; gx < x + w; gx += 24) {
          ctx.beginPath()
          ctx.moveTo(gx, y)
          ctx.lineTo(gx, y + h)
          ctx.stroke()
        }
      } else if (plot.crop === 'rape' || plot.crop === 'berry') {
        for (let gy = y + 14; gy < y + h; gy += 22) {
          ctx.beginPath()
          ctx.moveTo(x, gy)
          ctx.lineTo(x + w, gy)
          ctx.stroke()
        }
      } else {
        for (let gy = y + 16; gy < y + h; gy += 30) {
          ctx.strokeStyle = 'rgba(58,72,52,0.18)'
          ctx.beginPath()
          ctx.moveTo(x, gy)
          ctx.lineTo(x + w, gy)
          ctx.stroke()
        }
      }
      ctx.restore()
      ctx.strokeStyle = 'rgba(82,92,68,0.4)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 8)
      ctx.stroke()
    })

    // 院子石板（仅本场院主题）
    if (theme === 'homestead') {
      const cx = pxOf(-23.5)
      const cy = pxOf(-11.3)
      const cw = 11.2 * unitPx
      const ch = 5.6 * unitPx
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 14)
      ctx.clip()
      ctx.fillStyle = '#a9a294'
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch)
      for (let y = cy - ch / 2; y < cy + ch / 2; y += 18) {
        for (let x = cx - cw / 2; x < cx + cw / 2; x += 26) {
          const tone = 150 + Math.floor(r() * 34)
          ctx.fillStyle = `rgb(${tone + 14},${tone + 8},${tone - 8})`
          ctx.fillRect(x + 1, y + 1, 24, 16)
        }
      }
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(70,66,56,${0.04 + r() * 0.12})`
        ctx.fillRect(cx - cw / 2 + r() * cw, cy - ch / 2 + r() * ch, 1 + r() * 3, 1 + r() * 2)
      }
      ctx.restore()
    }

    // 小路
    ROADS.forEach(road => {
      const stroke = (width: number, color: string) => {
        ctx.strokeStyle = color
        ctx.lineWidth = width * unitPx
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        road.pts.forEach(([x, z], i) => {
          const X = pxOf(x)
          const Y = pxOf(z)
          if (i === 0) ctx.moveTo(X, Y)
          else ctx.lineTo(X, Y)
        })
        ctx.stroke()
      }
      stroke(road.w + 1.1, 'rgba(96,108,76,0.42)')
      stroke(road.w, '#c2b18a')
      stroke(road.w * 0.72, '#c9b992')
      // 碎石
      const a = road.pts[0]
      const b = road.pts[road.pts.length - 1]
      for (let i = 0; i < 70; i++) {
        const t = r()
        const x = pxOf(a[0] + (b[0] - a[0]) * t) + (r() - 0.5) * road.w * unitPx
        const y = pxOf(a[1] + (b[1] - a[1]) * t) + (r() - 0.5) * road.w * unitPx
        ctx.fillStyle = `rgba(120,110,88,${0.06 + r() * 0.14})`
        ctx.beginPath()
        ctx.arc(x, y, 0.6 + r() * 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // 停车砾石
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(pxOf(3.4), pxOf(28.4), 5.2 * unitPx, 4.0 * unitPx, 12)
    ctx.fillStyle = '#b9b199'
    ctx.fill()
    ctx.clip()
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${90 + r() * 70},${86 + r() * 60},${72 + r() * 50},${0.2 + r() * 0.3})`
      ctx.fillRect(pxOf(3.4) + r() * 5.2 * unitPx, pxOf(28.4) + r() * 4.0 * unitPx, 1 + r() * 2.4, 1 + r() * 2)
    }
    ctx.restore()

    // 池塘泥岸
    if (theme !== 'tower') {
      ctx.fillStyle = '#6b5942'
      ctx.beginPath()
      ctx.ellipse(pxOf(25.5), pxOf(19.5), 6.3 * unitPx, 6.0 * unitPx, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(72,94,86,0.55)'
      ctx.beginPath()
      ctx.ellipse(pxOf(25.5), pxOf(19.5), 5.2 * unitPx, 4.9 * unitPx, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // 水乡河道泥岸
    if (theme === 'water') {
      ctx.fillStyle = '#6b5942'
      ctx.beginPath()
      ctx.roundRect(pxOf(28.5), pxOf(-18.7), 5.0 * unitPx, 36.4 * unitPx, 26)
      ctx.fill()
      ctx.fillStyle = 'rgba(72,94,86,0.5)'
      ctx.beginPath()
      ctx.roundRect(pxOf(29.0), pxOf(-18.1), 4.0 * unitPx, 35.2 * unitPx, 22)
      ctx.fill()
    }

    // 垂直农场集控场坪
    if (theme === 'tower') {
      ctx.fillStyle = '#b8b3a5'
      ctx.beginPath()
      ctx.roundRect(pxOf(19.6), pxOf(-12.2), 13.6 * unitPx, 22.0 * unitPx, 18)
      ctx.fill()
      ctx.strokeStyle = 'rgba(92,90,80,0.18)'
      ctx.lineWidth = 1
      for (let gx = 20.4; gx < 33.2; gx += 2.0) {
        ctx.beginPath()
        ctx.moveTo(pxOf(gx), pxOf(-12.2))
        ctx.lineTo(pxOf(gx), pxOf(9.8))
        ctx.stroke()
      }
      for (let gz = -11.4; gz < 9.8; gz += 2.0) {
        ctx.beginPath()
        ctx.moveTo(pxOf(19.6), pxOf(gz))
        ctx.lineTo(pxOf(33.2), pxOf(gz))
        ctx.stroke()
      }
    }
  }, [1, 1])
}

function makeSignTexture(plot: ParkPlot) {
  const tex = canvasTex(512, 320, ctx => {
    const r = rng(plot.id * 97 + 11)
    ctx.fillStyle = '#f7f3e6'
    ctx.fillRect(0, 0, 512, 320)
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(118,108,80,${0.015 + r() * 0.04})`
      ctx.fillRect(r() * 512, r() * 320, 1 + r() * 2, 1 + r() * 1.5)
    }
    ctx.strokeStyle = 'rgba(73,92,62,0.3)'
    ctx.lineWidth = 2
    ctx.strokeRect(13, 13, 486, 294)

    ctx.fillStyle = STATUS_HEX[plot.status]
    ctx.fillRect(13, 13, 9, 294)

    ctx.fillStyle = '#7b8374'
    ctx.font = '500 15px "Microsoft YaHei", sans-serif'
    ctx.fillText('青禾家庭农场 · 地块档案', 40, 48)
    ctx.font = '400 11px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#a3a898'
    ctx.fillText('PLOT RECORD', 40, 66)

    const status = STATUS_NAME[plot.status]
    ctx.font = '600 16px "Microsoft YaHei", sans-serif'
    const tw = ctx.measureText(status).width + 30
    ctx.fillStyle = STATUS_HEX[plot.status]
    ctx.beginPath()
    ctx.roundRect(484 - tw, 30, tw, 28, 14)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(status, 484 - tw / 2, 49)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#2f3a2c'
    ctx.font = '700 54px Georgia, "Times New Roman", "Songti SC", serif'
    ctx.fillText(plot.plotNo, 38, 128)

    ctx.fillStyle = '#4d5748'
    ctx.font = '500 18px "Microsoft YaHei", sans-serif'
    ctx.fillText(plot.name, 42, 155)

    ctx.fillStyle = '#2f3a2c'
    ctx.font = '600 28px "Songti SC", "SimSun", serif'
    ctx.fillText(plot.cropName, 40, 200)
    if (plot.variety) {
      const w = ctx.measureText(plot.cropName).width
      ctx.fillStyle = '#8a927f'
      ctx.font = '400 17px "Microsoft YaHei", sans-serif'
      ctx.fillText(`· ${plot.variety}`, 46 + w, 199)
    }

    ctx.strokeStyle = 'rgba(73,92,62,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 220)
    ctx.lineTo(470, 220)
    ctx.stroke()

    ctx.fillStyle = '#5f6a58'
    ctx.font = '400 15px "Microsoft YaHei", sans-serif'
    ctx.fillText(`${plot.areaMu.toFixed(1)} 亩`, 40, 248)
    ctx.fillText(`进度 ${Math.round(clamp01(plot.progress) * 100)}%`, 132, 248)
    ctx.fillText(plot.manager ? `负责人 ${plot.manager}` : '未指定负责人', 292, 248)

    ctx.fillStyle = 'rgba(80,98,68,0.15)'
    ctx.beginPath()
    ctx.roundRect(40, 262, 430, 6, 3)
    ctx.fill()
    ctx.fillStyle = STATUS_HEX[plot.status]
    ctx.beginPath()
    ctx.roundRect(40, 262, Math.max(6, 430 * clamp01(plot.progress)), 6, 3)
    ctx.fill()

    ctx.fillStyle = '#8a927f'
    ctx.font = '400 13px "Microsoft YaHei", sans-serif'
    ctx.fillText(plot.batchNo ? `在田批次 ${plot.batchNo}` : '当前无在田批次', 40, 296)
  })
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function makeRingTexture(color: string, dashed: boolean) {
  const tex = canvasTex(256, 256, ctx => {
    ctx.clearRect(0, 0, 256, 256)
    ctx.strokeStyle = color
    ctx.lineWidth = dashed ? 6 : 7
    ctx.setLineDash(dashed ? [22, 13] : [])
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.roundRect(10, 10, 236, 236, 20)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.roundRect(18, 18, 220, 220, 16)
    ctx.stroke()
  })
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function makeAlertTexture() {
  const tex = canvasTex(128, 128, ctx => {
    ctx.clearRect(0, 0, 128, 128)
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 58)
    g.addColorStop(0, 'rgba(255,244,226,0.98)')
    g.addColorStop(0.55, 'rgba(255,241,214,0.92)')
    g.addColorStop(1, 'rgba(255,236,198,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(64, 64, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c4633f'
    ctx.beginPath()
    ctx.arc(64, 64, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff7e8'
    ctx.font = '700 46px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('!', 64, 80)
  })
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function makeGateTexture() {
  const tex = canvasTex(1024, 256, ctx => {
    ctx.fillStyle = '#3d3a2c'
    ctx.fillRect(0, 0, 1024, 256)
    const r = rng(881)
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '120,100,66' : '38,33,24'},${0.05 + r() * 0.12})`
      ctx.lineWidth = 0.8 + r() * 1.6
      ctx.beginPath()
      ctx.moveTo(r() * 1024, 0)
      ctx.bezierCurveTo(r() * 1024, 80, r() * 1024, 180, r() * 1024, 256)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(214,190,138,0.45)'
    ctx.lineWidth = 2
    ctx.strokeRect(24, 22, 976, 212)
    ctx.fillStyle = '#f2e7ca'
    ctx.font = '600 86px "Songti SC", "SimSun", serif'
    ctx.textAlign = 'center'
    ctx.fillText('青禾家庭农场', 512, 128)
    ctx.fillStyle = 'rgba(232,218,184,0.6)'
    ctx.font = '400 22px "Microsoft YaHei", sans-serif'
    ctx.fillText('QINGHE FAMILY FARM  ·  智慧农业示范园', 512, 180)
    ctx.textAlign = 'left'
  })
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function makeGreenhouseSign() {
  const tex = canvasTex(1024, 192, ctx => {
    ctx.fillStyle = '#f1ecdc'
    ctx.fillRect(0, 0, 1024, 192)
    ctx.strokeStyle = 'rgba(64,92,62,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(14, 14, 996, 164)
    ctx.fillStyle = '#3e5c3c'
    ctx.font = '600 58px "Songti SC", "SimSun", serif'
    ctx.textAlign = 'center'
    ctx.fillText('连栋温室 · 水肥一体化', 512, 92)
    ctx.fillStyle = '#80907a'
    ctx.font = '400 22px "Microsoft YaHei", sans-serif'
    ctx.fillText('GREENHOUSE No.2  ·  青禾家庭农场', 512, 140)
    ctx.textAlign = 'left'
  })
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function makeWaterMaterial(color: string, scale: number, opacity = 0.88) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: scale },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uScale; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * uScale;
        float w = sin(p.x * 2.3 + uTime * 0.85) * 0.5 + 0.5;
        float w2 = sin(p.y * 3.1 - uTime * 0.62 + p.x * 1.7) * 0.5 + 0.5;
        float spec = pow(max(0.0, sin((p.x + p.y) * 2.6 + uTime * 1.2)), 18.0);
        vec3 col = mix(uColor * 0.88, uColor * 1.16, w * 0.5 + w2 * 0.5);
        col += spec * 0.16;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  })
}

/* ------------------------------ 主场景 ------------------------------ */

export function createParkScene(host: HTMLElement, options: ParkOptions = {}): ParkApi {
  const theme: ParkTheme = options.theme ?? 'homestead'
  const style = THEME_STYLE[theme]
  const views: Record<ParkViewKey, { pos: [number, number, number]; target: [number, number, number] }> = {
    ...VIEWS,
    full: style.full,
    village: style.village,
  }
  const stations = assignSlots(options.plots ?? [])
  const width = host.clientWidth || 900
  const height = host.clientHeight || 600

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = style.exposure
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(style.bg)
  scene.fog = new THREE.Fog(style.bg, 88, 200)

  const camera = new THREE.PerspectiveCamera(style.fov, width / height, 0.1, 420)
  camera.position.set(...views.full.pos)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(...views.full.target)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  controls.minDistance = 6
  controls.maxDistance = 88
  controls.maxPolarAngle = Math.PI * 0.485
  controls.minPolarAngle = 0.18
  controls.enablePan = false
  controls.rotateSpeed = 0.62
  controls.zoomSpeed = 0.78

  const world = new THREE.Group()
  scene.add(world)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = makeEnvTexture()
  envTex.mapping = THREE.EquirectangularReflectionMapping
  const envRT = pmrem.fromEquirectangular(envTex)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.35
  envTex.dispose()
  pmrem.dispose()

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(240, 48, 24),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), color: style.sky, side: THREE.BackSide, fog: false, depthWrite: false }),
  )
  sky.renderOrder = -1
  scene.add(sky)

  const hemi = new THREE.HemisphereLight(0xdfeaf2, 0x5d6b50, 0.6)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(style.sun, style.sunIntensity)
  sun.position.set(30, 38, 24)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -46
  sun.shadow.camera.right = 46
  sun.shadow.camera.top = 46
  sun.shadow.camera.bottom = -46
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 140
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.035
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xbcd2df, 0.28)
  fill.position.set(-28, 18, -22)
  scene.add(fill)

  /* ------------------------------ 材质 ------------------------------ */
  const soilMat = new THREE.MeshStandardMaterial({ map: makeSoilTexture(17), roughness: 0.97 })
  const mulchMat = new THREE.MeshStandardMaterial({ map: makeMulchTexture(), roughness: 0.94 })
  const plasterMat = new THREE.MeshStandardMaterial({ map: makePlasterTexture(), roughness: 0.92 })
  const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.82 })
  const darkWood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), color: 0x8a7352, roughness: 0.84 })
  const stoneMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(), roughness: 0.94 })
  const roofMat = new THREE.MeshStandardMaterial({ map: makeRoofTexture(), roughness: 0.86 })
  const brickMat = new THREE.MeshStandardMaterial({ map: makeBrickTexture(), roughness: 0.93 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4d5b53, roughness: 0.46, metalness: 0.62 })
  const whiteMetal = new THREE.MeshStandardMaterial({ color: 0xd7ddd4, roughness: 0.42, metalness: 0.35 })
  const darkFrame = new THREE.MeshStandardMaterial({ color: 0x33423a, roughness: 0.5, metalness: 0.55 })
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.83 })
  // 非农作物植被风动材质（树木/灌木/草地），农作物继续使用 leafMat
  const windFoliage = createWindFoliageMaterial()
  const windBlade = createWindBladeMaterial()
  const builtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.22 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbed9d6, transparent: true, opacity: 0.24, roughness: 0.08, metalness: 0.24,
    side: THREE.DoubleSide, depthWrite: false,
  })
  const waterPond = makeWaterMaterial('#487c72', 1.35, 0.9)

  /* ------------------------------ 基础工具 ------------------------------ */
  const addBox = (
    parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number,
    x: number, y: number, z: number, ry = 0, cast = true,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.rotation.y = ry
    m.castShadow = cast
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const addCyl = (
    parent: THREE.Object3D, mat: THREE.Material, rt: number, rb: number, h: number,
    x: number, y: number, z: number, seg = 16,
  ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const addRBox = (
    parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number,
    x: number, y: number, z: number, radius = 0.04, cast = true,
  ) => {
    const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.002)
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat)
    m.position.set(x, y, z)
    m.castShadow = cast
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const addMesh = (
    parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material,
    x: number, y: number, z: number, cast = false,
  ) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = cast
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const addPlane = (
    parent: THREE.Object3D, mat: THREE.Material, w: number, h: number,
    x: number, y: number, z: number,
  ) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.position.set(x, y, z)
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const addMerged = (parent: THREE.Object3D, geos: THREE.BufferGeometry[], mat: THREE.Material, y = 0) => {
    if (!geos.length) return null
    const m = new THREE.Mesh(mergeAll(geos), mat)
    m.position.y = y
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  /* ------------------------------ 地表 ------------------------------ */
  const groundTex = makeGroundTexture(stations, theme)
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_R, 144),
    new THREE.MeshStandardMaterial({ map: groundTex, color: style.ground, roughness: 0.96, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  world.add(ground)

  const strataTex = makeStrataTexture()
  strataTex.repeat.set(2.4, 1)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(GROUND_R, GROUND_R - 1.1, 2.2, 144, 1, true),
    new THREE.MeshStandardMaterial({ map: strataTex, roughness: 0.98 }),
  )
  base.position.y = -1.1
  base.receiveShadow = true
  world.add(base)

  const rimTex = makeStoneTexture()
  rimTex.repeat.set(14, 1)
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(GROUND_R + 0.06, GROUND_R + 0.06, 0.22, 144, 1, true),
    new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.92 }),
  )
  rim.position.y = -0.1
  world.add(rim)

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_R - 1.1, 96),
    new THREE.MeshStandardMaterial({ color: 0x4d473c, roughness: 1 }),
  )
  bottom.rotation.x = Math.PI / 2
  bottom.position.y = -2.2
  world.add(bottom)

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(GROUND_R - 0.02, 0.07, 6, 144),
    new THREE.MeshStandardMaterial({ color: 0x66794f, roughness: 0.88 }),
  )
  edge.rotation.x = Math.PI / 2
  edge.position.y = 0.035
  world.add(edge)

  /* ------------------------------ 地块 ------------------------------ */
  type CropItem = { x: number; y: number; z: number; s: number; ry: number }
  type Grow = { mesh: THREE.InstancedMesh; items: CropItem[]; delay: number; done: boolean }
  const grows: Grow[] = []
  const waters: THREE.ShaderMaterial[] = []
  const plotObjs: {
    plot: ParkPlot
    slot: Slot
    selectRing: THREE.Mesh
    selectMat: THREE.MeshBasicMaterial
    ringMat: THREE.MeshBasicMaterial
    alertMat?: THREE.SpriteMaterial
    alertSprite?: THREE.Sprite
    alertBaseY?: number
  }[] = []
  const pickables: THREE.Object3D[] = []
  const alertTexture = makeAlertTexture()

  const dummy = new THREE.Object3D()

  const makeCrop = (geo: THREE.BufferGeometry, items: CropItem[], delay: number) => {
    const mesh = new THREE.InstancedMesh(geo, leafMat, items.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.castShadow = true
    mesh.receiveShadow = true
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z)
      dummy.rotation.set(0, it.ry, 0)
      dummy.scale.setScalar(0.2)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    grows.push({ mesh, items, delay, done: false })
    return mesh
  }

  const crateGeo = (seed: number, produce: string) => {
    const r = rng(seed)
    const list: THREE.BufferGeometry[] = []
    const slat = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d)
      g.translate(x, y, z)
      paintGeo(g, '#9a7a50', 0.05)
      list.push(g)
    }
    const W = 0.62
    const D = 0.44
    const H = 0.32
    slat(W, 0.05, D, 0, 0.025, 0)
    for (let i = 0; i < 3; i++) {
      slat(W, 0.055, 0.025, 0, 0.09 + i * 0.09, D / 2 - 0.01)
      slat(W, 0.055, 0.025, 0, 0.09 + i * 0.09, -D / 2 + 0.01)
      slat(0.025, 0.055, D, W / 2 - 0.01, 0.09 + i * 0.09, 0)
      slat(0.025, 0.055, D, -W / 2 + 0.01, 0.09 + i * 0.09, 0)
    }
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const g = new THREE.BoxGeometry(0.055, 0.36, 0.055)
      g.translate((sx * W) / 2, 0.18, (sz * D) / 2)
      paintGeo(g, '#86663f', 0.04)
      list.push(g)
    }
    for (let i = 0; i < 12; i++) {
      const g = new THREE.SphereGeometry(0.062 + r() * 0.02, 7, 5)
      g.translate((r() - 0.5) * 0.42, 0.37 + r() * 0.05, (r() - 0.5) * 0.27)
      paintGeo(g, produce, 0.08)
      list.push(g)
    }
    return mergeAll(list)
  }

  const addCrates = (parent: THREE.Object3D, plot: ParkPlot, slot: Slot, top: number) => {
    const colors: Record<ParkCrop, string> = {
      grape: '#703653', rice: '#c8a24c', rape: '#d8b743', berry: '#bb3f30',
    }
    const list: THREE.BufferGeometry[] = []
    const spots: [number, number, number][] = [
      [-slot.w / 2 + 0.75, top, slot.d / 2 - 0.75],
      [-slot.w / 2 + 1.42, top, slot.d / 2 - 0.78],
      [-slot.w / 2 + 1.09, top + 0.34, slot.d / 2 - 0.76],
    ]
    spots.forEach(([x, y, z], i) => {
      const g = crateGeo(plot.id * 19 + i, colors[plot.crop])
      g.rotateY(i % 2 === 0 ? 0.18 : -0.12)
      g.translate(x, y, z)
      list.push(g)
    })
    const m = new THREE.Mesh(mergeAll(list), builtMat)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
  }

  stations.forEach(({ plot, slot }) => {
    const g = new THREE.Group()
    g.position.set(slot.x, 0, slot.z)
    world.add(g)

    const isBerry = plot.crop === 'berry'
    const isRice = plot.crop === 'rice'
    const isFallow = plot.status === 3
    const baseH = isBerry ? 0.34 : 0.12
    const bedTop = isBerry ? 0.36 : isRice ? 0.18 : 0.14

    const bed = new THREE.Mesh(new RoundedBoxGeometry(slot.w, baseH, slot.d, 2, 0.05), soilMat)
    bed.position.y = baseH / 2
    bed.receiveShadow = true
    bed.castShadow = true
    g.add(bed)

    if (isRice) {
      const bund = 0.18
      const bh = 0.3
      addBox(g, soilMat, slot.w, bh, bund, 0, bh / 2, -slot.d / 2 + bund / 2)
      addBox(g, soilMat, slot.w, bh, bund, 0, bh / 2, slot.d / 2 - bund / 2)
      addBox(g, soilMat, bund, bh, slot.d, -slot.w / 2 + bund / 2, bh / 2, 0)
      addBox(g, soilMat, bund, bh, slot.d, slot.w / 2 - bund / 2, bh / 2, 0)
      if (!isFallow) {
        const wMat = makeWaterMaterial('#6c9786', 9, 0.7)
        const water = new THREE.Mesh(new THREE.PlaneGeometry(slot.w - 0.35, slot.d - 0.35), wMat)
        water.rotation.x = -Math.PI / 2
        water.position.y = 0.15
        g.add(water)
        waters.push(wMat)
      }
    }

    if (isBerry) {
      const mulch = new THREE.Mesh(
        new THREE.PlaneGeometry(slot.w - 0.22, slot.d - 0.22),
        new THREE.MeshStandardMaterial({ map: makeMulchTexture(), roughness: 0.94 }),
      )
      mulch.rotation.x = -Math.PI / 2
      mulch.position.y = baseH + 0.015
      mulch.receiveShadow = true
      g.add(mulch)
      for (const hx of [-1.75, -0.05, 1.65]) {
        const hoop = new THREE.Mesh(
          new THREE.TorusGeometry(slot.d / 2 - 0.08, 0.025, 5, 16, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xd7d9cc, roughness: 0.5, metalness: 0.4 }),
        )
        hoop.rotation.y = Math.PI / 2
        hoop.position.set(hx, baseH, 0)
        hoop.castShadow = true
        g.add(hoop)
      }
    }

    const pad = isBerry ? 0.3 : 0.58
    const ringMat = new THREE.MeshBasicMaterial({
      map: makeRingTexture(STATUS_HEX[plot.status], true),
      transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(slot.w + pad * 2, slot.d + pad * 2), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.24
    g.add(ring)

    const selectMat = new THREE.MeshBasicMaterial({
      map: makeRingTexture('#f4efdc', false),
      transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    })
    const selectRing = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.w + pad * 2 + 0.14, slot.d + pad * 2 + 0.14),
      selectMat,
    )
    selectRing.rotation.x = -Math.PI / 2
    selectRing.position.y = 0.26
    selectRing.visible = false
    g.add(selectRing)

    const pick = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.w, slot.d),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    pick.rotation.x = -Math.PI / 2
    pick.position.y = 0.32
    pick.userData.plotId = plot.id
    g.add(pick)
    pickables.push(pick)

    // 地块铭牌（真实编号 / 状态 / 作物 / 进度 / 批次）
    const sign = new THREE.Group()
    sign.position.set(slot.w / 2 - 0.5, 0, slot.d / 2 + 0.5)
    const boardMat = new THREE.MeshStandardMaterial({ map: makeSignTexture(plot), roughness: 0.82, metalness: 0 })
    const backing = addBox(sign, woodMat, 2.18, 1.4, 0.07, 0, 1.34, -0.05)
    backing.castShadow = true
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3125), boardMat)
    board.position.set(0, 1.34, 0.01)
    board.userData.plotId = plot.id
    sign.add(board)
    pickables.push(board)
    for (const sx of [-0.86, 0.86]) {
      addCyl(sign, woodMat, 0.055, 0.07, 1.02, sx, 0.51, -0.05, 8)
    }
    const cap = addBox(sign, roofMat, 2.3, 0.07, 0.34, 0, 2.06, -0.02)
    cap.castShadow = true
    g.add(sign)

    // 作物
    if (!isFallow) {
      const r = rng(plot.id * 31 + 7)
      if (plot.crop === 'grape') {
        // 按地块长宽自适应行向：宽垄横向成行，窄长垄纵向成行
        const alongX = slot.w >= slot.d
        const longLen = alongX ? slot.w : slot.d
        const shortLen = alongX ? slot.d : slot.w
        const rowCount = Math.max(2, Math.min(5, Math.round(shortLen / 1.0)))
        const rows: number[] = []
        for (let i = 0; i < rowCount; i++) {
          rows.push(rowCount > 1 ? (i - (rowCount - 1) / 2) * ((shortLen - 1.0) / (rowCount - 1)) : 0)
        }
        const vineCount = Math.max(3, Math.round(longLen / 1.35))
        const vines: CropItem[] = []
        for (const off of rows) {
          for (let i = 0; i < vineCount; i++) {
            const along = -longLen / 2 + 0.75 + (i * (longLen - 1.5)) / (vineCount - 1)
            vines.push({
              x: (alongX ? along : off) + (r() - 0.5) * 0.08,
              y: 0.12,
              z: (alongX ? off : along) + (r() - 0.5) * 0.1,
              s: 0.96 + r() * 0.16,
              ry: r() * 6.28,
            })
          }
        }
        g.add(makeCrop(makeGrapeVineGeometry(plot.id * 13 + 3, plot.status === 4, 1), vines, 0))
        const trellis: THREE.BufferGeometry[] = []
        for (const off of rows) {
          for (let t = -longLen / 2 + 0.6; t <= longLen / 2 - 0.5; t += 2.7) {
            const post = new THREE.CylinderGeometry(0.028, 0.038, 1.95, 6)
            post.translate(alongX ? t : off, 0.975, alongX ? off : t)
            paintGeo(post, '#4d5a45', 0.04)
            trellis.push(post)
          }
          for (const y of [0.9, 1.34, 1.78]) {
            const wire = new THREE.CylinderGeometry(0.011, 0.011, longLen - 0.7, 5)
            if (alongX) wire.rotateZ(Math.PI / 2)
            else wire.rotateX(Math.PI / 2)
            wire.translate(alongX ? 0 : off, y, alongX ? off : 0)
            paintGeo(wire, '#59654f', 0.02)
            trellis.push(wire)
          }
        }
        addMerged(g, trellis, builtMat)
        for (const [i, off] of rows.entries()) {
          const hedge = new THREE.Mesh(
            makeGrapeHedgeGeometry(plot.id * 41 + i * 7 + 3, longLen - 1.7, plot.status === 4, 1),
            leafMat,
          )
          if (alongX) hedge.rotation.y = Math.PI / 2
          hedge.position.set(alongX ? 0 : off, 0, alongX ? off : 0)
          hedge.castShadow = true
          hedge.receiveShadow = true
          g.add(hedge)
        }
      } else if (plot.crop === 'rice') {
        const items: CropItem[] = []
        const ripe = plot.status === 2 || plot.progress > 0.82
        for (let x = -slot.w / 2 + 0.55; x <= slot.w / 2 - 0.45; x += 0.8) {
          for (let z = -slot.d / 2 + 0.55; z <= slot.d / 2 - 0.45; z += 0.8) {
            items.push({
              x: x + (r() - 0.5) * 0.22, y: 0.17, z: z + (r() - 0.5) * 0.22,
              s: 0.82 + r() * 0.22, ry: r() * 6.28,
            })
          }
        }
        g.add(makeCrop(makeRiceTuftGeometry(plot.id * 7 + 5, ripe, 1), items, 0))
      } else if (plot.crop === 'rape') {
        const items: CropItem[] = []
        const mature = plot.status === 2 || plot.progress > 0.55
        for (const z of [-0.92, 0, 0.92]) {
          for (let x = -slot.w / 2 + 0.65; x <= slot.w / 2 - 0.55; x += 0.72) {
            items.push({
              x: x + (r() - 0.5) * 0.16, y: 0.13, z: z + (r() - 0.5) * 0.16,
              s: 0.88 + r() * 0.2, ry: r() * 6.28,
            })
          }
        }
        g.add(makeCrop(makeRapePlantGeometry(plot.id * 11 + 2, mature, 1), items, 0))
      } else {
        const items: CropItem[] = []
        for (const z of [-1.0, 0, 1.0]) {
          for (let x = -slot.w / 2 + 0.7; x <= slot.w / 2 - 0.6; x += 0.84) {
            items.push({
              x: x + (r() - 0.5) * 0.14, y: baseH + 0.01, z: z + (r() - 0.5) * 0.14,
              s: 0.9 + r() * 0.18, ry: r() * 6.28,
            })
          }
        }
        g.add(makeCrop(makeStrawberryGeometry(plot.id * 17 + 9, 1), items, 0))
      }

      if (plot.status === 2) addCrates(g, plot, slot, isBerry ? 0.38 : 0.16)
    } else {
      const items: CropItem[] = []
      const r = rng(plot.id * 23 + 4)
      for (let i = 0; i < 26; i++) {
        items.push({
          x: (r() - 0.5) * (slot.w - 0.7), y: baseH, z: (r() - 0.5) * (slot.d - 0.7),
          s: 0.7 + r() * 0.7, ry: r() * 6.28,
        })
      }
      g.add(makeCrop(makeWeedGeometry(plot.id * 5 + 1, 1), items, 0))
      const baleGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.82, 12)
      baleGeo.rotateZ(Math.PI / 2)
      const bale = new THREE.Mesh(baleGeo, new THREE.MeshStandardMaterial({ color: 0xc4a55d, roughness: 0.92 }))
      bale.position.set(-slot.w / 4, 0.45, slot.d / 3)
      bale.castShadow = true
      bale.receiveShadow = true
      g.add(bale)
    }

    // 预警提示
    if (plot.status === 4) {
      const alertMat = new THREE.SpriteMaterial({
        map: alertTexture, transparent: true, depthWrite: false, opacity: 0.95,
      })
      const sp = new THREE.Sprite(alertMat)
      sp.scale.set(0.95, 0.95, 1)
      const ay = plot.crop === 'grape' ? 2.7 : 2.15
      sp.position.set(-slot.w * 0.18, ay, 0)
      g.add(sp)
      plotObjs.push({
        plot, slot, selectRing, selectMat, ringMat,
        alertMat, alertSprite: sp, alertBaseY: ay,
      })
    } else {
      plotObjs.push({ plot, slot, selectRing, selectMat, ringMat })
    }
  })

  /* ------------------------------ 农舍（three-opt 视觉升级版） ------------------------------ */
  const homesteadGroup = new THREE.Group()
  homesteadGroup.position.set(-23.5, 0, -18)
  world.add(homesteadGroup)
  const homestead = buildHomestead({
    stone: stoneMat,
    plaster: plasterMat,
    brick: brickMat,
    wood: woodMat,
    darkWood,
    metal: metalMat,
    darkFrame,
    foliage: windFoliage,
  })
  homesteadGroup.add(homestead.group)
  const chickens = homestead.chickens

  /* ------------------------------ 温室 ------------------------------ */
  const gh = new THREE.Group()
  gh.position.set(-8.6, 0, -6)
  world.add(gh)
  const GW = 13.4
  const GD = 8.2
  const GH = 2.2
  const ridgeH = 3.55
  addBox(gh, stoneMat, GW + 0.9, 0.2, GD + 0.9, 0, 0.1, 0)
  addBox(gh, brickMat, GW, 0.46, 0.32, 0, 0.33, GD / 2)
  addBox(gh, brickMat, GW, 0.46, 0.32, 0, 0.33, -GD / 2)
  addBox(gh, brickMat, 0.32, 0.46, GD, -GW / 2, 0.33, 0)
  addBox(gh, brickMat, 0.32, 0.46, GD, GW / 2, 0.33, 0)

  const frameGeos: THREE.BufferGeometry[] = []
  const addFrameBar = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d)
    if (rx) g.rotateX(rx)
    g.translate(x, y, z)
    paintGeo(g, '#3f5147', 0.04)
    frameGeos.push(g)
  }
  for (let x = -GW / 2; x <= GW / 2 + 0.01; x += GW / 8) {
    for (const z of [-GD / 2, GD / 2]) addFrameBar(0.07, GH + 0.5, 0.07, x, 0.46 + (GH + 0.5) / 2, z)
    addFrameBar(0.06, 0.06, GD / 2 + 0.1, x, GH + 0.46, -GD / 4)
    addFrameBar(0.06, 0.06, GD / 2 + 0.1, x, GH + 0.46, GD / 4)
  }
  addFrameBar(GW + 0.1, 0.09, 0.09, 0, GH + 0.46, -GD / 2)
  addFrameBar(GW + 0.1, 0.09, 0.09, 0, GH + 0.46, GD / 2)
  addFrameBar(GW + 0.1, 0.08, 0.08, 0, ridgeH + 0.46, 0)
  const rafterAng = Math.atan2(ridgeH - GH, GD / 2)
  for (const dir of [-1, 1]) {
    addFrameBar(GW + 0.1, 0.07, 0.07, 0, (GH + ridgeH) / 2 + 0.46, (dir * GD) / 4, dir * rafterAng)
  }
  addMerged(gh, frameGeos, builtMat)

  // 玻璃
  for (const z of [-GD / 2, GD / 2]) {
    const wall = addBox(gh, glassMat, GW, GH, 0.03, 0, 0.46 + GH / 2, z, 0, false)
    wall.receiveShadow = false
  }
  for (const x of [-GW / 2, GW / 2]) {
    addBox(gh, glassMat, 0.03, GH, GD, x, 0.46 + GH / 2, 0, 0, false)
  }
  for (const dir of [-1, 1]) {
    const roofGlass = addBox(gh, glassMat, GW, 0.03, GD / 2 + 0.1, 0, (GH + ridgeH) / 2 + 0.46, (dir * GD) / 4, 0, false)
    roofGlass.rotation.x = dir * rafterAng
  }
  // 山墙玻璃
  const triShape = new THREE.Shape()
  triShape.moveTo(-GD / 2, 0)
  triShape.lineTo(GD / 2, 0)
  triShape.lineTo(0, ridgeH - GH)
  triShape.closePath()
  for (const dir of [-1, 1]) {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(triShape), glassMat)
    tri.position.set((dir * GW) / 2, GH + 0.46, 0)
    tri.rotation.y = (dir * Math.PI) / 2
    gh.add(tri)
  }

  // 门
  addBox(gh, darkFrame, 1.5, 1.9, 0.06, 0.6, 1.34, GD / 2 + 0.02)
  addBox(gh, glassMat, 1.32, 1.72, 0.03, 0.6, 1.34, GD / 2 + 0.06, 0, false)
  addCyl(gh, metalMat, 0.03, 0.03, 0.12, 1.12, 1.24, GD / 2 + 0.1, 6)

  // 三层水培架
  const gutterMat = new THREE.MeshStandardMaterial({ color: 0xd8d9ca, roughness: 0.55, metalness: 0.15 })
  const plantItems: { x: number; y: number; z: number; s: number; ry: number }[] = []
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const y = 0.78 + tier * 0.52
      const z = side * 2.55
      addBox(gh, gutterMat, 11.4, 0.13, 0.62, 0, y, z)
      addBox(gh, darkFrame, 11.2, 0.05, 0.06, 0, y - 0.07, z + side * 0.28)
      addBox(gh, darkFrame, 11.2, 0.05, 0.06, 0, y - 0.07, z - side * 0.28)
      for (const dir of [-1, 1]) {
        addCyl(gh, darkFrame, 0.03, 0.03, y, 0, y / 2, z + dir * 0.25, 6).position.x = dir * 5.6
      }
      const rr = rng(77 + side * 9 + tier * 3)
      for (let x = -5.2; x <= 5.2; x += 0.46) {
        plantItems.push({ x: x + (rr() - 0.5) * 0.1, y: y + 0.1, z: z + (rr() - 0.5) * 0.16, s: 0.5 + rr() * 0.12, ry: rr() * 6.28 })
      }
      // 补光灯
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x4e5b52, emissive: 0xffb27a, emissiveIntensity: 0.7, roughness: 0.5 })
      addBox(gh, lampMat, 9.4, 0.06, 0.14, 0, y + 0.42, z)
    }
  }
  const plantGeo = makeCabbageGeometry(31, 1)
  const plantMesh = new THREE.InstancedMesh(plantGeo, leafMat, plantItems.length)
  plantItems.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z)
    dummy.rotation.set(0, it.ry, 0)
    dummy.scale.setScalar(it.s)
    dummy.updateMatrix()
    plantMesh.setMatrixAt(i, dummy.matrix)
  })
  plantMesh.castShadow = true
  plantMesh.receiveShadow = true
  gh.add(plantMesh)

  // 风机
  const fans: THREE.Group[] = []
  for (const x of [-3.8, 3.8]) {
    const fan = new THREE.Group()
    fan.position.set(x, 1.85, -GD / 2 + 0.08)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 6, 24), darkFrame)
    fan.add(ring)
    const blades = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.025), whiteMetal)
      blade.rotation.z = (i / 4) * Math.PI * 2
      blade.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.23, Math.sin((i / 4) * Math.PI * 2) * 0.23, 0)
      blade.rotation.z += 0.4
      blades.add(blade)
    }
    addCyl(fan, darkFrame, 0.08, 0.08, 0.06, 0, 0, 0.03, 8).rotation.x = Math.PI / 2
    fan.add(blades)
    fans.push(blades)
    gh.add(fan)
  }
  // 山墙百叶
  for (let i = 0; i < 5; i++) addBox(gh, darkFrame, 2.2, 0.05, 0.05, -GW / 2 + 0.03, 1.0 + i * 0.22, -2.2, Math.PI / 2)

  // 水罐
  const tank = addCyl(world, new THREE.MeshStandardMaterial({ color: 0x6e97a6, roughness: 0.55, metalness: 0.3 }), 0.78, 0.82, 1.8, -0.2, 0.9, -3.0, 18)
  tank.castShadow = true
  addCyl(world, darkFrame, 0.8, 0.8, 0.08, -0.2, 1.84, -3.0, 18)
  addBox(world, darkFrame, 0.46, 0.42, 0.36, -0.85, 0.21, -2.1)
  addBox(world, metalMat, 0.5, 0.06, 0.4, -0.85, 0.45, -2.1)
  addCyl(world, metalMat, 0.045, 0.045, 0.55, -0.85, 0.32, -2.55, 6).rotation.x = Math.PI / 2
  addCyl(world, metalMat, 0.045, 0.045, 1.0, -1.35, 0.32, -2.1, 6).rotation.z = Math.PI / 2
  addCyl(world, metalMat, 0.045, 0.045, 0.62, -1.82, 0.62, -2.1, 6)

  // 温室铭牌
  const ghSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshStandardMaterial({ map: makeGreenhouseSign(), roughness: 0.8 }))
  ghSign.position.set(0, 2.78, GD / 2 + 0.06)
  gh.add(ghSign)
  addBox(gh, darkWood, 3.52, 0.72, 0.05, 0, 2.78, GD / 2 + 0.02)

  /* ------------------------------ 垂直农场塔 ------------------------------ */
  const towerGroup = new THREE.Group()
  world.add(towerGroup)
  const towerPad = addBox(towerGroup, stoneMat, 5.2, 0.18, 21.2, 14.8, 0.09, -1.4)
  towerPad.receiveShadow = true
  const trays: THREE.Group[] = []
  const ledMats: THREE.MeshStandardMaterial[] = []
  const towerZ = [-8.5, -1.5, 5.5]
  towerZ.forEach((tz, ti) => {
    const tower = new THREE.Group()
    tower.position.set(14.8, 0.18, tz)
    towerGroup.add(tower)
    addBox(tower, new THREE.MeshStandardMaterial({ color: 0xb9c0b3, roughness: 0.5, metalness: 0.3 }), 1.5, 0.95, 1.5, 0, 0.48, 0)
    addBox(tower, darkFrame, 1.3, 0.6, 0.05, 0, 0.55, 0.76)
    addBox(tower, new THREE.MeshStandardMaterial({ color: 0x9fd8b0, emissive: 0x3f8a5f, emissiveIntensity: 0.6 }), 0.9, 0.28, 0.02, 0, 0.56, 0.79, 0, false)
    addCyl(tower, whiteMetal, 0.15, 0.2, 6.3, 0, 4.1, 0, 12)
    addCyl(tower, metalMat, 0.22, 0.26, 0.1, 0, 7.28, 0, 12)
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0x9ad7ab, emissive: 0x59c67f, emissiveIntensity: 1.2 })
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), beaconMat)
    beacon.position.y = 7.42
    tower.add(beacon)

    const trayPlantGeo = (() => {
      const list: THREE.BufferGeometry[] = []
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const g = makeTrayPlantGeometry(ti * 7 + i + 3, 1.0)
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.98, 0.14, Math.sin(a) * 0.98))
        list.push(g)
      }
      return mergeAll(list)
    })()

    for (let i = 0; i < 6; i++) {
      const y = 1.55 + i * 0.82
      const tray = new THREE.Group()
      tray.position.y = y
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(1.28, 1.22, 0.13, 28),
        new THREE.MeshStandardMaterial({ color: 0x8d9c8c, roughness: 0.6, metalness: 0.25 }),
      )
      ring.castShadow = true
      ring.receiveShadow = true
      tray.add(ring)
      const plants = new THREE.Mesh(trayPlantGeo, leafMat)
      plants.castShadow = true
      tray.add(plants)
      const ledMat = new THREE.MeshStandardMaterial({ color: 0xbfe8c6, emissive: 0x8fe8a6, emissiveIntensity: 0.9 })
      const led = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.024, 5, 40), ledMat)
      led.rotation.x = Math.PI / 2
      led.position.y = 0.09
      tray.add(led)
      ledMats.push(ledMat)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.4
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.1), darkFrame)
        arm.position.set(Math.cos(a) * 0.6, -0.03, Math.sin(a) * 0.6)
        arm.rotation.y = -a
        tray.add(arm)
      }
      tower.add(tray)
      trays.push(tray)
    }
  })

  // 控制柜
  const cage = new THREE.Group()
  cage.position.set(11.1, 0, 9.4)
  towerGroup.add(cage)
  addBox(cage, new THREE.MeshStandardMaterial({ color: 0x6c7f74, roughness: 0.5, metalness: 0.45 }), 0.9, 1.25, 0.55, 0, 0.66, 0)
  addBox(cage, new THREE.MeshStandardMaterial({ color: 0x2d3a32, emissive: 0x4f9e72, emissiveIntensity: 0.35 }), 0.5, 0.34, 0.02, 0, 0.88, 0.28, 0, false)
  addBox(cage, darkFrame, 1.1, 0.08, 0.72, 0, 1.33, 0)

  /* ------------------------------ 工具棚 ------------------------------ */
  const utilityGroup = new THREE.Group()
  world.add(utilityGroup)
  const shed = new THREE.Group()
  shed.position.set(28.5, 0, -13)
  utilityGroup.add(shed)
  addBox(shed, stoneMat, 7, 0.16, 5.2, 0, 0.08, 0)
  for (const [x, z] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) addBox(shed, woodMat, 0.18, 2.6, 0.18, x, 1.3, z)
  addBox(shed, woodMat, 6.4, 2.4, 0.12, 0, 1.28, -2.4)
  addBox(shed, woodMat, 0.12, 2.4, 4.6, 3.35, 1.28, 0)
  const shedRoof = addBox(shed, roofMat, 7.5, 0.12, 5.8, 0, 2.85, 0)
  shedRoof.rotation.z = 0.05
  addBox(shed, darkWood, 7.5, 0.12, 0.14, 0, 2.68, 2.86)
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.05, 1.15),
      new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.32, metalness: 0.45 }),
    )
    p.position.set(-2.3 + i * 2.3, 3.04, -0.55)
    p.rotation.x = -0.22
    p.rotation.z = 0.05
    p.castShadow = true
    shed.add(p)
    const f = addBox(shed, metalMat, 2.34, 0.06, 1.26, -2.3 + i * 2.3, 2.97, -0.55)
    f.rotation.x = -0.22
  }
  // 棚内杂物
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.45, 0.55, 1, 0.05), woodMat)
    crate.position.set(-2.1 + (i % 3) * 0.75, 0.32 + Math.floor(i / 3) * 0.46, -1.2)
    crate.castShadow = true
    shed.add(crate)
  }
  for (let i = 0; i < 4; i++) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb9a67b, roughness: 0.95 }))
    sack.scale.set(1, 1.25, 0.85)
    sack.position.set(1.4 + (i % 2) * 0.6, 0.4 + Math.floor(i / 2) * 0.55, 0.2)
    sack.castShadow = true
    shed.add(sack)
  }
  addBox(shed, woodMat, 2.0, 0.1, 0.7, 0.7, 0.9, 0.9)
  for (let i = 0; i < 3; i++) addBox(shed, metalMat, 0.05, 0.45, 0.05, -0.1 + i * 0.24, 1.18, 0.9)

  // 草垛
  for (let i = 0; i < 3; i++) {
    const hay = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.25, 14),
      new THREE.MeshStandardMaterial({ color: 0xc3a35b, roughness: 0.94 }),
    )
    hay.rotation.z = Math.PI / 2
    hay.position.set(13.6 + i * 1.35, 0.56, -26.5)
    hay.castShadow = true
    hay.receiveShadow = true
    utilityGroup.add(hay)
    for (const off of [-0.35, 0.35]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.025, 4, 14), darkWood)
      ring.position.set(13.6 + i * 1.35 + off, 0.56, -26.5)
      ring.rotation.y = Math.PI / 2
      utilityGroup.add(ring)
    }
  }

  /* ------------------------------ 池塘 ------------------------------ */
  const waterGroup = new THREE.Group()
  world.add(waterGroup)
  const pond = new THREE.Group()
  pond.position.set(25.5, 0, 19.5)
  waterGroup.add(pond)
  const shape = new THREE.Shape()
  const shoreR = rng(77)
  const shorePts: [number, number][] = []
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    const rad = 4.9 + Math.sin(a * 3 + 1.1) * 0.45 + (shoreR() - 0.5) * 0.24
    shorePts.push([Math.cos(a) * rad, Math.sin(a) * rad])
  }
  shorePts.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)))
  shape.closePath()
  const waterGeo = new THREE.ShapeGeometry(shape, 40)
  waterGeo.rotateX(-Math.PI / 2)
  const mudGeo = waterGeo.clone()
  mudGeo.scale(1.13, 1, 1.17)
  const mud = new THREE.Mesh(mudGeo, new THREE.MeshStandardMaterial({ color: 0x6c5941, roughness: 0.98 }))
  mud.position.y = 0.015
  mud.receiveShadow = true
  pond.add(mud)
  const pondWater = new THREE.Mesh(waterGeo, waterPond)
  pondWater.position.y = 0.075
  pond.add(pondWater)
  waters.push(waterPond)

  // 岸边石
  const rockPositions = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0x8d8c80, roughness: 0.92 }),
    26,
  )
  const rr = rng(92)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rr() * 0.2
    const rad = 5.1 + rr() * 0.5
    const rx = Math.cos(a) * rad
    const rz = Math.sin(a) * rad
    const dockGap = rx < -2.9 && Math.abs(rz - 0.5) < 1.55
    dummy.position.set(dockGap ? 0 : rx, dockGap ? -3 : 0.08 + rr() * 0.1, dockGap ? 0 : rz)
    dummy.rotation.set(rr() * 3, rr() * 3, rr() * 3)
    dummy.scale.setScalar(dockGap ? 0.001 : 0.55 + rr() * 0.9)
    dummy.updateMatrix()
    rockPositions.setMatrixAt(i, dummy.matrix)
  }
  rockPositions.castShadow = true
  rockPositions.receiveShadow = true
  pond.add(rockPositions)

  // 芦苇
  const reedItems: { x: number; z: number; s: number; r: number }[] = []
  for (let tries = 0; tries < 260 && reedItems.length < 30; tries++) {
    const a = rr() * Math.PI * 2
    const rad = 4.5 + rr() * 0.7
    const rx = Math.cos(a) * rad
    const rz = Math.sin(a) * rad
    if (rx < -2.8 && Math.abs(rz - 0.5) < 1.7) continue
    reedItems.push({ x: rx, z: rz, s: 0.8 + rr() * 0.7, r: rr() * 6.28 })
  }
  const reeds = new THREE.InstancedMesh(makeReedGeometry(4, 1), windBlade, reedItems.length)
  reedItems.forEach((it, i) => {
    dummy.position.set(it.x, 0.05, it.z)
    dummy.rotation.set(0, it.r, 0)
    dummy.scale.setScalar(it.s)
    dummy.updateMatrix()
    reeds.setMatrixAt(i, dummy.matrix)
  })
  reeds.castShadow = true
  pond.add(reeds)

  // 荷叶与花
  const lotusList: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const a = rr() * Math.PI * 2
    const rad = 0.5 + rr() * 2.2
    const lx = Math.cos(a) * rad
    const lz = Math.sin(a) * rad
    if (lx < -2.35 && Math.abs(lz - 0.5) < 1.35) continue
    const pad = new THREE.CircleGeometry(0.22 + rr() * 0.18, 10)
    pad.rotateX(-Math.PI / 2)
    pad.translate(lx, 0.09, lz)
    paintGeo(pad, '#4d7a48', 0.08)
    lotusList.push(pad)
    if (i % 3 === 0) {
      const flower = new THREE.ConeGeometry(0.08, 0.14, 6)
      flower.translate(lx, 0.16, lz)
      paintGeo(flower, i % 2 ? '#e8a5ad' : '#f2c7c4', 0.05)
      lotusList.push(flower)
    }
  }
  addMerged(pond, lotusList, windFoliage)

  // 木栈道
  addBox(pond, woodMat, 3.0, 0.12, 1.25, -4.6, 0.24, 0.5)
  for (let i = 0; i < 5; i++) addBox(pond, darkWood, 0.08, 0.5, 1.3, -6.0 + i * 0.65, 0.0, 0.5)
  for (const z of [-0.1, 1.1]) addCyl(pond, darkWood, 0.07, 0.08, 0.9, -5.8, 0.45, z, 6)
  addBox(pond, darkWood, 3.0, 0.07, 0.07, -4.6, 0.9, -0.14)
  addBox(pond, darkWood, 3.0, 0.07, 0.07, -4.6, 0.9, 1.14)

  // 小船
  const boat = new THREE.Group()
  boat.position.set(-2.4, 0.12, 1.15)
  boat.rotation.y = -0.7
  waterGroup.add(boat)
  const hull = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.34, 0.6, 2, 0.12), woodMat)
  hull.position.y = 0.08
  hull.scale.set(1, 0.75, 1)
  hull.castShadow = true
  boat.add(hull)
  addBox(boat, darkWood, 1.0, 0.05, 0.44, 0, 0.19, 0)
  for (const sx of [-0.45, 0.4]) addBox(boat, darkWood, 0.06, 0.24, 0.58, sx, 0.08, 0)
  const paddle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.13), woodMat)
  paddle.position.set(0.2, 0.3, 0.05)
  paddle.rotation.y = 0.3
  boat.add(paddle)

  // 柳树
  const willow = new THREE.Mesh(makeWillowGeometry(3, 0.9), windFoliage)
  willow.position.set(18.6, 0, 14.8)
  willow.castShadow = true
  willow.receiveShadow = true
  waterGroup.add(willow)

  // 鸭子
  const ducks: { group: THREE.Group; phase: number; radius: number; speed: number }[] = []
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: i === 1 ? 0x8d7d61 : 0xf0ead8, roughness: 0.9 }))
    body.scale.set(1, 0.8, 1.35)
    body.position.y = 0.08
    d.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), body.material as THREE.Material)
    head.position.set(0, 0.22, 0.17)
    d.add(head)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0xd9a441 }))
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.2, 0.27)
    d.add(beak)
    waterGroup.add(d)
    ducks.push({ group: d, phase: i * 2.1, radius: 0.8 + i * 0.5, speed: 0.055 + i * 0.012 })
  }

  /* ------------------------------ 主题环境 ------------------------------ */
  const waterExtra = new THREE.Group()
  world.add(waterExtra)
  const solarYard = new THREE.Group()
  world.add(solarYard)

  if (theme === 'water') {
    // 水乡河道：与池塘东岸相接
    const canalShape = new THREE.Shape()
    const cw = 3.5
    const ch = 18.2
    canalShape.moveTo(-cw / 2 + 0.5, -ch)
    canalShape.lineTo(cw / 2 - 0.5, -ch)
    canalShape.quadraticCurveTo(cw / 2, -ch, cw / 2, -ch + 0.5)
    canalShape.lineTo(cw / 2, ch - 0.5)
    canalShape.quadraticCurveTo(cw / 2, ch, cw / 2 - 0.5, ch)
    canalShape.lineTo(-cw / 2 + 0.5, ch)
    canalShape.quadraticCurveTo(-cw / 2, ch, -cw / 2, ch - 0.5)
    canalShape.lineTo(-cw / 2, -ch + 0.5)
    canalShape.quadraticCurveTo(-cw / 2, -ch, -cw / 2 + 0.5, -ch)
    const canalGeo = new THREE.ShapeGeometry(canalShape, 24)
    canalGeo.rotateX(-Math.PI / 2)
    const canalMud = new THREE.Mesh(
      canalGeo.clone().scale(1.18, 1, 1.03),
      new THREE.MeshStandardMaterial({ color: 0x6c5941, roughness: 0.98 }),
    )
    canalMud.position.set(31, 0.018, -0.5)
    canalMud.receiveShadow = true
    waterExtra.add(canalMud)
    const canalMat = makeWaterMaterial('#4f8a80', 2.1, 0.9)
    const canalWater = new THREE.Mesh(canalGeo, canalMat)
    canalWater.position.set(31, 0.085, -0.5)
    waterExtra.add(canalWater)
    waters.push(canalMat)

    // 河岸石
    for (let z = -16; z <= 13; z += 2.15) {
      for (const dir of [-1, 1]) {
        const stone = addBox(waterExtra, stoneMat, 0.55, 0.22, 1.9, 31 + dir * 2.0, 0.11, z)
        stone.rotation.y = (dir * 0.05) + (z % 3) * 0.02
      }
    }

    // 河岸芦苇
    const canalReeds: { x: number; z: number; s: number; r: number }[] = []
    const cr = rng(133)
    for (let i = 0; i < 34; i++) {
      const z = -16.2 + cr() * 30.2
      if (Math.abs(z + 6) < 1.6 || Math.abs(z - 5) < 1.6) continue
      canalReeds.push({ x: 31 + (cr() > 0.5 ? 1 : -1) * (2.05 + cr() * 0.28), z, s: 0.75 + cr() * 0.55, r: cr() * 6.28 })
    }
    const canalReedMesh = new THREE.InstancedMesh(makeReedGeometry(6, 1), windBlade, canalReeds.length)
    canalReeds.forEach((it, i) => {
      dummy.position.set(it.x, 0.06, it.z)
      dummy.rotation.set(0, it.r, 0)
      dummy.scale.setScalar(it.s)
      dummy.updateMatrix()
      canalReedMesh.setMatrixAt(i, dummy.matrix)
    })
    canalReedMesh.castShadow = true
    waterExtra.add(canalReedMesh)

    // 水面睡莲
    const canalLotus: THREE.BufferGeometry[] = []
    for (let i = 0; i < 14; i++) {
      const pad = new THREE.CircleGeometry(0.16 + cr() * 0.14, 9)
      pad.rotateX(-Math.PI / 2)
      pad.translate(31 + (cr() - 0.5) * 2.3, 0.095, -16 + cr() * 30)
      paintGeo(pad, '#4d7a48', 0.07)
      canalLotus.push(pad)
    }
    addMerged(waterExtra, canalLotus, windFoliage)

    // 两座木桥
    for (const bz of [-6, 5]) {
      addBox(waterExtra, darkWood, 5.8, 0.14, 0.42, 31, 0.5, bz - 0.55)
      addBox(waterExtra, darkWood, 5.8, 0.14, 0.42, 31, 0.5, bz + 0.22)
      addBox(waterExtra, darkWood, 5.8, 0.14, 0.42, 31, 0.5, bz + 0.99)
      for (const bx of [-2.5, 0, 2.5]) {
        addCyl(waterExtra, woodMat, 0.06, 0.07, 0.55, 31 + bx, 0.28, bz + 0.2, 6)
        for (const dz of [-0.75, 1.05]) {
          addCyl(waterExtra, woodMat, 0.045, 0.05, 0.92, 31 + bx, 0.92, bz + dz, 6)
        }
      }
      addBox(waterExtra, woodMat, 5.8, 0.07, 0.07, 31, 1.3, bz - 0.75)
      addBox(waterExtra, woodMat, 5.8, 0.07, 0.07, 31, 1.3, bz + 1.05)
    }

    // 临水亭
    const pavilion = new THREE.Group()
    pavilion.position.set(26.7, 0, 3.4)
    waterExtra.add(pavilion)
    addBox(pavilion, stoneMat, 3.8, 0.22, 3.4, 0, 0.11, 0)
    for (const [px, pz] of [[-1.45, -1.25], [1.45, -1.25], [-1.45, 1.25], [1.45, 1.25]]) {
      addCyl(pavilion, darkWood, 0.09, 0.11, 2.15, px, 1.2, pz, 8)
    }
    addBox(pavilion, darkWood, 3.2, 0.12, 2.8, 0, 2.28, 0)
    const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(3.05, 1.15, 4), roofMat)
    pavRoof.position.y = 2.95
    pavRoof.rotation.y = Math.PI / 4
    pavRoof.castShadow = true
    pavilion.add(pavRoof)
    addCyl(pavilion, darkWood, 0.05, 0.07, 0.5, 0, 3.7, 0, 6)
    addBox(pavilion, woodMat, 2.1, 0.09, 0.48, 0, 0.55, 0.85)
    addBox(pavilion, woodMat, 0.09, 0.42, 0.4, -0.95, 0.34, 0.85)
    addBox(pavilion, woodMat, 0.09, 0.42, 0.4, 0.95, 0.34, 0.85)

    // 东岸亲水木台
    addBox(waterExtra, darkWood, 2.4, 0.12, 1.5, 30.2, 0.24, 19.8)
    for (const [dx, dz] of [[-1.0, -0.6], [1.0, -0.6], [-1.0, 0.6], [1.0, 0.6]]) {
      addCyl(waterExtra, woodMat, 0.06, 0.07, 0.55, 30.2 + dx, 0.28, 19.8 + dz, 6)
    }
    addBox(waterExtra, woodMat, 2.4, 0.06, 0.06, 30.2, 0.72, 19.1)

    // 第二株垂柳
    const willow2 = new THREE.Mesh(makeWillowGeometry(7, 0.85), windFoliage)
    willow2.position.set(34.9, 0, 18.1)
    willow2.castShadow = true
    willow2.receiveShadow = true
    waterExtra.add(willow2)
  }

  if (theme === 'tower') {
    // 集控场坪 + 光伏阵列
    const yardMat = new THREE.MeshStandardMaterial({ color: 0xb8b3a5, roughness: 0.92 })
    addBox(solarYard, yardMat, 13.6, 0.12, 22.0, 26.4, 0.06, -1.2)
    const panelMat = new THREE.MeshStandardMaterial({
      map: makeSolarTexture(), roughness: 0.34, metalness: 0.42,
      emissive: 0x1b3550, emissiveIntensity: 0.4,
    })
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4d9d2, roughness: 0.4, metalness: 0.55 })
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const px = 21.2 + col * 2.95
        const pz = -7.2 + row * 5.2
        addCyl(solarYard, frameMat, 0.05, 0.06, 0.78, px - 0.82, 0.39, pz + 0.18, 5)
        addCyl(solarYard, frameMat, 0.05, 0.06, 0.94, px + 0.82, 0.47, pz - 0.18, 5)
        const panel = addBox(solarYard, panelMat, 2.35, 0.07, 1.42, px, 1.0, pz)
        panel.rotation.x = 0.5
        addBox(solarYard, frameMat, 2.42, 0.05, 1.5, px, 0.92, pz).rotation.x = 0.5
      }
    }
    const essMat = new THREE.MeshStandardMaterial({ color: 0xd8dcd2, roughness: 0.55, metalness: 0.25 })
    for (let i = 0; i < 3; i++) {
      addBox(solarYard, essMat, 0.95, 0.95, 0.6, 32.0, 0.54, -7.0 + i * 1.05)
      addBox(solarYard, darkFrame, 0.8, 0.16, 0.02, 32.0, 0.68, -7.0 + i * 1.05 + 0.31)
    }
    addBox(solarYard, stoneMat, 5.2, 0.16, 4.6, 21.3, 0.08, -10.4)
    addBox(solarYard, new THREE.MeshStandardMaterial({ color: 0x71827a, roughness: 0.5, metalness: 0.4 }), 3.8, 2.1, 3.4, 21.3, 1.13, -10.4)
    addBox(solarYard, roofMat, 4.2, 0.12, 3.8, 21.3, 2.25, -10.4)
    addBox(solarYard, new THREE.MeshStandardMaterial({ color: 0x2d3a32, emissive: 0x4b9c72, emissiveIntensity: 0.35 }), 1.3, 0.5, 0.03, 21.3, 1.55, -8.68)
  }

  /* ------------------------------ 大门 ------------------------------ */
  const gate = new THREE.Group()
  gate.position.set(0, 0, 33)
  world.add(gate)
  for (const x of [-2.4, 2.4]) {
    addBox(gate, stoneMat, 0.85, 2.2, 0.85, x, 1.1, 0)
    addBox(gate, stoneMat, 1.06, 0.14, 1.06, x, 2.27, 0)
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.32, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xd0a25c, emissive: 0xffb262, emissiveIntensity: 0.42, roughness: 0.6 }),
    )
    lamp.position.set(x, 1.9, 0.55)
    gate.add(lamp)
  }
  addBox(gate, woodMat, 5.9, 0.3, 0.36, 0, 2.52, 0)
  const gateRoof = addBox(gate, roofMat, 6.6, 0.12, 1.05, 0, 2.76, 0)
  gateRoof.castShadow = true
  addCyl(gate, metalMat, 0.07, 0.07, 6.6, 0, 2.86, 0, 8).rotation.z = Math.PI / 2
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 1.2),
    new THREE.MeshStandardMaterial({ map: makeGateTexture(), roughness: 0.82 }),
  )
  gateSign.position.set(0, 2.08, 0.2)
  gate.add(gateSign)

  // 门两侧矮墙
  for (const dir of [-1, 1]) {
    addBox(world, stoneMat, 5.6, 0.85, 0.34, dir * 5.8, 0.42, 33)
    addBox(world, stoneMat, 5.66, 0.09, 0.44, dir * 5.8, 0.89, 33)
    for (let i = 0; i < 5; i++) {
      const bx = dir * (8.8 + i * 1.1)
      addCyl(world, woodMat, 0.05, 0.06, 0.75, bx, 0.38, 33, 6)
      addBox(world, woodMat, 1.12, 0.05, 0.05, bx + dir * 0.56, 0.62, 33)
      addBox(world, woodMat, 1.12, 0.05, 0.05, bx + dir * 0.56, 0.36, 33)
    }
  }

  // 建筑拾取代理：整栋建筑可点击定位（挂在各自分组下，随主题显隐）
  const addFacilityPick = (
    parent: THREE.Object3D,
    id: ParkFacilityId,
    size: [number, number, number],
    pos: [number, number, number],
  ) => {
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    proxy.position.set(pos[0], pos[1], pos[2])
    proxy.userData.facilityId = id
    parent.add(proxy)
    pickables.push(proxy)
  }
  addFacilityPick(gh, 'greenhouse', [14.4, 4.6, 9.2], [0, 2.3, 0])
  addFacilityPick(towerGroup, 'tower', [5.2, 8.4, 22.0], [14.8, 4.2, -1.4])
  addFacilityPick(homesteadGroup, 'homestead', [11.8, 5.2, 8.6], [0, 2.6, 0])
  addFacilityPick(utilityGroup, 'shed', [7.8, 3.4, 6.0], [28.5, 1.7, -13])
  addFacilityPick(waterGroup, 'pond', [11.6, 0.6, 11.6], [25.5, 0.28, 19.5])
  addFacilityPick(solarYard, 'solar', [14.4, 2.4, 22.4], [26.4, 1.2, -1.2])
  addFacilityPick(gate, 'gate', [7.2, 3.2, 1.8], [0, 1.6, 0])

  // 指路牌
  const post = new THREE.Group()
  post.position.set(3.5, 0, 31.2)
  world.add(post)
  addCyl(post, woodMat, 0.07, 0.08, 2.1, 0, 1.05, 0, 7)
  const arrows: [string, number][] = [['温室 →', 1.72], ['大田 →', 1.44], ['垂直农场 →', 1.16]]
  arrows.forEach(([txt, y]) => {
    const tex = canvasTex(256, 48, ctx => {
      ctx.fillStyle = '#e9dfc4'
      ctx.fillRect(0, 0, 256, 48)
      ctx.fillStyle = '#4c5e46'
      ctx.font = '500 24px "Microsoft YaHei", sans-serif'
      ctx.fillText(txt, 16, 33)
    })
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.21), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }))
    b.position.set(0.5, y, 0.06)
    post.add(b)
    addBox(post, woodMat, 1.18, 0.24, 0.05, 0.5, y, 0.02)
  })

  /* ------------------------------ 树木与灌木 ------------------------------ */
  const treeSpots = TREE_SPOTS[theme]
  const broadGeos = [makeBroadleafGeometry(21, 1), makeBroadleafGeometry(33, 1), makeBroadleafGeometry(45, 1)]
  const cypressGeo = makeCypressGeometry(24, 1)
  const broadSpots = treeSpots.filter(t => t.type === 'broad')
  const cypressSpots = treeSpots.filter(t => t.type === 'cypress')
  const makeTreeInstances = (geo: THREE.BufferGeometry, spots: typeof treeSpots) => {
    const mesh = new THREE.InstancedMesh(geo, windFoliage, spots.length)
    spots.forEach((sp, i) => {
      dummy.position.set(sp.x, 0, sp.z)
      dummy.rotation.set(0, sp.seed * 1.7, 0)
      dummy.scale.setScalar(sp.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const tone = 0.9 + ((sp.seed * 37) % 10) / 60
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.01, tone * 0.95))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    world.add(mesh)
  }
  broadGeos.forEach((geo, v) => {
    const spots = broadSpots.filter((_, i) => i % broadGeos.length === v)
    if (spots.length) makeTreeInstances(geo, spots)
  })
  makeTreeInstances(cypressGeo, cypressSpots)

  // 竹林
  for (const [x, z, s] of [[-33, -13.5, 1], [-35.2, -10, 0.85]] as [number, number, number][]) {
    const bamboo = new THREE.Mesh(makeBambooGeometry(x + z, s), windFoliage)
    bamboo.position.set(x, 0, z)
    bamboo.castShadow = true
    bamboo.receiveShadow = true
    world.add(bamboo)
  }

  // 果树林
  const fruitSpots: [number, number, number][] = [
    [12.5, -17.5, 1], [16.2, -21.5, 0.92], [20.4, -17.8, 1.05], [24.0, -22.5, 0.9], [19.0, -25.5, 0.96],
  ]
  fruitSpots.forEach(([x, z, s], i) => {
    const tree = new THREE.Mesh(makeFruitTreeGeometry(51 + i, s, i % 2 ? '#d97b33' : '#c9563f'), windFoliage)
    tree.position.set(x, 0, z)
    tree.castShadow = true
    tree.receiveShadow = true
    world.add(tree)
  })

  // 蜂箱
  for (let i = 0; i < 2; i++) {
    const hive = new THREE.Group()
    hive.position.set(24.5, 0, -17.2 + i * 1.25)
    utilityGroup.add(hive)
    addBox(hive, darkWood, 0.6, 0.7, 0.5, 0, 0.35, 0)
    addBox(hive, woodMat, 0.7, 0.06, 0.6, 0, 0.73, 0)
    addBox(hive, darkFrame, 0.28, 0.05, 0.02, 0, 0.2, 0.26)
  }

  // 灌木（两种造型交替，避免一片同款）
  const bushSpots = BUSH_SPOTS[theme]
  const bushGeos = [makeBushGeometry(61, 1), makeBushGeometry(67, 1)]
  bushGeos.forEach((geo, v) => {
    const spots = bushSpots.filter((_, i) => i % bushGeos.length === v)
    const bushes = new THREE.InstancedMesh(geo, windFoliage, spots.length)
    spots.forEach(([x, z, s, seed], i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, seed * 1.3, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      bushes.setMatrixAt(i, dummy.matrix)
      bushes.setColorAt(i, new THREE.Color(0.94 + (seed % 5) * 0.03, 1, 0.94))
    })
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true
    bushes.castShadow = true
    bushes.receiveShadow = true
    world.add(bushes)
  })

  // 后山林带：近景密、远景轻，冠层互相咬合；不写入阴影贴图，靠树下接触阴影落地
  const forestBroadSpots = FOREST_SPOTS.filter(sp => !sp.cypress)
  const forestFrontSpots = forestBroadSpots.filter(sp => sp.z >= -24)
  const forestBackSpots = forestBroadSpots.filter(sp => sp.z < -24)
  const addForestTrees = (geos: THREE.BufferGeometry[], spots: ForestSpot[]) => {
    geos.forEach((geo, v) => {
      const part = spots.filter((_, i) => i % geos.length === v)
      if (!part.length) return
      const mesh = new THREE.InstancedMesh(geo, windFoliage, part.length)
      part.forEach((sp, i) => {
        dummy.position.set(sp.x, 0, sp.z)
        dummy.rotation.set(0, sp.seed * 1.31, 0)
        const tall = sp.seed % 8 === 0 ? 1.16 : 1
        const sy = sp.s * tall * (0.94 + ((sp.seed * 17) % 9) / 90)
        dummy.scale.set(sp.s * tall, sy, sp.s * tall)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        const tone = 0.92 + ((sp.seed * 29) % 10) / 110
        mesh.setColorAt(i, new THREE.Color(tone, tone, tone))
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      world.add(mesh)
    })
  }
  addForestTrees([makeBroadleafGeometry(71, 1), makeBroadleafGeometry(83, 1)], forestFrontSpots)
  addForestTrees([makeBroadleafGeometry(97, 1, 0.8), makeBroadleafGeometry(113, 1, 0.85)], forestBackSpots)
  // 林带里的柏树点缀，拉出垂直层次
  const forestCypressSpots = FOREST_SPOTS.filter(sp => sp.cypress)
  if (forestCypressSpots.length) {
    const mesh = new THREE.InstancedMesh(cypressGeo, windFoliage, forestCypressSpots.length)
    forestCypressSpots.forEach((sp, i) => {
      dummy.position.set(sp.x, 0, sp.z)
      dummy.rotation.set(0, sp.seed * 1.13, 0)
      dummy.scale.setScalar(sp.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const tone = 0.88 + ((sp.seed * 23) % 10) / 80
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.01, tone * 0.94))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    world.add(mesh)
  }
  // 林下幼树：撑起中层，避免只有大树和地面
  if (FOREST_SAPLINGS.length) {
    const mesh = new THREE.InstancedMesh(makeBroadleafGeometry(131, 1, 0.62), windFoliage, FOREST_SAPLINGS.length)
    FOREST_SAPLINGS.forEach(([x, z, s, seed], i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, seed * 1.9, 0)
      dummy.scale.set(s, s * (0.9 + (seed % 7) * 0.03), s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const tone = 0.82 + (seed % 6) * 0.03
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.04, tone * 0.9))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    world.add(mesh)
  }
  // 林缘与林下灌木
  if (FOREST_SHRUBS.length) {
    const mesh = new THREE.InstancedMesh(makeBushGeometry(107, 1, 0.48), windFoliage, FOREST_SHRUBS.length)
    FOREST_SHRUBS.forEach(([x, z, s, seed], i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, seed * 1.7, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const tone = 0.88 + (seed % 4) * 0.035
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.02, tone * 0.94))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    world.add(mesh)
  }
  // 林地草蕨：让林下不是一块光地
  const forestTuftSpots: [number, number, number, number][] = (() => {
    const r = rng(1901)
    const out: [number, number, number, number][] = []
    for (let i = 0; i < 1400 && out.length < 170; i++) {
      const x = -24 + r() * 56
      const z = -35 + r() * 18.5
      if (Math.hypot(x, z) > 35) continue
      if (Math.abs(x + 23.5) < 6.6 && Math.abs(z + 18) < 6.2) continue
      if (Math.abs(x + 8.6) < 8.2 && Math.abs(z + 6) < 5.6) continue
      if (Math.abs(x - 28.5) < 5.6 && Math.abs(z + 13) < 4.6) continue
      if (Math.abs(x - 14.8) < 4.2 && Math.abs(z + 1.4) < 12.4) continue
      if (Math.abs(x - 29.4) < 4.2 && z > -19.6) continue
      if (FOREST_SPOTS.some(sp => Math.hypot(x - sp.x, z - sp.z) < 0.85)) continue
      out.push([x, z, 0.72 + r() * 0.62, Math.floor(r() * 997) + 1])
    }
    return out
  })()
  // 林间石块与倒木
  const forestRocks: [number, number, number][] = (() => {
    const r = rng(2113)
    const out: [number, number, number][] = []
    for (let i = 0; i < 600 && out.length < 14; i++) {
      const x = -22 + r() * 52
      const z = -34 + r() * 15
      if (Math.hypot(x, z) > 35) continue
      if (FOREST_SPOTS.some(sp => Math.hypot(x - sp.x, z - sp.z) < 1.0)) continue
      out.push([x, z, 0.4 + r() * 0.5])
    }
    return out
  })()
  if (forestRocks.length) {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8c7e, roughness: 0.95, vertexColors: true })
    const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.32, 0), rockMat, forestRocks.length)
    forestRocks.forEach(([x, z, s], i) => {
      dummy.position.set(x, 0.08 * s, z)
      dummy.rotation.set(s * 2.1, s * 5.3, s * 1.4)
      dummy.scale.set(s, s * 0.62, s * 0.85)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const tone = 0.82 + ((i * 37) % 10) / 60
      mesh.setColorAt(i, new THREE.Color(tone, tone * 1.01, tone * 0.9))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    world.add(mesh)
  }
  {
    const clearLog = (ax: number, az: number) => {
      for (let i = 0; i < 80; i++) {
        const a = i * 1.7
        const r = 0.5 + i * 0.16
        const x = ax + Math.cos(a) * r
        const z = az + Math.sin(a) * r
        if (!FOREST_SPOTS.some(sp => Math.hypot(x - sp.x, z - sp.z) < 1.5)) return [x, z] as const
      }
      return [ax, az] as const
    }
    const logGeos: THREE.BufferGeometry[] = []
    const logSpots: [number, number, number, number][] = [[3, -26, 3.2, 0.5], [-8, -23, 2.6, -0.4], [16, -29, 2.9, 1.05]]
    logSpots.forEach(([ax, az, len, rot], i) => {
      const [x, z] = clearLog(ax, az)
      const g = new THREE.CylinderGeometry(0.15, 0.19, len, 8, 1)
      g.rotateZ(Math.PI / 2)
      g.rotateY(rot)
      g.translate(x, 0.17, z)
      paintGeo(g, i % 2 ? '#5c4a35' : '#65513a', 0.08)
      logGeos.push(g)
    })
    const logs = new THREE.Mesh(mergeAll(logGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }))
    logs.castShadow = false
    logs.receiveShadow = true
    world.add(logs)
  }

  // 树冠接触阴影（three-opt）：树与灌木脚下的柔光暗斑，让植被"落地"
  addCanopyShadows(world, [
    ...treeSpots.map(t => ({ x: t.x, z: t.z, s: t.s })),
    ...fruitSpots.map(([x, z, s]) => ({ x, z, s })),
    ...FOREST_SPOTS.map(t => ({ x: t.x, z: t.z, s: t.s })),
    ...FOREST_SAPLINGS.map(([x, z, s]) => ({ x, z, s: s * 0.75 })),
    ...[[-33, -13.5, 1], [-35.2, -10, 0.85]].map(([x, z, s]) => ({ x, z, s })),
  ], 1.5, 0.5)
  addCanopyShadows(world, [...bushSpots, ...FOREST_SHRUBS].map(([x, z, s]) => ({ x, z, s })), 0.95, 0.32)

  // 草丛：沿园路两侧和草坪成簇撒布，避让田块、水体、建筑与车辆路线
  const grassRand = rng(913)
  const cropRects = Object.values(SLOTS).flat()
  const distToPath = (x: number, z: number, pts: [number, number][], closed: boolean) => {
    let best = Infinity
    const n = closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % pts.length]
      const vx = bx - ax
      const vz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / Math.max(1e-4, vx * vx + vz * vz)))
      best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)))
    }
    return best
  }
  const grassGeos = [makeGrassTuftGeometry(311, 1, 0), makeGrassTuftGeometry(317, 1, 1), makeGrassTuftGeometry(323, 1, 2)]
  const grassRadii = grassGeos.map(geo => {
    const pos = geo.getAttribute('position')
    let radius = 0
    for (let i = 0; i < pos.count; i++) radius = Math.max(radius, Math.hypot(pos.getX(i), pos.getZ(i)))
    // 包含风动最大水平位移，避免静止时合格、摆动时伸入路面。
    return radius + Math.hypot(0.05, 0.04)
  })
  const grassBlocked = (x: number, z: number, radius: number) => {
    if (Math.hypot(x, z) + radius > 36.2) return true
    if (cropRects.some(s => Math.abs(x - s.x) < s.w / 2 + 0.15 + radius && Math.abs(z - s.z) < s.d / 2 + 0.15 + radius)) return true
    if (Math.hypot(x - 25.5, z - 19.5) < 6.25 + radius) return true
    if (Math.abs(x + 8.6) < 7.4 + radius && Math.abs(z + 6) < 4.9 + radius) return true
    if (Math.abs(x + 23.5) < 5.4 + radius && Math.abs(z + 18) < 5.0 + radius) return true
    if (Math.abs(x - 14.8) < 3.7 + radius && Math.abs(z + 1.4) < 11.7 + radius) return true
    if (Math.abs(x - 28.5) < 4.4 + radius && Math.abs(z + 13) < 3.5 + radius) return true
    if (Math.abs(x - 15.2) < 3.4 + radius && Math.abs(z + 26.5) < 2.1 + radius) return true
    if (Math.abs(z - 33) < 1.3 + radius) return true
    if (Math.abs(x - 20.9) < 1.5 + radius && Math.abs(z - 20) < 0.7 + radius) return true
    if (theme === 'homestead' && Math.abs(x + 23.5) < 5.6 + radius && Math.abs(z + 11.3) < 2.8 + radius) return true
    if (theme === 'water' && Math.abs(x - 26.7) < 1.9 + radius && Math.abs(z - 3.4) < 1.7 + radius) return true
    if (theme === 'water' && Math.abs(x - 31) < 3.5 + radius && [-6, 5].some(bz => Math.abs(z - bz - 0.15) < 1 + radius)) return true
    if (theme === 'tower' && Math.abs(x - 26.4) < 7.8 + radius && Math.abs(z + 1.2) < 12.0 + radius) return true
    if (theme === 'water' && Math.abs(x - 31) < 3.0 + radius && Math.abs(z + 0.5) < 18.8 + radius) return true
    if (ROADS.some(road => distToPath(x, z, road.pts, false) < road.w / 2 + radius + 0.08)) return true
    if (distToPath(x, z, ROBOT_ROUTE, true) < 0.62 + radius) return true
    if (distToPath(x, z, CART_ROUTE, true) < 0.62 + radius) return true
    return false
  }
  type GrassItem = { x: number; z: number; s: number; r: number; tone: number; v: 0 | 1 | 2 }
  const grassItems: GrassItem[] = []
  const addGrass = (x: number, z: number, sMin: number, sMax: number, v: 0 | 1 | 2) => {
    const s = sMin + grassRand() * (sMax - sMin)
    if (grassBlocked(x, z, grassRadii[v] * s)) return
    grassItems.push({ x, z, v, s, r: grassRand() * Math.PI * 2, tone: 0.86 + grassRand() * 0.24 })
  }
  forestTuftSpots.forEach(([x, z, s, seed], i) => {
    const v = i % 2 === 0 ? 1 : 0
    if (!grassBlocked(x, z, grassRadii[v] * s)) {
      grassItems.push({ x, z, s, v, r: seed * 1.7, tone: 0.82 + (seed % 7) * 0.03 })
    }
  })
  const addClump = (x: number, z: number, sMin: number, sMax: number, tall = 0.3) => {
    const mainV: 0 | 1 | 2 = grassRand() < tall ? 1 : 0
    addGrass(x, z, sMin, sMax, mainV)
    const n = 1 + Math.floor(grassRand() * 2)
    for (let i = 0; i < n; i++) {
      const a = grassRand() * Math.PI * 2
      const d = 0.22 + grassRand() * 0.3
      const v: 0 | 1 | 2 = grassRand() < 0.55 ? 2 : 0
      addGrass(x + Math.cos(a) * d, z + Math.sin(a) * d, sMin * 0.75, sMax * 0.8, v)
    }
  }
  ROADS.forEach(road => {
    const pts = road.pts
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 0.001) continue
      const nx = -(bz - az) / len
      const nz = (bx - ax) / len
      const steps = Math.max(2, Math.round(len / 1.5))
      for (let k = 0; k < steps; k++) {
        const t = (k + grassRand() * 0.8) / steps
        for (const dir of [-1, 1]) {
          if (grassRand() > 0.62) continue
          const off = road.w / 2 + 0.6 + grassRand() * 0.65
          addClump(ax + (bx - ax) * t + nx * dir * off, az + (bz - az) * t + nz * dir * off, 0.75, 1.15, 0.38)
        }
      }
    }
  })
  for (let i = 0; i < 70; i++) {
    const a = grassRand() * Math.PI * 2
    const rad = 6 + Math.pow(grassRand(), 0.75) * 29
    addClump(Math.cos(a) * rad, Math.sin(a) * rad, 0.65, 1.1, 0.25)
  }
  // 池塘外圈：高草拱形丛为主
  for (let i = 0; i < 34; i++) {
    const a = grassRand() * Math.PI * 2
    const gx = 25.5 + Math.cos(a) * (6.3 + grassRand() * 0.8)
    const gz = 19.5 + Math.sin(a) * (6.3 + grassRand() * 0.8)
    if (gx < 23.4 && Math.abs(gz - 20) < 1.6) continue
    addClump(gx, gz, 0.7, 1.1, 0.6)
  }
  if (theme === 'water') {
    for (let i = 0; i < 36; i++) {
      const z = -16.5 + grassRand() * 30.5
      const dir = grassRand() > 0.5 ? 1 : -1
      addClump(31 + dir * (3.05 + grassRand() * 0.7), z, 0.65, 1.0, 0.5)
    }
  }
  const grassMat = createWindBladeMaterial({ amplitude: 0.05, maxHeight: 0.6, roughness: 0.88 })
  grassGeos.forEach((geo, v) => {
    const part = grassItems.filter(it => it.v === v)
    if (!part.length) {
      geo.dispose()
      return
    }
    const mesh = new THREE.InstancedMesh(geo, grassMat, part.length)
    mesh.name = `park-grass-${v}`
    part.forEach((it, i) => {
      dummy.position.set(it.x, 0.005, it.z)
      dummy.rotation.set(0, it.r, 0)
      dummy.scale.set(it.s, it.s * (0.9 + (it.tone - 0.86) * 0.6), it.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, new THREE.Color(it.tone, it.tone * 1.02, it.tone * 0.95))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    world.add(mesh)
  })

  // 花丛
  const flowerSpots: [number, number, string][] = [
    [-25.6, -7.6, '#e9e4d0'], [-20.6, -7.7, '#e4a3a3'], [2.0, 30.1, '#e8c95b'], [-2.2, 30.0, '#e9e4d0'],
    [-6.2, -1.2, '#d6a2c4'], [-11.0, -0.6, '#e9e4d0'], [9.8, 28.0, '#e4a3a3'], [-28.9, -7.9, '#e8c95b'],
  ]
  const flowerGeo = makeFlowerGeometry(71, '#efe8cf', 1)
  flowerSpots.forEach(([x, z, color], i) => {
    const f = new THREE.Mesh(flowerGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    f.position.set(x, 0, z)
    f.rotation.y = i * 0.7
    f.castShadow = true
    world.add(f)
  })

  // 稻草人
  const scare = new THREE.Group()
  scare.position.set(-13.1, 0, 28.0)
  world.add(scare)
  addCyl(scare, darkWood, 0.05, 0.06, 2.0, 0, 1.0, 0, 7)
  addBox(scare, darkWood, 1.45, 0.06, 0.06, 0, 1.45, 0)
  const shirt = addBox(scare, new THREE.MeshStandardMaterial({ color: 0x8d6f4c, roughness: 0.93 }), 0.62, 0.62, 0.3, 0, 1.26, 0)
  shirt.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8c69b, roughness: 0.95 }))
  head.position.y = 1.73
  head.castShadow = true
  scare.add(head)
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xc3a35b, roughness: 0.95 }))
  hat.position.y = 1.94
  hat.castShadow = true
  scare.add(hat)
  for (const sx of [-0.62, 0.62]) addCyl(scare, new THREE.MeshStandardMaterial({ color: 0xb99a63 }), 0.03, 0.03, 0.3, sx, 1.42, 0, 5)

  // 手推车
  const cart = new THREE.Group()
  cart.position.set(4.0, 0, -0.8)
  cart.rotation.y = 0.65
  world.add(cart)
  const cartFloorY = 0.55
  addBox(cart, woodMat, 1.35, 0.1, 0.75, 0, cartFloorY, 0)
  for (const sz of [-0.345, 0.345]) {
    addBox(cart, woodMat, 1.35, 0.32, 0.06, 0, cartFloorY + 0.21, sz)
  }
  for (const sx of [-0.645, 0.645]) {
    addBox(cart, woodMat, 0.06, 0.32, 0.75, sx, cartFloorY + 0.21, 0)
  }
  for (const sz of [-0.2, 0.2]) {
    addBox(cart, darkWood, 1.24, 0.06, 0.07, 0, cartFloorY - 0.06, sz)
  }
  addCyl(cart, metalMat, 0.02, 0.02, 1.52, 0, 0.3, -0.05, 8).rotation.z = Math.PI / 2
  for (const sx of [-0.76, 0.76]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 16), darkFrame)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(sx, 0.3, -0.05)
    wheel.castShadow = true
    cart.add(wheel)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 8), metalMat)
    hub.rotation.z = Math.PI / 2
    hub.position.set(sx, 0.3, -0.05)
    cart.add(hub)
  }
  for (const sx of [-0.5, 0.5]) {
    addBox(cart, darkWood, 0.075, 0.5, 0.075, sx, 0.25, 0.28)
  }
  for (const sx of [-0.48, 0.48]) {
    addBox(cart, darkFrame, 0.12, 0.14, 0.05, sx, 0.66, 0.375)
    const shaft = new THREE.Group()
    shaft.position.set(sx, 0.66, 0.39)
    shaft.rotation.x = -0.22
    cart.add(shaft)
    addBox(shaft, woodMat, 0.06, 0.06, 1.18, 0, 0, 0.59)
    addCyl(shaft, darkFrame, 0.028, 0.028, 0.2, 0, 0, 1.19, 6).rotation.z = Math.PI / 2
  }
  const cartLoad = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6f8f63, roughness: 0.92 }),
  )
  cartLoad.scale.set(1.4, 0.85, 1.1)
  cartLoad.position.set(-0.12, cartFloorY + 0.28, 0)
  cartLoad.castShadow = true
  cart.add(cartLoad)

  // 路灯
  for (const z of [10, 17.5, 25]) {
    const lp = new THREE.Group()
    lp.position.set(2.2, 0, z)
    world.add(lp)
    addCyl(lp, darkFrame, 0.055, 0.07, 2.25, 0, 1.12, 0, 7)
    addBox(lp, darkFrame, 0.7, 0.05, 0.05, -0.32, 2.24, 0)
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.24, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xffe3ae, emissive: 0xffc46a, emissiveIntensity: 0.5, roughness: 0.5 }),
    )
    lamp.position.set(-0.62, 2.12, 0)
    lp.add(lamp)
  }

  // 风机
  const turbine = new THREE.Group()
  turbine.position.set(32.5, 0, -19.5)
  utilityGroup.add(turbine)
  addCyl(turbine, stoneMat, 0.8, 0.98, 0.46, 0, 0.23, 0, 14)
  addCyl(turbine, whiteMetal, 0.17, 0.3, 9.2, 0, 4.85, 0, 12)
  addBox(turbine, whiteMetal, 0.66, 0.52, 1.55, 0, 9.62, -0.05)
  addBox(turbine, darkFrame, 0.5, 0.06, 1.0, 0, 9.9, -0.12)
  const rotor = new THREE.Group()
  rotor.position.set(0, 9.66, 0.78)
  turbine.add(rotor)
  addCyl(rotor, whiteMetal, 0.19, 0.24, 0.3, 0, 0, 0.02, 14).rotation.x = Math.PI / 2
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.44, 14), whiteMetal)
  spinner.rotation.x = Math.PI / 2
  spinner.position.z = 0.3
  spinner.castShadow = true
  rotor.add(spinner)
  const bladeShape = new THREE.Shape()
  bladeShape.moveTo(-0.11, 0)
  bladeShape.lineTo(0.11, 0)
  bladeShape.lineTo(0.085, 1.1)
  bladeShape.lineTo(0.05, 2.6)
  bladeShape.lineTo(0.018, 3.65)
  bladeShape.lineTo(-0.018, 3.65)
  bladeShape.lineTo(-0.05, 2.6)
  bladeShape.lineTo(-0.085, 1.1)
  bladeShape.closePath()
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.05, bevelEnabled: false })
  bladeGeo.translate(0, 0, -0.025)
  bladeGeo.rotateY(-0.22)
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeo, whiteMetal)
    blade.rotation.z = (i / 3) * Math.PI * 2
    blade.castShadow = true
    rotor.add(blade)
  }
  const rotorState = { group: rotor }

  // 气象站
  const weather = new THREE.Group()
  weather.position.set(18.4, 0, 9.0)
  world.add(weather)
  addCyl(weather, whiteMetal, 0.035, 0.05, 3.1, 0, 1.55, 0, 6)
  addBox(weather, whiteMetal, 0.9, 0.05, 0.05, 0, 2.85, 0)
  addBox(weather, whiteMetal, 0.05, 0.05, 0.9, 0, 2.7, 0)
  const cups = new THREE.Group()
  cups.position.y = 3.0
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), whiteMetal)
    arm.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15)
    arm.rotation.y = -a
    cups.add(arm)
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), whiteMetal)
    cup.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3)
    cup.scale.y = 0.6
    cups.add(cup)
  }
  weather.add(cups)
  addBox(weather, new THREE.MeshStandardMaterial({ color: 0x4f6357, roughness: 0.6 }), 0.2, 0.28, 0.14, 0.3, 2.2, 0)
  addBox(weather, new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.35 }), 0.55, 0.03, 0.38, 0, 2.3, 0)

  /* ------------------------------ 设备 ------------------------------ */
  const devices: DeviceInfo[] = []
  const deviceHandles: { info: DeviceInfo; group: THREE.Group; ringMat?: THREE.MeshBasicMaterial }[] = []
  const registerDevice = (group: THREE.Group, info: DeviceInfo, ringMat?: THREE.MeshBasicMaterial) => {
    group.traverse(o => {
      o.userData.deviceId = info.id
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) pickables.push(mesh)
    })
    devices.push(info)
    deviceHandles.push({ info, group, ringMat })
  }

  const buildSensor = (plotObj: (typeof plotObjs)[number]) => {
    const { plot, slot } = plotObj
    const g = new THREE.Group()
    g.position.set(slot.x - slot.w / 2 - 0.58, 0, slot.z + slot.d / 2 - 0.4)
    world.add(g)
    addCyl(g, whiteMetal, 0.035, 0.045, 1.2, 0, 0.6, 0, 8)
    addBox(g, whiteMetal, 0.22, 0.3, 0.14, 0, 1.08, 0)
    addBox(g, darkFrame, 0.24, 0.02, 0.16, 0, 1.24, 0)
    const panel = addBox(g, new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.3, metalness: 0.4 }), 0.4, 0.03, 0.28, 0, 1.3, 0)
    panel.rotation.x = -0.35
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xa8e6b8, emissive: 0x4cc273, emissiveIntensity: 1.4 })
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), ledMat)
    led.position.set(0.065, 1.16, 0.08)
    g.add(led)
    addCyl(g, darkFrame, 0.012, 0.012, 0.55, 0, 0.28, 0.02, 5)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dcf9a, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.06
    g.add(ring)

    const r = rng(plot.id * 13 + 5)
    const alert = plot.status === 4
    const moisture = alert ? 16.4 : 22 + plot.progress * 17 + r() * 4
    const temp = 18.2 + r() * 3.2 + (alert ? 2.9 : 0)
    const ec = 1.0 + r() * 0.4
    const ph = 6.2 + r() * 0.55 - (alert ? 0.6 : 0)
    const info: DeviceInfo = {
      id: `soil-${plot.crop}`,
      kind: 'sensor',
      name: `土壤墒情 ${plot.plotNo}`,
      model: 'SM-200 三合一墒情站',
      status: alert ? '告警' : '在线',
      battery: Math.round(72 + r() * 26),
      signal: Math.round(78 + r() * 20),
      uptime: `${110 + Math.round(r() * 80)} 天`,
      metrics: [
        { label: '土壤含水率', value: `${moisture.toFixed(1)} %` },
        { label: '土壤温度', value: `${temp.toFixed(1)} ℃` },
        { label: '电导率 EC', value: `${ec.toFixed(2)} mS/cm` },
        { label: '酸碱度 pH', value: ph.toFixed(1) },
      ],
      pos: [g.position.x, 0.8, g.position.z],
      plot: { id: plot.id, plotNo: plot.plotNo, cropName: plot.cropName, status: plot.status },
    }
    registerDevice(g, info, ringMat)
  }

  ;(['rice', 'rape', 'grape', 'berry'] as ParkCrop[]).forEach(crop => {
    const hit = plotObjs.find(o => o.plot.crop === crop)
    if (hit) buildSensor(hit)
  })

  // 车辆编号贴花（画在 Canvas 上，透明底）
  const makeMarkTexture = (code: string, sub: string) =>
    canvasTex(256, 120, ctx => {
      ctx.fillStyle = '#f4f1e4'
      ctx.font = '700 54px "Segoe UI", "Microsoft YaHei", Arial, sans-serif'
      ctx.fillText(code, 6, 62)
      ctx.fillStyle = 'rgba(244, 241, 228, 0.7)'
      ctx.font = '500 17px "Segoe UI", Arial, sans-serif'
      ctx.fillText(sub, 8, 94)
    })

  // 巡检机器人 R-07 · AgriRover 4WD（车头朝 +Z）
  const robotGroup = new THREE.Group()
  world.add(robotGroup)
  const robotBody = new THREE.Group()
  robotGroup.add(robotBody)

  const robotShellMat = new THREE.MeshStandardMaterial({ color: 0x4f6f5f, roughness: 0.4, metalness: 0.4 })
  const robotShellDark = new THREE.MeshStandardMaterial({ color: 0x3a5147, roughness: 0.46, metalness: 0.38 })
  const robotDeckMat = new THREE.MeshStandardMaterial({ color: 0xd9ddcf, roughness: 0.4, metalness: 0.2 })
  const robotCarbonMat = new THREE.MeshStandardMaterial({ color: 0x2f3831, roughness: 0.42, metalness: 0.5 })
  const robotTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9a45c, roughness: 0.34, metalness: 0.62 })
  const robotRubberMat = new THREE.MeshStandardMaterial({ color: 0x24281f, roughness: 0.95 })
  const robotRimMat = new THREE.MeshStandardMaterial({ color: 0xe2e7da, roughness: 0.28, metalness: 0.65 })
  const robotRimDarkMat = new THREE.MeshStandardMaterial({ color: 0x333a35, roughness: 0.5, metalness: 0.4 })
  const robotLampMat = new THREE.MeshStandardMaterial({ color: 0xfff4da, emissive: 0xffd89a, emissiveIntensity: 1.25, roughness: 0.3 })
  const robotTailMat = new THREE.MeshStandardMaterial({ color: 0xff7a5c, emissive: 0xd8412a, emissiveIntensity: 0.85, roughness: 0.42 })
  const robotBeaconMat = new THREE.MeshStandardMaterial({ color: 0xf2a54e, emissive: 0xff8e23, emissiveIntensity: 1.45, roughness: 0.44 })
  const robotLensMat = new THREE.MeshStandardMaterial({ color: 0x101815, roughness: 0.12, metalness: 0.72 })
  const robotGlassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8c0, emissive: 0x3f9c74, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.2 })
  const solarSkin = new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.28, metalness: 0.5 })
  const robotMarkMat = new THREE.MeshStandardMaterial({
    map: makeMarkTexture('R-07', 'AGRI ROVER · MULTISPECTRAL'),
    transparent: true, roughness: 0.6, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
  })

  // —— 底盘 / 车体 ——
  addRBox(robotBody, darkFrame, 0.84, 0.13, 1.14, 0, 0.34, 0, 0.05)
  addRBox(robotBody, robotShellDark, 0.76, 0.1, 1.04, 0, 0.43, 0, 0.04)
  addRBox(robotBody, robotShellMat, 0.8, 0.34, 1.0, 0, 0.58, 0, 0.1)
  addRBox(robotBody, robotShellMat, 0.82, 0.052, 1.01, 0, 0.752, 0, 0.026)
  for (const sx of [-0.402, 0.402]) addBox(robotBody, robotTrimMat, 0.006, 0.02, 0.94, sx, 0.655, 0, 0, false)
  // 顶部设备台 + 太阳能板
  addRBox(robotBody, robotCarbonMat, 0.62, 0.055, 0.5, 0, 0.808, 0.02, 0.022)
  const robotPanel = addBox(robotBody, solarSkin, 0.54, 0.018, 0.44, 0, 0.848, 0.02)
  robotPanel.rotation.z = 0.015
  for (const pz of [-0.202, 0.242]) addBox(robotBody, robotTrimMat, 0.55, 0.012, 0.012, 0, 0.86, pz, 0, false)
  for (const sx of [-0.275, 0.275]) addBox(robotBody, robotTrimMat, 0.012, 0.012, 0.44, sx, 0.86, 0.02, 0, false)
  // 前脸：灯组 + 格栅
  addRBox(robotBody, robotShellDark, 0.64, 0.24, 0.1, 0, 0.55, 0.52, 0.03)
  const robotLampGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.035, 18)
  robotLampGeo.rotateX(Math.PI / 2)
  const robotBezelGeo = new THREE.TorusGeometry(0.052, 0.009, 6, 18)
  for (const sx of [-0.19, 0.19]) {
    addMesh(robotBody, robotLampGeo, robotLampMat, sx, 0.578, 0.567)
    addMesh(robotBody, robotBezelGeo, robotTrimMat, sx, 0.578, 0.574)
  }
  addRBox(robotBody, darkFrame, 0.3, 0.085, 0.02, 0, 0.503, 0.567, 0.008, false)
  for (let i = 0; i < 3; i++) addBox(robotBody, robotShellDark, 0.26, 0.008, 0.012, 0, 0.478 + i * 0.022, 0.576, 0, false)
  addBox(robotBody, robotTrimMat, 0.1, 0.014, 0.012, 0, 0.44, 0.576, 0, false)
  addRBox(robotBody, darkFrame, 0.78, 0.075, 0.08, 0, 0.33, 0.585, 0.03)
  addBox(robotBody, robotTrimMat, 0.6, 0.008, 0.012, 0, 0.322, 0.626, 0, false)
  for (const sx of [-0.355, 0.355]) addBox(robotBody, robotBeaconMat, 0.042, 0.016, 0.012, sx, 0.35, 0.63, 0, false)
  // 尾部：尾灯 + 后杠
  addRBox(robotBody, robotShellDark, 0.64, 0.24, 0.1, 0, 0.55, -0.52, 0.03)
  for (const sx of [-0.2, 0.2]) addBox(robotBody, robotTailMat, 0.1, 0.045, 0.018, sx, 0.6, -0.573, 0, false)
  addRBox(robotBody, darkFrame, 0.78, 0.075, 0.08, 0, 0.33, -0.585, 0.03)
  addBox(robotBody, robotTrimMat, 0.14, 0.014, 0.012, 0, 0.505, -0.573, 0, false)
  addCyl(robotBody, robotLensMat, 0.018, 0.018, 0.014, 0, 0.65, -0.572, 12).rotation.x = Math.PI / 2
  addRBox(robotBody, robotCarbonMat, 0.16, 0.05, 0.07, 0, 0.27, -0.6, 0.012, false)
  // 侧格栅 + 编号贴花
  for (const sx of [-0.403, 0.403]) {
    for (let i = 0; i < 3; i++) addBox(robotBody, robotShellDark, 0.008, 0.028, 0.16, sx, 0.55 + i * 0.042, 0.2, 0, false)
  }
  const robotMarkGeo = new THREE.PlaneGeometry(0.34, 0.16)
  for (const [sx, ry] of [[0.406, Math.PI / 2], [-0.406, -Math.PI / 2]] as const) {
    const m = new THREE.Mesh(robotMarkGeo, robotMarkMat)
    m.position.set(sx, 0.6, -0.12)
    m.rotation.y = ry
    robotBody.add(m)
  }

  // —— 云台桅杆与多光谱扫描头 ——
  addCyl(robotBody, robotCarbonMat, 0.03, 0.046, 0.44, 0.15, 1.02, -0.4, 12)
  addCyl(robotBody, robotTrimMat, 0.052, 0.052, 0.016, 0.15, 0.945, -0.4, 14)
  addCyl(robotBody, robotCarbonMat, 0.05, 0.056, 0.035, 0.15, 0.795, -0.4, 12)
  const robotHead = new THREE.Group()
  robotHead.position.set(0.15, 1.27, -0.4)
  robotHead.rotation.x = 0.08
  robotBody.add(robotHead)
  for (const sx of [-0.107, 0.107]) {
    addBox(robotHead, robotCarbonMat, 0.014, 0.13, 0.1, sx, -0.045, 0, 0, false)
    addMesh(robotHead, new THREE.TorusGeometry(0.024, 0.008, 6, 14), robotTrimMat, sx, -0.02, 0).rotation.y = Math.PI / 2
  }
  addRBox(robotHead, robotDeckMat, 0.19, 0.15, 0.18, 0, -0.015, 0, 0.03)
  addRBox(robotHead, robotCarbonMat, 0.2, 0.032, 0.19, 0, 0.068, -0.005, 0.014)
  addRBox(robotHead, robotCarbonMat, 0.15, 0.018, 0.05, 0, 0.055, 0.08, 0.008, false)
  const robotLensGeo = new THREE.CylinderGeometry(0.047, 0.054, 0.052, 20)
  robotLensGeo.rotateX(Math.PI / 2)
  const robotGlassGeo = new THREE.CylinderGeometry(0.037, 0.037, 0.012, 20)
  robotGlassGeo.rotateX(Math.PI / 2)
  addMesh(robotHead, robotLensGeo, robotLensMat, 0, -0.015, 0.098)
  addMesh(robotHead, robotGlassGeo, robotGlassMat, 0, -0.015, 0.128)
  addMesh(robotHead, new THREE.TorusGeometry(0.049, 0.007, 6, 20), robotTrimMat, 0, -0.015, 0.126)
  const robotMiniLensGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.038, 12)
  robotMiniLensGeo.rotateX(Math.PI / 2)
  for (const sx of [-0.055, 0.055]) addMesh(robotHead, robotMiniLensGeo, robotLensMat, sx, 0.032, 0.092)
  for (let i = 0; i < 3; i++) addBox(robotHead, robotCarbonMat, 0.1, 0.008, 0.008, 0, -0.05 + i * 0.026, -0.092, 0, false)
  // 天线 + 顶灯
  addCyl(robotBody, metalMat, 0.005, 0.007, 0.4, -0.3, 1.0, -0.34, 5)
  addMesh(robotBody, new THREE.TorusGeometry(0.03, 0.006, 4, 10), metalMat, -0.3, 1.02, -0.34).rotation.x = Math.PI / 2
  const robotAntTip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 7, 6), robotBeaconMat)
  robotAntTip.position.set(-0.3, 1.21, -0.34)
  robotBody.add(robotAntTip)
  addCyl(robotBody, darkFrame, 0.04, 0.046, 0.018, -0.3, 0.787, 0.4, 14)
  addCyl(robotBody, robotBeaconMat, 0.031, 0.037, 0.042, -0.3, 0.815, 0.4, 14)
  addMesh(robotBody, new THREE.SphereGeometry(0.031, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), robotBeaconMat, -0.3, 0.836, 0.4)

  // —— 轮组：轮胎 + 轮肩 + 轮毂辐条 + 挡泥板 ——
  const robotTireGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.13, 24)
  robotTireGeo.rotateZ(Math.PI / 2)
  const robotShoulderGeo = new THREE.TorusGeometry(0.178, 0.026, 5, 20)
  robotShoulderGeo.rotateY(Math.PI / 2)
  const robotRimGeo = new THREE.CylinderGeometry(0.112, 0.112, 0.02, 20)
  robotRimGeo.rotateZ(Math.PI / 2)
  const robotRimRingGeo = new THREE.TorusGeometry(0.098, 0.006, 5, 20)
  robotRimRingGeo.rotateY(Math.PI / 2)
  const robotCapGeo = new THREE.CylinderGeometry(0.031, 0.031, 0.018, 14)
  robotCapGeo.rotateZ(Math.PI / 2)
  const robotSpokeGeo = new THREE.BoxGeometry(0.022, 0.014, 0.072)
  const robotFenderGeo = new THREE.TorusGeometry(0.25, 0.022, 5, 18, Math.PI)
  robotFenderGeo.rotateY(Math.PI / 2)
  const robotWheels: THREE.Group[] = []
  for (const sx of [-0.4, 0.4]) {
    for (const sz of [-0.4, 0.4]) {
      const wheel = new THREE.Group()
      wheel.position.set(sx, 0.21, sz)
      const tire = new THREE.Mesh(robotTireGeo, robotRubberMat)
      tire.castShadow = true
      tire.receiveShadow = true
      wheel.add(tire)
      for (const ox of [-0.045, 0.045]) {
        const shoulder = new THREE.Mesh(robotShoulderGeo, robotRubberMat)
        shoulder.position.x = ox
        wheel.add(shoulder)
      }
      const outward = sx > 0 ? 1 : -1
      const dish = new THREE.Mesh(robotRimGeo, robotRimDarkMat)
      dish.position.x = outward * 0.05
      dish.castShadow = true
      wheel.add(dish)
      const rimRing = new THREE.Mesh(robotRimRingGeo, robotRimMat)
      rimRing.position.x = outward * 0.061
      wheel.add(rimRing)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const spoke = new THREE.Mesh(robotSpokeGeo, robotRimMat)
        spoke.position.set(outward * 0.061, Math.cos(a) * 0.053, Math.sin(a) * 0.053)
        spoke.rotation.x = a - Math.PI / 2
        wheel.add(spoke)
      }
      const cap = new THREE.Mesh(robotCapGeo, robotTrimMat)
      cap.position.x = outward * 0.067
      wheel.add(cap)
      robotGroup.add(wheel)
      robotWheels.push(wheel)

      const fender = new THREE.Mesh(robotFenderGeo, robotShellDark)
      fender.position.set(sx, 0.21, sz)
      fender.castShadow = true
      robotBody.add(fender)
      if (sz > 0) addBox(robotBody, robotShellDark, 0.11, 0.1, 0.02, sx, 0.16, sz - 0.27, 0, false)
    }
  }

  const robotRingMat = new THREE.MeshBasicMaterial({ color: 0x86d5a2, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  const robotRing = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.88, 40), robotRingMat)
  robotRing.rotation.x = -Math.PI / 2
  robotRing.position.y = 0.05
  robotGroup.add(robotRing)

  // 沿园路绕中央田块一周
  const robotCurve = new THREE.CatmullRomCurve3(
    ROBOT_ROUTE.map(([x, z]) => new THREE.Vector3(x, 0.02, z)),
    true,
    'centripetal',
  )
  const robotRouteLen = robotCurve.getLength()

  // 地面巡逻路线标识（虚线）
  const dashCount = Math.max(24, Math.round(robotRouteLen / 1.35))
  const dashGeo = new THREE.PlaneGeometry(0.6, 0.14)
  dashGeo.rotateX(-Math.PI / 2)
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf3f5ea, transparent: true, opacity: 0.46, depthWrite: false })
  const robotDashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount)
  const dashDummy = new THREE.Object3D()
  for (let i = 0; i < dashCount; i++) {
    const dt2 = i / dashCount
    const dp = robotCurve.getPointAt(dt2)
    const dtan = robotCurve.getTangentAt(dt2)
    dashDummy.position.set(dp.x, 0.035, dp.z)
    dashDummy.rotation.set(0, Math.atan2(dtan.x, dtan.z), 0)
    dashDummy.updateMatrix()
    robotDashes.setMatrixAt(i, dashDummy.matrix)
  }
  robotDashes.instanceMatrix.needsUpdate = true
  robotDashes.renderOrder = 2
  world.add(robotDashes)

  // 行进方向箭头
  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(-0.1, 0.12)
  arrowShape.lineTo(0.1, 0.12)
  arrowShape.lineTo(0, -0.14)
  arrowShape.closePath()
  const arrowGeo = new THREE.ShapeGeometry(arrowShape)
  arrowGeo.rotateX(-Math.PI / 2)
  const arrowCount = 8
  const robotArrows = new THREE.InstancedMesh(
    arrowGeo,
    new THREE.MeshBasicMaterial({ color: 0xf7f4e0, transparent: true, opacity: 0.55, depthWrite: false }),
    arrowCount,
  )
  for (let i = 0; i < arrowCount; i++) {
    const at = (i + 0.5) / arrowCount
    const ap = robotCurve.getPointAt(at)
    const atan = robotCurve.getTangentAt(at)
    dashDummy.position.set(ap.x, 0.042, ap.z)
    dashDummy.rotation.set(0, Math.atan2(atan.x, atan.z), 0)
    dashDummy.updateMatrix()
    robotArrows.setMatrixAt(i, dashDummy.matrix)
  }
  robotArrows.instanceMatrix.needsUpdate = true
  robotArrows.renderOrder = 3
  world.add(robotArrows)

  const rInfo: DeviceInfo = {
    id: 'robot-r07',
    kind: 'robot',
    name: '巡检机器人 R-07',
    model: 'AgriRover 4WD · 多光谱云台',
    status: '巡逻中',
    battery: 78,
    signal: 92,
    uptime: '46 天',
    metrics: [
      { label: '今日里程', value: '6.8 km' },
      { label: '采集影像', value: '1,284 张' },
      { label: '当前任务', value: '长势巡检' },
      { label: '行驶速度', value: '1.2 m/s' },
    ],
    pos: [2.8, 0.8, 2.5],
  }
  registerDevice(robotGroup, rInfo, robotRingMat)

  // 光伏运维车 S-01 · SolarCart（车头朝 +Z）
  const cart2 = new THREE.Group()
  world.add(cart2)
  const cartBody = new THREE.Group()
  cart2.add(cartBody)

  const cartPaint = new THREE.MeshStandardMaterial({ color: 0x7f9188, roughness: 0.48, metalness: 0.36 })
  const cartPaintDark = new THREE.MeshStandardMaterial({ color: 0x5c6d65, roughness: 0.52, metalness: 0.34 })
  const cartDeckMat = new THREE.MeshStandardMaterial({ color: 0x95a094, roughness: 0.62, metalness: 0.22 })
  const cartCreamMat = new THREE.MeshStandardMaterial({ color: 0xdfe2d4, roughness: 0.42, metalness: 0.2 })
  const cartTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9a45c, roughness: 0.34, metalness: 0.62 })
  const cartRubberMat = new THREE.MeshStandardMaterial({ color: 0x24281f, roughness: 0.95 })
  const cartRimMat = new THREE.MeshStandardMaterial({ color: 0xe0e5d8, roughness: 0.28, metalness: 0.65 })
  const cartRimDarkMat = new THREE.MeshStandardMaterial({ color: 0x333a35, roughness: 0.5, metalness: 0.4 })
  const cartSeatMat = new THREE.MeshStandardMaterial({ color: 0x35423a, roughness: 0.72, metalness: 0.1 })
  const cartLampMat = new THREE.MeshStandardMaterial({ color: 0xfff4da, emissive: 0xffd89a, emissiveIntensity: 1.15, roughness: 0.3 })
  const cartTailMat = new THREE.MeshStandardMaterial({ color: 0xff7a5c, emissive: 0xd8412a, emissiveIntensity: 0.8, roughness: 0.42 })
  const cartBeaconMat = new THREE.MeshStandardMaterial({ color: 0xf2a54e, emissive: 0xff8e23, emissiveIntensity: 1.45, roughness: 0.44 })
  const cartScreenMat = new THREE.MeshStandardMaterial({ color: 0x1d3a32, emissive: 0x52c08a, emissiveIntensity: 0.85, roughness: 0.25 })
  const cartGlassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8e0, transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0.12, depthWrite: false, side: THREE.DoubleSide })
  const cartMarkMat = new THREE.MeshStandardMaterial({
    map: makeMarkTexture('S-01', 'SOLAR O&M CART'),
    transparent: true, roughness: 0.6, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
  })

  // —— 底盘 / 平台 ——
  addRBox(cartBody, darkFrame, 0.84, 0.13, 1.34, 0, 0.31, 0, 0.05)
  addRBox(cartBody, cartDeckMat, 0.82, 0.05, 1.3, 0, 0.39, 0, 0.02)
  for (const sx of [-0.412, 0.412]) addRBox(cartBody, cartPaintDark, 0.018, 0.1, 1.24, sx, 0.375, 0, 0.01)
  addRBox(cartBody, cartPaintDark, 0.84, 0.13, 0.04, 0, 0.378, 0.652, 0.012)
  addRBox(cartBody, cartPaintDark, 0.82, 0.04, 0.22, 0, 0.42, 0.55, 0.012)
  addRBox(cartBody, cartPaintDark, 0.82, 0.1, 0.018, 0, 0.375, -0.645, 0.01)
  // 前舱盖
  addRBox(cartBody, cartPaint, 0.68, 0.23, 0.34, 0, 0.535, 0.43, 0.06)
  addRBox(cartBody, cartCreamMat, 0.5, 0.03, 0.24, 0, 0.663, 0.43, 0.02)
  addBox(cartBody, cartTrimMat, 0.012, 0.008, 0.24, 0, 0.68, 0.43, 0, false)
  addCyl(cartBody, cartTrimMat, 0.028, 0.028, 0.012, 0, 0.598, 0.601, 12).rotation.x = Math.PI / 2
  for (let i = 0; i < 3; i++) addBox(cartBody, cartPaintDark, 0.5, 0.012, 0.012, 0, 0.468 + i * 0.024, 0.602, 0, false)
  const cartLampGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.035, 18)
  cartLampGeo.rotateX(Math.PI / 2)
  const cartBezelGeo = new THREE.TorusGeometry(0.052, 0.009, 6, 18)
  for (const sx of [-0.23, 0.23]) {
    addMesh(cartBody, cartLampGeo, cartLampMat, sx, 0.555, 0.6)
    addMesh(cartBody, cartBezelGeo, cartTrimMat, sx, 0.555, 0.607)
  }
  for (const sx of [-0.315, 0.315]) addBox(cartBody, cartTailMat, 0.034, 0.016, 0.012, sx, 0.51, 0.601, 0, false)
  addRBox(cartBody, darkFrame, 0.72, 0.06, 0.07, 0, 0.365, 0.684, 0.024)
  addBox(cartBody, cartTrimMat, 0.46, 0.008, 0.012, 0, 0.358, 0.721, 0, false)

  // —— 驾驶位：仪表台 / 方向盘 / 座椅 ——
  addRBox(cartBody, cartPaintDark, 0.5, 0.1, 0.13, 0, 0.705, 0.3, 0.02)
  addRBox(cartBody, cartCreamMat, 0.45, 0.014, 0.02, 0, 0.735, 0.248, 0.006, false)
  addBox(cartBody, cartScreenMat, 0.16, 0.052, 0.012, 0.1, 0.722, 0.228, 0, false)
  const cartColumn = addCyl(cartBody, cartPaintDark, 0.022, 0.026, 0.24, 0, 0.795, 0.243, 10)
  cartColumn.rotation.x = 0.8
  addCyl(cartBody, cartTrimMat, 0.03, 0.03, 0.014, 0, 0.733, 0.29, 10).rotation.x = 0.8
  const cartSteer = new THREE.Group()
  cartSteer.position.set(0, 0.882, 0.188)
  cartSteer.rotation.x = 0.8
  cartBody.add(cartSteer)
  addMesh(cartSteer, new THREE.TorusGeometry(0.092, 0.014, 8, 22), darkFrame, 0, 0, 0)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.016, 0.012), darkFrame)
    sp.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0)
    sp.rotation.z = a
    cartSteer.add(sp)
  }
  addMesh(cartSteer, new THREE.CylinderGeometry(0.03, 0.03, 0.026, 14).rotateX(Math.PI / 2), cartTrimMat, 0, 0, 0)
  addRBox(cartBody, cartSeatMat, 0.46, 0.1, 0.34, 0, 0.62, 0.01, 0.04)
  for (const sx of [-0.085, 0.085]) addBox(cartBody, cartPaintDark, 0.01, 0.004, 0.3, sx, 0.671, 0.01, 0, false)
  const cartBack = addRBox(cartBody, cartSeatMat, 0.46, 0.36, 0.09, 0, 0.83, -0.19, 0.04)
  cartBack.rotation.x = -0.12
  addBox(cartBody, cartTrimMat, 0.34, 0.008, 0.006, 0, 0.9, -0.152, 0, false)
  addRBox(cartBody, cartSeatMat, 0.24, 0.08, 0.08, 0, 1.015, -0.22, 0.03)

  // —— 前挡风玻璃 + 后视镜 ——
  const cartWind = addBox(cartBody, cartGlassMat, 0.66, 0.35, 0.012, 0, 0.94, 0.345, 0, false)
  cartWind.rotation.x = 0.24
  for (const sx of [-0.337, 0.337]) {
    const pillar = addCyl(cartBody, cartPaintDark, 0.013, 0.013, 0.38, sx, 0.94, 0.345, 8)
    pillar.rotation.x = 0.24
  }
  addBox(cartBody, cartPaintDark, 0.69, 0.024, 0.03, 0, 0.768, 0.303, 0, false).rotation.x = 0.24
  addBox(cartBody, cartPaintDark, 0.69, 0.024, 0.03, 0, 1.112, 0.385, 0, false).rotation.x = 0.24
  addBox(cartBody, cartPaintDark, 0.19, 0.007, 0.012, -0.12, 0.812, 0.318, 0, false).rotation.z = 0.16
  for (const sx of [-1, 1]) {
    const arm = addCyl(cartBody, cartPaintDark, 0.008, 0.008, 0.09, sx * 0.395, 1.0, 0.325, 6)
    arm.rotation.z = Math.PI / 2
    addRBox(cartBody, cartPaintDark, 0.05, 0.07, 0.018, sx * 0.45, 1.0, 0.325, 0.012, false)
    addBox(cartBody, cartGlassMat, 0.04, 0.058, 0.004, sx * 0.45, 1.0, 0.315, false)
  }
  // —— 防滚架 + 光伏顶棚 ——
  for (const sx of [-0.4, 0.4]) {
    for (const sz of [0.36, -0.2]) addCyl(cartBody, metalMat, 0.021, 0.021, 0.72, sx, 0.75, sz, 8)
  }
  for (const sx of [-0.4, 0.4]) addBox(cartBody, cartPaint, 0.03, 0.035, 0.62, sx, 1.13, 0.08, 0, false)
  for (const sz of [0.39, -0.23]) addBox(cartBody, cartPaint, 0.86, 0.035, 0.03, 0, 1.13, sz, 0, false)
  addRBox(cartBody, cartPaintDark, 0.84, 0.022, 0.6, 0, 1.148, 0.08, 0.01, false)
  const cartPanelMat = new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.28, metalness: 0.5 })
  for (const sx of [-0.215, 0.215]) {
    const panel = addBox(cartBody, cartPanelMat, 0.4, 0.022, 0.58, sx, 1.165, 0.08)
    panel.rotation.x = -0.06
    addBox(cartBody, cartTrimMat, 0.4, 0.026, 0.014, sx, 1.168, 0.37, 0, false).rotation.x = -0.06
  }
  addBox(cartBody, cartTrimMat, 0.014, 0.026, 0.58, 0, 1.168, 0.08, 0, false).rotation.x = -0.06
  for (const sx of [-0.417, 0.417]) addBox(cartBody, cartTrimMat, 0.014, 0.026, 0.58, sx, 1.168, 0.08, 0, false).rotation.x = -0.06
  addCyl(cartBody, cartLampMat, 0.028, 0.032, 0.016, 0.24, 1.125, 0.02, 12)
  // 接线盒与线束
  addRBox(cartBody, darkFrame, 0.16, 0.09, 0.12, 0, 1.06, -0.24, 0.015)
  addBox(cartBody, cartScreenMat, 0.02, 0.02, 0.01, 0.055, 1.06, -0.302, 0, false)
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 1.02, -0.24),
    new THREE.Vector3(0.12, 0.9, -0.3),
    new THREE.Vector3(0.08, 0.66, -0.44),
    new THREE.Vector3(0.12, 0.46, -0.5),
  ])
  addMesh(cartBody, new THREE.TubeGeometry(cableCurve, 18, 0.007, 5, false), darkFrame, 0, 0, 0)

  // —— 后货厢：电池 / 水箱 / 工具箱 / 线盘 ——
  const bedZ = -0.38
  addRBox(cartBody, cartDeckMat, 0.72, 0.04, 0.6, 0, 0.44, bedZ, 0.015)
  for (let i = 0; i < 4; i++) addBox(cartBody, cartDeckMat, 0.66, 0.008, 0.014, 0, 0.462, -0.62 + i * 0.16, 0, false)
  for (const sx of [-0.38, 0.38]) addRBox(cartBody, cartPaint, 0.04, 0.24, 0.6, sx, 0.56, bedZ, 0.015)
  addRBox(cartBody, cartPaint, 0.76, 0.24, 0.04, 0, 0.56, -0.1, 0.015)
  addRBox(cartBody, cartPaint, 0.76, 0.24, 0.04, 0, 0.56, -0.675, 0.015)
  for (const sx of [-0.38, 0.38]) addBox(cartBody, cartTrimMat, 0.035, 0.016, 0.58, sx, 0.686, bedZ, 0, false)
  addBox(cartBody, cartTrimMat, 0.16, 0.02, 0.02, 0, 0.6, -0.697, 0, false)
  addRBox(cartBody, darkFrame, 0.3, 0.15, 0.26, 0.16, 0.35, -0.42, 0.02)
  addBox(cartBody, cartScreenMat, 0.006, 0.03, 0.16, 0.312, 0.35, -0.42, 0, false)
  addCyl(cartBody, cartCreamMat, 0.12, 0.12, 0.32, -0.2, 0.625, -0.36, 14)
  addCyl(cartBody, metalMat, 0.03, 0.03, 0.03, -0.2, 0.795, -0.36, 8)
  for (const sz of [-0.44, -0.28]) addMesh(cartBody, new THREE.TorusGeometry(0.122, 0.009, 4, 16), darkFrame, -0.2, 0.625, sz).rotation.x = Math.PI / 2
  addBox(cartBody, cartScreenMat, 0.012, 0.2, 0.024, -0.078, 0.635, -0.36, 0, false)
  addRBox(cartBody, new THREE.MeshStandardMaterial({ color: 0xc4633f, roughness: 0.6 }), 0.28, 0.15, 0.22, 0.19, 0.55, -0.58, 0.02)
  addRBox(cartBody, new THREE.MeshStandardMaterial({ color: 0xb4562f, roughness: 0.55 }), 0.29, 0.02, 0.23, 0.19, 0.63, -0.58, 0.008, false)
  addBox(cartBody, cartTrimMat, 0.03, 0.012, 0.012, 0.19, 0.6, -0.692, 0, false)
  addCyl(cartBody, cartPaintDark, 0.1, 0.1, 0.09, 0.19, 0.55, -0.58, 12).rotation.z = Math.PI / 2
  // 尾部灯具 + 顶灯 + 天线
  for (const sx of [-0.3, 0.3]) addBox(cartBody, cartTailMat, 0.1, 0.05, 0.018, sx, 0.5, -0.69, 0, false)
  addCyl(cartBody, darkFrame, 0.046, 0.052, 0.018, -0.36, 1.158, -0.2, 14)
  addCyl(cartBody, cartBeaconMat, 0.031, 0.037, 0.042, -0.36, 1.186, -0.2, 14)
  addMesh(cartBody, new THREE.SphereGeometry(0.031, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cartBeaconMat, -0.36, 1.207, -0.2)
  addCyl(cartBody, metalMat, 0.005, 0.007, 0.36, 0.46, 1.3, -0.28, 5)
  const cartAntTip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 7, 6), cartBeaconMat)
  cartAntTip.position.set(0.46, 1.48, -0.28)
  cartBody.add(cartAntTip)
  // 车号贴花
  const cartMarkGeo = new THREE.PlaneGeometry(0.3, 0.14)
  for (const [sx, ry] of [[0.343, Math.PI / 2], [-0.343, -Math.PI / 2]] as const) {
    const m = new THREE.Mesh(cartMarkGeo, cartMarkMat)
    m.position.set(sx, 0.56, 0.4)
    m.rotation.y = ry
    cartBody.add(m)
  }

  // —— 轮组 ——
  const cartTireGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.12, 24)
  cartTireGeo.rotateZ(Math.PI / 2)
  const cartShoulderGeo = new THREE.TorusGeometry(0.16, 0.024, 5, 20)
  cartShoulderGeo.rotateY(Math.PI / 2)
  const cartRimGeo = new THREE.CylinderGeometry(0.101, 0.101, 0.02, 20)
  cartRimGeo.rotateZ(Math.PI / 2)
  const cartRimRingGeo = new THREE.TorusGeometry(0.088, 0.005, 5, 20)
  cartRimRingGeo.rotateY(Math.PI / 2)
  const cartCapGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.018, 14)
  cartCapGeo.rotateZ(Math.PI / 2)
  const cartSpokeGeo = new THREE.BoxGeometry(0.02, 0.013, 0.066)
  const cartFenderGeo = new THREE.TorusGeometry(0.228, 0.024, 5, 18, Math.PI)
  cartFenderGeo.rotateY(Math.PI / 2)
  const cartWheels: THREE.Group[] = []
  for (const sx of [-0.42, 0.42]) {
    for (const sz of [-0.5, 0.5]) {
      const wheel = new THREE.Group()
      wheel.position.set(sx, 0.19, sz)
      const tire = new THREE.Mesh(cartTireGeo, cartRubberMat)
      tire.castShadow = true
      tire.receiveShadow = true
      wheel.add(tire)
      for (const ox of [-0.042, 0.042]) {
        const shoulder = new THREE.Mesh(cartShoulderGeo, cartRubberMat)
        shoulder.position.x = ox
        wheel.add(shoulder)
      }
      const outward = sx > 0 ? 1 : -1
      const dish = new THREE.Mesh(cartRimGeo, cartRimDarkMat)
      dish.position.x = outward * 0.046
      dish.castShadow = true
      wheel.add(dish)
      const rimRing = new THREE.Mesh(cartRimRingGeo, cartRimMat)
      rimRing.position.x = outward * 0.055
      wheel.add(rimRing)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const spoke = new THREE.Mesh(cartSpokeGeo, cartRimMat)
        spoke.position.set(outward * 0.055, Math.cos(a) * 0.048, Math.sin(a) * 0.048)
        spoke.rotation.x = a - Math.PI / 2
        wheel.add(spoke)
      }
      const cap = new THREE.Mesh(cartCapGeo, cartTrimMat)
      cap.position.x = outward * 0.061
      wheel.add(cap)
      cart2.add(wheel)
      cartWheels.push(wheel)

      const fender = new THREE.Mesh(cartFenderGeo, cartPaint)
      fender.position.set(sx, 0.19, sz)
      fender.castShadow = true
      cartBody.add(fender)
    }
  }

  const solarRingMat = new THREE.MeshBasicMaterial({ color: 0xaed6a0, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  const solarRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.94, 40), solarRingMat)
  solarRing.rotation.x = -Math.PI / 2
  solarRing.position.y = 0.05
  cart2.add(solarRing)

  // 绕西侧油菜田的服务环线
  const solarCurve = new THREE.CatmullRomCurve3(
    CART_ROUTE.map(([x, z]) => new THREE.Vector3(x, 0.02, z)),
    true,
    'centripetal',
  )
  const cartRouteLen = solarCurve.getLength()

  // 服务车路线虚线
  const cartDashCount = Math.max(18, Math.round(cartRouteLen / 1.6))
  const cartDashMat = new THREE.MeshBasicMaterial({ color: 0xeee9d6, transparent: true, opacity: 0.3, depthWrite: false })
  const cartDashes = new THREE.InstancedMesh(dashGeo, cartDashMat, cartDashCount)
  for (let i = 0; i < cartDashCount; i++) {
    const ct = i / cartDashCount
    const cp = solarCurve.getPointAt(ct)
    const ctan = solarCurve.getTangentAt(ct)
    dashDummy.position.set(cp.x, 0.032, cp.z)
    dashDummy.rotation.set(0, Math.atan2(ctan.x, ctan.z), 0)
    dashDummy.scale.setScalar(0.9)
    dashDummy.updateMatrix()
    cartDashes.setMatrixAt(i, dashDummy.matrix)
  }
  cartDashes.instanceMatrix.needsUpdate = true
  cartDashes.renderOrder = 2
  world.add(cartDashes)
  dashDummy.scale.setScalar(1)

  const sInfo: DeviceInfo = {
    id: 'solar-s01',
    kind: 'solar',
    name: '光伏运维车 S-01',
    model: 'SolarCart 320W · 储能 2.4kWh',
    status: '巡航中',
    battery: 86,
    signal: 88,
    uptime: '73 天',
    metrics: [
      { label: '实时功率', value: '268 W' },
      { label: '今日发电', value: '3.42 kWh' },
      { label: '电池电量', value: '86 %' },
      { label: '组件温度', value: '38.6 ℃' },
    ],
    pos: [-0.6, 0.7, 11.5],
  }
  registerDevice(cart2, sInfo, solarRingMat)

  // 水肥一体机
  const fert = new THREE.Group()
  fert.position.set(-17.2, 0, -3.3)
  world.add(fert)
  addBox(fert, darkFrame, 1.5, 0.14, 1.1, 0, 0.07, 0)
  addBox(fert, new THREE.MeshStandardMaterial({ color: 0x7d9188, roughness: 0.5, metalness: 0.35 }), 0.9, 1.25, 0.5, -0.25, 0.72, -0.2)
  addBox(fert, new THREE.MeshStandardMaterial({ color: 0x2d3a32, emissive: 0x4b9c72, emissiveIntensity: 0.3 }), 0.46, 0.3, 0.02, -0.25, 0.92, 0.06, 0, false)
  const tank1 = addCyl(fert, new THREE.MeshStandardMaterial({ color: 0xd8dcd0, roughness: 0.5, metalness: 0.2 }), 0.34, 0.34, 1.1, 0.55, 0.62, 0.2, 16)
  tank1.castShadow = true
  addCyl(fert, new THREE.MeshStandardMaterial({ color: 0x6e97a6, roughness: 0.5, metalness: 0.2 }), 0.28, 0.28, 0.9, 0.55, 0.55, -0.5, 14)
  addCyl(fert, metalMat, 0.025, 0.025, 1.1, 0.55, 0.6, 0.62, 6)
  for (let i = 0; i < 3; i++) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 10), new THREE.MeshStandardMaterial({ color: 0xc4633f, roughness: 0.5 }))
    valve.position.set(0.25, 0.42 + i * 0.16, 0.22)
    valve.rotation.x = Math.PI / 2
    fert.add(valve)
  }
  const fertRingMat = new THREE.MeshBasicMaterial({ color: 0x9ecfd8, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide })
  const fertRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.96, 30), fertRingMat)
  fertRing.rotation.x = -Math.PI / 2
  fertRing.position.y = 0.05
  fert.add(fertRing)
  const fInfo: DeviceInfo = {
    id: 'fert-f03',
    kind: 'fert',
    name: '水肥一体机 F-03',
    model: 'NutriMix 500L · 双泵比例',
    status: '运行中',
    battery: 100,
    signal: 96,
    uptime: '212 天',
    metrics: [
      { label: 'EC 设定', value: '1.8 mS/cm' },
      { label: 'pH 设定', value: '6.2' },
      { label: '今日流量', value: '4.6 m³' },
      { label: '灌溉任务', value: '油菜滴灌' },
    ],
    pos: [-17.2, 1.0, -3.3],
  }
  registerDevice(fert, fInfo, fertRingMat)

  // 温室环境节点
  const wallSensor = new THREE.Group()
  wallSensor.position.set(-3.6, 2.3, -1.84)
  world.add(wallSensor)
  addBox(wallSensor, new THREE.MeshStandardMaterial({ color: 0xe8ebe0, roughness: 0.6 }), 0.24, 0.32, 0.12, 0, 0, 0)
  addBox(wallSensor, darkFrame, 0.2, 0.02, 0.05, 0, -0.11, 0.06)
  const wsLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x9fe0b2, emissive: 0x4cc273, emissiveIntensity: 1.1 }),
  )
  wsLed.position.set(0.07, 0.09, 0.07)
  wallSensor.add(wsLed)
  const wInfo: DeviceInfo = {
    id: 'wall-w02',
    kind: 'wallsensor',
    name: '温室环境节点 W-02',
    model: 'EnviroNode · 温湿光气四合一',
    status: '在线',
    battery: 64,
    signal: 94,
    uptime: '188 天',
    metrics: [
      { label: '空气温度', value: '24.6 ℃' },
      { label: '空气湿度', value: '68.2 %' },
      { label: 'CO₂ 浓度', value: '612 ppm' },
      { label: '光照强度', value: '32.4 klx' },
    ],
    pos: [-3.6, 2.7, -1.7],
  }
  registerDevice(wallSensor, wInfo)

  // 垂直农场控制柜
  const tInfo: DeviceInfo = {
    id: 'tower-t01',
    kind: 'tower',
    name: '垂直农场控制柜 T-01',
    model: 'VertiCtrl · 18 盘循环',
    status: '运行中',
    battery: 100,
    signal: 98,
    uptime: '301 天',
    metrics: [
      { label: '营养液 EC', value: '1.9 mS/cm' },
      { label: '营养液 pH', value: '6.1' },
      { label: '循环泵', value: '4/4 运行' },
      { label: '补光时长', value: '14 h / 日' },
    ],
    pos: [11.1, 1.2, 9.4],
  }
  const cageRingMat = new THREE.MeshBasicMaterial({ color: 0xa5d8b5, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide })
  const cageRing = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.92, 30), cageRingMat)
  cageRing.rotation.x = -Math.PI / 2
  cageRing.position.y = 0.05
  cage.add(cageRing)
  registerDevice(cage, tInfo, cageRingMat)

  /* ------------------------------ 鸟与烟气 ------------------------------ */
  const birds: { group: THREE.Group; lw: THREE.Object3D; rw: THREE.Object3D; phase: number; radius: number; height: number; speed: number }[] = []
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x4a544c, roughness: 0.8, side: THREE.DoubleSide })
  const birdWingMat = new THREE.MeshStandardMaterial({ color: 0x5d685f, roughness: 0.8, side: THREE.DoubleSide })
  const tri = (pts: number[]) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.computeVertexNormals()
    return g
  }
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group()
    // 静态部件合并：躯干 + 头 + 喙 + 尾羽
    const body = new THREE.SphereGeometry(0.1, 8, 6)
    body.scale(0.55, 0.5, 1.25)
    const head = new THREE.SphereGeometry(0.06, 7, 5)
    head.translate(0, 0.045, 0.13)
    const beak = new THREE.ConeGeometry(0.02, 0.07, 5)
    beak.rotateX(Math.PI / 2)
    beak.translate(0, 0.045, 0.21)
    const tail = tri([0, 0.01, -0.1, -0.07, 0.02, -0.26, 0.07, 0.02, -0.26, 0, 0.01, -0.1, 0.07, 0.02, -0.26, 0, 0.03, -0.2])
    const staticGeo = mergeAll([body, head, beak, tail])
    b.add(new THREE.Mesh(staticGeo, birdMat))
    // 扫掠形翅膀（多三角面，收尖）
    const makeWing = (dir: number) => {
      const w = new THREE.Group()
      const g = tri([
        0, 0, 0.03, dir * 0.28, 0.02, 0.1, dir * 0.52, 0.05, 0,
        0, 0, 0.03, dir * 0.52, 0.05, 0, dir * 0.85, 0.08, -0.14,
        0, 0, 0.03, dir * 0.85, 0.08, -0.14, dir * 0.2, 0, -0.12,
      ])
      w.add(new THREE.Mesh(g, birdWingMat))
      return w
    }
    const lw = makeWing(-1)
    const rw = makeWing(1)
    lw.position.set(-0.05, 0.02, 0)
    rw.position.set(0.05, 0.02, 0)
    b.add(lw, rw)
    b.scale.setScalar(1.5)
    world.add(b)
    birds.push({ group: b, lw, rw, phase: i * 1.7, radius: 14 + i * 3.2, height: 11 + i * 1.6, speed: 0.06 + i * 0.012 })
  }

  const smokeTex = makeSmokeTexture()
  const smoke: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; t: number; x: number; z: number }[] = []
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })
    const sp = new THREE.Sprite(mat)
    const x = i % 2 ? -3.2 : -3.68
    const z = -1.4
    sp.position.set(x, 5.82, z)
    sp.scale.set(1, 1, 1)
    homesteadGroup.add(sp)
    smoke.push({ sprite: sp, mat, t: i * 1.6, x, z })
  }

  /* ------------------------------ 主题装配 ------------------------------ */
  homesteadGroup.visible = theme === 'homestead'
  waterGroup.visible = theme !== 'tower'
  waterExtra.visible = theme === 'water'
  towerGroup.visible = theme !== 'water'
  utilityGroup.visible = theme !== 'water'
  solarYard.visible = theme === 'tower'

  /* ------------------------------ 交互 ------------------------------ */
  type VehicleCtl = {
    info: DeviceInfo
    curve: THREE.CatmullRomCurve3
    routeLen: number
    height: number
    t: number
    running: boolean
    cruise: number
    live: number
    dist: number
  }
  const vehicles: Record<string, VehicleCtl> = {
    'robot-r07': {
      info: rInfo,
      curve: robotCurve,
      routeLen: robotRouteLen,
      height: 0.8,
      t: 0.05,
      running: true,
      cruise: 1.2,
      live: 1.2,
      dist: 0,
    },
    'solar-s01': {
      info: sInfo,
      curve: solarCurve,
      routeLen: cartRouteLen,
      height: 0.7,
      t: 0.16,
      running: true,
      cruise: 0.95,
      live: 0.95,
      dist: 0,
    },
  }
  const statusLabel = (v: VehicleCtl) => (v.running ? (v.info.kind === 'robot' ? '巡逻中' : '巡航中') : '已暂停')
  const syncSpeedMetric = (v: VehicleCtl) => {
    const m = v.info.metrics.find(x => x.label === '行驶速度')
    if (m) m.value = `${v.live.toFixed(1)} m/s`
  }
  let selected: number | null = null
  let growStart = performance.now()

  type CamTween = {
    p0: THREE.Vector3
    p1: THREE.Vector3
    t0: THREE.Vector3
    t1: THREE.Vector3
    start: number
    dur: number
  }
  let camTween: CamTween | null = null

  const flyTo = (pos: [number, number, number], target: [number, number, number], dur = 1.15) => {
    camTween = {
      p0: camera.position.clone(),
      p1: new THREE.Vector3(...pos),
      t0: controls.target.clone(),
      t1: new THREE.Vector3(...target),
      start: performance.now(),
      dur,
    }
  }

  let follow: { info: DeviceInfo; last: THREE.Vector3 } | null = null
  const startFollow = (info: DeviceInfo) => {
    const [x, y, z] = info.pos
    follow = { info, last: new THREE.Vector3(x, y, z) }
    flyTo([x + 3.6, Math.max(3.2, y + 2.6), z + 4.6], [x, y, z], 1.0)
  }
  const stopFollow = () => {
    follow = null
  }

  const doSelect = (id: number | null) => {
    selected = id
    plotObjs.forEach(o => {
      o.selectRing.visible = o.plot.id === id
      o.selectMat.opacity = id === o.plot.id ? 0.92 : 0
    })
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downPos: { x: number; y: number } | null = null
  const shownInTree = (o: THREE.Object3D) => {
    let n: THREE.Object3D | null = o
    while (n) {
      if (!n.visible) return false
      n = n.parent
    }
    return true
  }

  const onPointerDown = (e: PointerEvent) => {
    downPos = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!downPos) return
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
    downPos = null
    if (moved > 6 || e.button !== 0) return
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(pickables, false).filter(h => shownInTree(h.object))
    // 设备优先，其次地块，最后建筑（建筑代理盒体较大，避免挡住内部设备）
    const hit =
      hits.find(h => h.object.userData.deviceId) ||
      hits.find(h => h.object.userData.plotId) ||
      hits.find(h => h.object.userData.facilityId)
    if (!hit) {
      stopFollow()
      doSelect(null)
      options.onPlot?.(null)
      options.onPick?.(null)
      options.onFacility?.(null)
      return
    }
    const plotId = hit.object.userData.plotId as number | undefined
    const deviceId = hit.object.userData.deviceId as string | undefined
    const facilityId = hit.object.userData.facilityId as ParkFacilityId | undefined
    if (deviceId) {
      doSelect(null)
      options.onPlot?.(null)
      options.onFacility?.(null)
      const info = devices.find(d => d.id === deviceId)
      options.onPick?.(info ?? null)
      if (info && (info.kind === 'robot' || info.kind === 'solar')) startFollow(info)
      else stopFollow()
    } else if (plotId) {
      stopFollow()
      doSelect(plotId)
      options.onPlot?.(plotId)
      options.onPick?.(null)
      options.onFacility?.(null)
    } else if (facilityId) {
      stopFollow()
      doSelect(null)
      options.onPlot?.(null)
      options.onPick?.(null)
      options.onFacility?.(facilityId)
      const v = VIEWS[facilityId]
      flyTo(v.pos, v.target, 1.1)
    }
  }
  let hoverAt = 0
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const now = performance.now()
    if (now - hoverAt < 70) return
    hoverAt = now
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const active = raycaster
      .intersectObjects(pickables, false)
      .some(h => shownInTree(h.object) && (h.object.userData.plotId || h.object.userData.deviceId || h.object.userData.facilityId))
    renderer.domElement.style.cursor = active ? 'pointer' : ''
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointermove', onPointerMove)

  /* ------------------------------ 动画 ------------------------------ */
  const clock = new THREE.Clock()
  const animStart = performance.now()
  let raf = 0
  let robotYaw = 0
  let robotSpin = 0
  let cartYaw = 0
  let cartSpin = 0

  const tick = () => {
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    const t = (now - animStart) / 1000
    const dt = Math.min(clock.getDelta(), 0.05)

    if (camTween) {
      const k = clamp01((now - camTween.start) / (camTween.dur * 1000))
      const e = easeInOut(k)
      camera.position.lerpVectors(camTween.p0, camTween.p1, e)
      controls.target.lerpVectors(camTween.t0, camTween.t1, e)
      if (k >= 1) camTween = null
    }
    controls.update()

    waters.forEach(m => (m.uniforms.uTime.value = t))
    updateWind(t)

    grows.forEach(g => {
      const k = clamp01((now - growStart - g.delay) / 1400)
      if (k >= 1 && g.done) return
      const s = 0.2 + 0.8 * easeOut(k)
      g.items.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z)
        dummy.rotation.set(0, it.ry, 0)
        dummy.scale.setScalar(it.s * s)
        dummy.updateMatrix()
        g.mesh.setMatrixAt(i, dummy.matrix)
      })
      g.mesh.instanceMatrix.needsUpdate = true
      if (k >= 1) g.done = true
    })

    const rCtl = vehicles['robot-r07']
    if (rCtl.running) {
      const ta = rCtl.curve.getTangentAt(rCtl.t)
      const tb = rCtl.curve.getTangentAt((rCtl.t + 0.012) % 1)
      const turn = Math.acos(Math.min(1, Math.max(-1, ta.dot(tb))))
      rCtl.live = rCtl.cruise * (1 - 0.5 * Math.min(1, turn / 0.32))
      const meters = rCtl.live * dt
      rCtl.t = (rCtl.t + meters / rCtl.routeLen) % 1
      rCtl.dist += meters
      robotSpin += meters / 0.2
    } else {
      rCtl.live = 0
    }
    const rp = rCtl.curve.getPointAt(rCtl.t)
    const rt = rCtl.curve.getTangentAt(rCtl.t)
    const rtNext = rCtl.curve.getTangentAt((rCtl.t + 0.008) % 1)
    robotGroup.position.set(rp.x, 0.02, rp.z)
    const targetYaw = Math.atan2(rt.x, rt.z)
    const yawDelta = Math.atan2(Math.sin(targetYaw - robotYaw), Math.cos(targetYaw - robotYaw))
    robotYaw += yawDelta * Math.min(1, dt * 6)
    robotGroup.rotation.y = robotYaw
    const bend = rt.x * rtNext.z - rt.z * rtNext.x
    const roll = Math.max(-0.07, Math.min(0.07, bend * 0.25))
    robotBody.rotation.z += (roll - robotBody.rotation.z) * Math.min(1, dt * 4)
    robotBody.position.y = Math.sin(t * 8.5) * 0.006
    robotWheels.forEach(w => (w.rotation.x = robotSpin))
    robotHead.rotation.y = Math.sin(t * 0.72) * 0.55
    robotHead.rotation.x = 0.04 + Math.sin(t * 1.35) * 0.045
    robotBeaconMat.emissiveIntensity = 1.1 + (Math.sin(t * 4.2) + 1) * 0.35
    robotRingMat.opacity = 0.16 + (Math.sin(t * 2.1) + 1) * 0.08
    robotRing.scale.setScalar(1 + Math.sin(t * 2.1) * 0.05)
    rInfo.pos = [rp.x, 0.8, rp.z]

    const sCtl = vehicles['solar-s01']
    if (sCtl.running) {
      sCtl.live = sCtl.cruise
      const meters = sCtl.live * dt
      sCtl.t = (sCtl.t + meters / sCtl.routeLen) % 1
      sCtl.dist += meters
      cartSpin += meters / 0.17
    } else {
      sCtl.live = 0
    }
    const sp = sCtl.curve.getPointAt(sCtl.t)
    const st = sCtl.curve.getTangentAt(sCtl.t)
    const stNext = sCtl.curve.getTangentAt((sCtl.t + 0.01) % 1)
    cart2.position.set(sp.x, 0.02, sp.z)
    const cartTargetYaw = Math.atan2(st.x, st.z)
    const cartYawDelta = Math.atan2(Math.sin(cartTargetYaw - cartYaw), Math.cos(cartTargetYaw - cartYaw))
    cartYaw += cartYawDelta * Math.min(1, dt * 5)
    cart2.rotation.y = cartYaw
    const cartBend = st.x * stNext.z - st.z * stNext.x
    const cartRoll = Math.max(-0.05, Math.min(0.05, cartBend * 0.2))
    cartBody.rotation.z += (cartRoll - cartBody.rotation.z) * Math.min(1, dt * 4)
    cartBody.position.y = Math.sin(t * 9.2) * 0.005
    cartWheels.forEach(w => (w.rotation.x = cartSpin))
    cartBeaconMat.emissiveIntensity = 1.1 + (Math.sin(t * 3.6) + 1) * 0.35
    solarRingMat.opacity = 0.14 + (Math.sin(t * 1.7) + 1) * 0.07
    solarRing.scale.setScalar(1 + Math.sin(t * 1.7) * 0.045)
    sInfo.pos = [sp.x, 0.7, sp.z]

    if (follow) {
      const [fx, fy, fz] = follow.info.pos
      if (camTween) {
        camTween.p1.set(fx + 3.6, Math.max(3.2, fy + 2.6), fz + 4.6)
        camTween.t1.set(fx, fy, fz)
      } else {
        const dx = fx - follow.last.x
        const dy = fy - follow.last.y
        const dz = fz - follow.last.z
        camera.position.x += dx
        camera.position.y += dy
        camera.position.z += dz
        controls.target.x += dx
        controls.target.y += dy
        controls.target.z += dz
      }
      follow.last.set(fx, fy, fz)
    }

    trays.forEach((tray, i) => (tray.rotation.y = t * (0.18 + (i % 3) * 0.05)))
    ledMats.forEach((m, i) => (m.emissiveIntensity = 0.75 + Math.sin(t * 1.7 + i * 0.6) * 0.3))
    fans.forEach(f => (f.rotation.z += dt * 2.4))
    if (rotorState) rotorState.group.rotation.z += dt * 1.6
    cups.rotation.y += dt * 1.4

    ducks.forEach(d => {
      const a = t * d.speed * 2.2 + d.phase
      d.group.position.set(25.5 + Math.cos(a) * d.radius, 0.12 + Math.sin(t * 1.8 + d.phase) * 0.015, 19.5 + Math.sin(a) * d.radius)
      d.group.rotation.y = -a + Math.PI / 2
    })

    chickens.forEach(c => {
      c.head.rotation.x = 0.2 + Math.max(0, Math.sin(t * 2.4 + c.phase)) * 0.55
      c.group.position.y = Math.abs(Math.sin(t * 1.6 + c.phase)) * 0.012
    })

    birds.forEach(b => {
      const a = t * b.speed * 2 + b.phase
      b.group.position.set(Math.cos(a) * b.radius, b.height + Math.sin(t * 1.2 + b.phase) * 0.5, Math.sin(a) * b.radius * 0.7)
      b.group.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(t * 9 + b.phase) * 0.55
      b.lw.rotation.z = flap
      b.rw.rotation.z = -flap
    })

    smoke.forEach(sm => {
      sm.t += dt
      if (sm.t > 5.2) sm.t = 0
      const k = sm.t / 5.2
      sm.sprite.position.set(sm.x + Math.sin(sm.t * 0.7) * 0.5 + k * 0.9, 5.82 + k * 4.2, sm.z + (Math.cos(sm.t * 0.6) - 1) * 0.3)
      sm.sprite.scale.setScalar(0.8 + k * 2.8)
      sm.mat.opacity = Math.sin(Math.PI * k) * 0.36
    })

    alertSprites().forEach(({ mat, sprite, baseY, phase }) => {
      mat.opacity = 0.72 + Math.sin(t * 2.2 + phase) * 0.24
      sprite.position.y = baseY + Math.sin(t * 1.6 + phase) * 0.1
    })
    plotObjs.forEach((o, i) => {
      if (o.plot.status !== 4) return
      o.ringMat.opacity = 0.55 + Math.sin(t * 2 + i) * 0.3
    })
    if (selected != null) {
      plotObjs.forEach(o => {
        if (o.plot.id === selected) o.selectMat.opacity = 0.72 + Math.sin(t * 2.6) * 0.22
      })
    }

    deviceHandles.forEach((d, i) => {
      if (d.ringMat) d.ringMat.opacity = 0.26 + Math.sin(t * 1.9 + i * 0.8) * 0.12
    })

    renderer.render(scene, camera)
  }

  const alertInfo: { mat: THREE.SpriteMaterial; sprite: THREE.Sprite; baseY: number; phase: number }[] = []
  const alertSprites = () => {
    if (alertInfo.length) return alertInfo
    plotObjs.forEach((o, i) => {
      if (o.alertMat && o.alertSprite) alertInfo.push({ mat: o.alertMat, sprite: o.alertSprite, baseY: o.alertBaseY ?? 2.3, phase: i })
    })
    return alertInfo
  }

  tick()

  /* ------------------------------ 尺寸与销毁 ------------------------------ */
  const resize = () => {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(() => resize())
  ro.observe(host)

  const api: ParkApi = {
    focus: v => {
      stopFollow()
      flyTo(views[v].pos, views[v].target)
    },
    focusDevice: id => {
      const d = devices.find(x => x.id === id)
      if (!d) return
      stopFollow()
      const [x, y, z] = d.pos
      flyTo([x + 3.6, Math.max(3.2, y + 2.6), z + 4.6], [x, y, z], 1.0)
    },
    followDevice: id => {
      const d = devices.find(x => x.id === id)
      if (d) startFollow(d)
    },
    focusPlot: id => {
      const o = plotObjs.find(x => x.plot.id === id)
      if (!o) return
      stopFollow()
      doSelect(id)
      flyTo(
        [o.slot.x + 7.5, 7.6, o.slot.z + 9.5],
        [o.slot.x, 1.05, o.slot.z],
        1.15,
      )
    },
    selectPlot: id => {
      if (id === null) stopFollow()
      doSelect(id)
    },
    setPatrol: on => {
      Object.values(vehicles).forEach(v => {
        v.running = on
        v.info.status = statusLabel(v)
      })
    },
    replayGrowth: () => {
      growStart = performance.now()
      grows.forEach(g => (g.done = false))
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      controls.dispose()
      envRT.dispose()
      disposeObject(scene)
      renderer.dispose()
      renderer.domElement.remove()
    },
    devices: () => devices,
    vehicles: () =>
      Object.keys(vehicles).map(id => {
        const v = vehicles[id]
        return {
          id,
          name: v.info.name,
          running: v.running,
          cruise: v.cruise,
          live: v.live,
          progress: v.t,
          routeLen: v.routeLen,
          dist: v.dist,
          battery: v.info.battery,
          following: !!follow && follow.info.id === id,
        }
      }),
    setRunning: (id, on) => {
      const v = vehicles[id]
      if (!v || v.running === on) return
      v.running = on
      if (!on) v.live = 0
      v.info.status = statusLabel(v)
      syncSpeedMetric(v)
    },
    setCruise: (id, mps) => {
      const v = vehicles[id]
      if (!v) return
      v.cruise = Math.min(3, Math.max(0.2, mps))
      if (v.running) {
        v.live = v.cruise
        syncSpeedMetric(v)
      }
    },
    setProgress: (id, ratio) => {
      const v = vehicles[id]
      if (!v) return
      v.t = Math.min(0.9999, Math.max(0, ratio))
      const p = v.curve.getPointAt(v.t)
      v.info.pos = [p.x, v.height, p.z]
      if (follow && follow.info.id === id) {
        follow.last.set(p.x, v.height, p.z)
        flyTo([p.x + 3.6, Math.max(3.2, v.height + 2.6), p.z + 4.6], [p.x, v.height, p.z], 0.45)
      }
    },
    setFollow: id => {
      if (!id) {
        stopFollow()
        return
      }
      const v = vehicles[id]
      if (v) startFollow(v.info)
    },
  }

  ;(window as any).__park = { api, theme, scene, camera, controls, renderer, plots: plotObjs, devices }

  return api
}
