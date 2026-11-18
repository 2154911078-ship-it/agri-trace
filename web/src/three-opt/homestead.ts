import * as THREE from 'three'
import { makeFruitTreeGeometry } from '@/components/park/parkFlora'
import { mergeAll, paintGeo, rng } from '@/components/park/parkKit'

export interface HomesteadMats {
  stone: THREE.Material
  plaster: THREE.Material
  brick: THREE.Material
  wood: THREE.Material
  darkWood: THREE.Material
  metal: THREE.Material
  darkFrame: THREE.Material
  foliage: THREE.Material
}

export interface Chicken {
  group: THREE.Group
  head: THREE.Object3D
  phase: number
}

export interface HomesteadOutput {
  group: THREE.Group
  chickens: Chicken[]
}

function makePlateTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e8e2ce'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = '#3c504a'
  ctx.lineWidth = 6
  ctx.strokeRect(7, 7, 242, 114)
  ctx.fillStyle = '#3c504a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '22px serif'
  ctx.fillText('青禾农舍', 128, 32)
  ctx.font = 'bold 62px serif'
  ctx.fillText('06', 128, 81)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function makeTileRoofTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  const r = rng(607)
  ctx.fillStyle = '#58382c'
  ctx.fillRect(0, 0, 512, 512)
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 8; col++) {
      const x = col * 64 + (row % 2) * 32
      const y = row * 64
      const shade = Math.floor(r() * 14)
      const gradient = ctx.createLinearGradient(x, y, x + 64, y)
      gradient.addColorStop(0, `rgb(${105 + shade},${59 + shade},${42 + shade})`)
      gradient.addColorStop(0.35, `rgb(${148 + shade},${88 + shade},${62 + shade})`)
      gradient.addColorStop(1, `rgb(${119 + shade},${68 + shade},${48 + shade})`)
      ctx.fillStyle = gradient
      ctx.fillRect(x + 1, y + 2, 62, 59)
      ctx.fillStyle = 'rgba(238,190,142,0.22)'
      ctx.fillRect(x + 2, y + 57, 60, 3)
      ctx.fillStyle = 'rgba(45,28,21,0.25)'
      ctx.fillRect(x + 2, y + 2, 60, 4)
    }
  }
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(242,206,157,0.09)' : 'rgba(55,40,27,0.12)'
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function buildHomestead(mats: HomesteadMats): HomesteadOutput {
  const group = new THREE.Group()
  group.name = 'homestead'
  type Surface = 'stone' | 'plaster' | 'brick' | 'roof' | 'wood' | 'darkWood' | 'metal' | 'darkFrame' | 'brass' | 'plate' | 'glass' | 'flowers' | 'lamps' | 'recess'
  const pool: Record<Surface, THREE.BufferGeometry[]> = {
    stone: [], plaster: [], brick: [], roof: [], wood: [], darkWood: [], metal: [], darkFrame: [],
    brass: [], plate: [], glass: [], flowers: [], lamps: [], recess: [],
  }

  const roofMap = makeTileRoofTexture()
  const roofMat = new THREE.MeshStandardMaterial({ map: roofMap, bumpMap: roofMap, bumpScale: 0.024, roughness: 0.9 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xb6ccc3, transparent: true, opacity: 0.42, roughness: 0.22, metalness: 0.1,
    envMapIntensity: 0.7, side: THREE.DoubleSide, depthWrite: false,
  })
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xd1b184, emissive: 0xffb76a, emissiveIntensity: 0.25, roughness: 0.65 })
  const recessMat = new THREE.MeshStandardMaterial({ color: 0x29312c, roughness: 0.96 })
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xac8542, metalness: 0.55, roughness: 0.42 })
  const plateMat = new THREE.MeshStandardMaterial({ map: makePlateTexture(), roughness: 0.85 })
  const surfaces: Record<Surface, THREE.Material> = {
    stone: mats.stone, plaster: mats.plaster, brick: mats.brick, roof: roofMat,
    wood: mats.wood, darkWood: mats.darkWood, metal: mats.metal, darkFrame: mats.darkFrame,
    brass: brassMat, plate: plateMat, glass: glassMat, flowers: mats.foliage, lamps: lampMat, recess: recessMat,
  }
  for (const key of ['stone', 'plaster', 'brick', 'wood', 'darkWood'] as const) {
    const mat = (surfaces[key] as THREE.MeshStandardMaterial).clone()
    if (mat.map) {
      mat.map = mat.map.clone()
      mat.map.repeat.set(1, 1)
      mat.map.needsUpdate = true
    }
    surfaces[key] = mat
  }
  const uvScale: Partial<Record<Surface, [number, number]>> = {
    stone: [3.2, 2.4], plaster: [4, 3], brick: [3.1, 1.8], wood: [1.8, 2.5], darkWood: [1.8, 2.5], roof: [3.2, 2.8],
  }
  const projectUV = (g: THREE.BufferGeometry, key: Surface) => {
    const scale = uvScale[key]
    if (!scale) return
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const uv = new Float32Array(p.count * 2)
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i))
      uv[i * 2] = (nx > nz && nx > ny ? p.getZ(i) : p.getX(i)) / scale[0]
      uv[i * 2 + 1] = (ny > nx && ny > nz ? p.getZ(i) : p.getY(i)) / scale[1]
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  const place = (key: Surface, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0) => {
    const masonry = key === 'stone' || key === 'brick' || key === 'plaster'
    if (!masonry) projectUV(g, key)
    g.rotateX(rx)
    g.rotateY(ry)
    g.translate(x, y, z)
    // 砌缝采用统一尺寸与原点，不随墙段、柱子或台阶拉伸。
    if (masonry) projectUV(g, key)
    pool[key].push(g)
  }
  const box = (key: Surface, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0) => {
    place(key, new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx)
  }
  const cyl = (key: Surface, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 10, rz = 0) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg)
    g.rotateZ(rz)
    place(key, g, x, y, z)
  }
  const plane = (key: Surface, w: number, h: number, x: number, y: number, z: number, ry = 0, rx = 0) => {
    place(key, new THREE.PlaneGeometry(w, h), x, y, z, ry, rx)
  }

  const HW = 10.6, HD = 7.2, floorY = 0.55
  const roofRun = HD / 2 + 0.5, ridgeY = 4.95, eaveY = 3.4
  const slope = Math.atan2(ridgeY - eaveY, roofRun)
  const slabLen = Math.hypot(roofRun, ridgeY - eaveY)
  const roofY = (z: number) => ridgeY - Math.abs(z) * Math.tan(slope)
  const underside = (z: number) => roofY(z) - 0.075 / Math.cos(slope)
  const wallTop = underside(HD / 2)
  box('stone', 11.2, floorY, 7.8, 0, floorY / 2, 0)

  type Opening = { x: number; y: number; w: number; h: number }
  const frontWindows = [{ x: -3.35, y: 2.15, w: 1.15, h: 1.25 }, { x: 3.3, y: 2.15, w: 1.15, h: 1.25 }]
  const wall = (key: 'plaster' | 'brick', width: number, bottom: number, top: number, x: number, z: number, ry: number, windows: Opening[], door = false) => {
    const outline = new THREE.Shape()
    outline.moveTo(-width / 2, bottom)
    if (door) {
      outline.lineTo(-0.2, bottom)
      outline.lineTo(-0.2, Math.min(top, 2.84))
      outline.lineTo(1.3, Math.min(top, 2.84))
      outline.lineTo(1.3, bottom)
    }
    outline.lineTo(width / 2, bottom)
    outline.lineTo(width / 2, top)
    outline.lineTo(-width / 2, top)
    outline.closePath()
    for (const win of windows) {
      const hole = new THREE.Path()
      hole.moveTo(win.x - win.w / 2, win.y - win.h / 2)
      hole.lineTo(win.x - win.w / 2, win.y + win.h / 2)
      hole.lineTo(win.x + win.w / 2, win.y + win.h / 2)
      hole.lineTo(win.x + win.w / 2, win.y - win.h / 2)
      hole.closePath()
      outline.holes.push(hole)
    }
    const g = new THREE.ExtrudeGeometry(outline, { depth: 0.26, bevelEnabled: false, steps: 1, curveSegments: 1 })
    g.translate(0, 0, -0.26)
    place(key, g, x, 0, z, ry)
  }
  for (const key of ['brick', 'plaster'] as const) {
    const bottom = key === 'brick' ? floorY : 1.04
    const top = key === 'brick' ? 1.04 : wallTop
    const windows = key === 'plaster'
    if (windows) {
      wall(key, HW, bottom, top, 0, HD / 2, 0, frontWindows, true)
    } else {
      for (const [left, right] of [[-HW / 2, -0.2], [1.3, HW / 2]]) {
        box(key, right - left, top - bottom, 0.26, (left + right) / 2, (bottom + top) / 2, HD / 2 - 0.13)
      }
    }
    wall(key, HW, bottom, top, 0, -HD / 2, Math.PI, [])
    wall(key, HD - 0.52, bottom, top, HW / 2, 0, Math.PI / 2, windows ? [{ x: 1.2, y: 2.1, w: 1.15, h: 1.25 }] : [])
    wall(key, HD - 0.52, bottom, top, -HW / 2, 0, -Math.PI / 2, windows ? [{ x: 1, y: 2.1, w: 1.15, h: 1.25 }] : [])
  }
  for (const dir of [-1, 1]) {
    const gable = new THREE.Shape()
    gable.moveTo(-HD / 2, wallTop)
    gable.lineTo(HD / 2, wallTop)
    gable.lineTo(0, underside(0))
    gable.closePath()
    const g = new THREE.ExtrudeGeometry(gable, { depth: 0.26, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -0.26)
    place('plaster', g, dir * HW / 2, 0, 0, dir * Math.PI / 2)
    box('darkWood', 0.07, 0.55, 0.68, dir * (HW / 2 + 0.02), 4.02, 0)
    for (let i = 0; i < 4; i++) box('wood', 0.09, 0.035, 0.57, dir * (HW / 2 + 0.06), 3.83 + i * 0.12, 0)
    box('roof', HW + 1.1, 0.15, slabLen, 0, (ridgeY + eaveY) / 2, dir * roofRun / 2, 0, dir * slope)
    box('darkWood', HW + 1.14, 0.16, 0.12, 0, eaveY - 0.1, dir * roofRun)
    box('wood', HW + 1.1, 0.08, 0.48, 0, eaveY - 0.16, dir * (roofRun - 0.18))
    for (const sx of [-1, 1]) {
      box('darkWood', 0.12, 0.16, slabLen + 0.03, sx * (HW / 2 + 0.57), (ridgeY + eaveY) / 2 - 0.03, dir * roofRun / 2, 0, dir * slope)
    }
  }
  cyl('roof', 0.14, 0.14, HW + 1.2, 0, ridgeY + 0.03, 0, 12, Math.PI / 2)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box('stone', 0.28, 2.35, 0.1, sx * (HW / 2 - 0.14), 2.215, sz * (HD / 2 + 0.018))
    box('stone', 0.1, 2.35, 0.28, sx * (HW / 2 + 0.018), 2.215, sz * (HD / 2 - 0.14))
  }

  const addWindow = (x: number, y: number, z: number, ry: number, flowerBox = false) => {
    const w = 1.15, h = 1.25
    const localBox = (key: Surface, bw: number, bh: number, bd: number, bx: number, by: number, bz: number) => {
      const g = new THREE.BoxGeometry(bw, bh, bd)
      g.translate(bx, by, bz)
      place(key, g, x, y, z, ry)
    }
    const localPlane = (key: Surface, pw: number, ph: number, px: number, py: number, pz: number) => {
      const g = new THREE.PlaneGeometry(pw, ph)
      g.translate(px, py, pz)
      place(key, g, x, y, z, ry)
    }
    localPlane('recess', w, h, 0, 0, -0.255)
    for (const side of [-1, 1]) {
      localPlane('plaster', 0.25, h - 0.13, side * 0.4, 0.02, -0.19)
      localBox('darkWood', 0.09, h + 0.16, 0.15, side * (w / 2 + 0.02), 0, -0.015)
      localBox('darkWood', w + 0.04, 0.09, 0.15, 0, side * (h / 2 + 0.02), -0.015)
    }
    localBox('wood', 0.04, h, 0.07, 0, 0, 0.015)
    localBox('wood', w, 0.04, 0.07, 0, 0, 0.015)
    localPlane('glass', w - 0.04, h - 0.04, 0, 0, -0.04)
    localBox('stone', w + 0.28, 0.1, 0.33, 0, -h / 2 - 0.1, 0.06)
    localBox('stone', w + 0.25, 0.1, 0.19, 0, h / 2 + 0.13, -0.015)
    if (flowerBox) {
      localBox('darkWood', w + 0.12, 0.25, 0.045, 0, -h / 2 - 0.29, 0.5)
      for (const side of [-1, 1]) localBox('darkWood', 0.045, 0.25, 0.45, side * (w / 2 + 0.04), -h / 2 - 0.29, 0.3)
      const soil = new THREE.PlaneGeometry(w + 0.04, 0.4)
      soil.rotateX(-Math.PI / 2)
      soil.translate(0, -h / 2 - 0.18, 0.28)
      place('recess', soil, x, y, z, ry)
      for (let i = 0; i < 3; i++) {
        const height = [0.28, 0.35, 0.3][i]
        const stem = new THREE.CylinderGeometry(0.007, 0.01, height, 3)
        stem.translate(0, height / 2, 0)
        paintGeo(stem, '#5f7d45', 0)
        const parts: THREE.BufferGeometry[] = [stem]
        for (let j = 0; j < 5; j++) {
          const petal = new THREE.CircleGeometry(0.07, 6)
          petal.scale(0.65, 1, 1)
          petal.translate(0, 0.055, 0)
          petal.rotateX(-Math.PI / 2 + 0.3)
          petal.rotateY(j * Math.PI * 2 / 5 + i * 0.4)
          petal.translate(0, height, 0)
          paintGeo(petal, i % 2 ? '#d6ae56' : '#eee4c8', 0)
          parts.push(petal)
        }
        const center = new THREE.SphereGeometry(0.023, 5, 3)
        center.translate(0, height + 0.012, 0)
        paintGeo(center, '#b98832', 0)
        parts.push(center)
        for (const side of [-1, 1]) {
          const leaf = new THREE.CircleGeometry(0.075, 5)
          leaf.scale(0.45, 1, 1)
          leaf.translate(0, 0.06, 0)
          leaf.rotateX(-0.6)
          leaf.rotateZ(side * 0.9)
          leaf.translate(0, height * 0.42, 0)
          paintGeo(leaf, '#68844b', 0)
          parts.push(leaf)
        }
        for (const part of parts) {
          part.translate((i - 1) * 0.35, -h / 2 - 0.18, 0.38)
          place('flowers', part, x, y, z, ry)
        }
      }
    }
  }
  addWindow(-3.35, 2.15, HD / 2, 0, true)
  addWindow(3.3, 2.15, HD / 2, 0, true)
  addWindow(HW / 2, 2.1, -1.2, Math.PI / 2)
  addWindow(-HW / 2, 2.1, 1, -Math.PI / 2)

  const dz = HD / 2
  box('darkWood', 1.5, 2.29, 0.1, 0.55, 1.695, dz - 0.07)
  for (const y of [1.18, 2.19]) box('wood', 1.18, 0.73, 0.035, 0.55, y, dz - 0.005)
  for (const x of [-0.25, 1.35]) box('darkWood', 0.12, 2.38, 0.19, x, 1.73, dz + 0.02)
  box('darkWood', 1.72, 0.13, 0.19, 0.55, 2.86, dz + 0.02)
  box('stone', 1.75, 0.08, 0.32, 0.55, floorY + 0.02, dz + 0.035)
  box('brass', 0.055, 0.18, 0.018, 0.05, 1.52, dz + 0.02)
  box('brass', 0.16, 0.028, 0.055, 0.105, 1.55, dz + 0.048)
  for (const y of [0.92, 2.44]) box('metal', 0.16, 0.065, 0.035, 1.24, y, dz + 0.008)
  plane('plate', 0.56, 0.28, 1.86, 1.96, dz + 0.015)

  box('stone', 2.7, floorY, 1.45, 0.55, floorY / 2, dz + 0.68)
  box('stone', 2.7, floorY * 2 / 3, 0.36, 0.55, floorY / 3, dz + 1.585)
  box('stone', 2.9, floorY / 3, 0.36, 0.55, floorY / 6, dz + 1.945)
  const porchSlope = 0.14, porchZ = dz + 0.66, porchY = 3.1
  box('roof', 2.95, 0.11, 1.5, 0.55, porchY, porchZ, 0, porchSlope)
  const beamZ = dz + 1.23
  const beamTop = porchY - (beamZ - porchZ) * Math.tan(porchSlope) - 0.055 / Math.cos(porchSlope)
  const beamBottom = beamTop - 0.14
  box('darkWood', 2.95, 0.14, 0.15, 0.55, beamTop - 0.07, beamZ)
  for (const x of [-0.62, 1.72]) {
    box('stone', 0.24, 0.15, 0.24, x, floorY + 0.075, beamZ)
    box('wood', 0.14, beamBottom - floorY - 0.15, 0.14, x, (beamBottom + floorY + 0.15) / 2, beamZ)
    const brace = new THREE.BoxGeometry(0.42, 0.075, 0.085)
    brace.rotateZ((x < 0.55 ? 1 : -1) * Math.PI / 4)
    place('darkWood', brace, x + (x < 0.55 ? 0.16 : -0.16), beamBottom - 0.16, beamZ)
  }
  for (const x of [-0.72, 1.82]) {
    box('lamps', 0.16, 0.24, 0.16, x, 2.56, dz + 0.31)
    for (const y of [2.42, 2.7]) box('metal', 0.2, 0.035, 0.2, x, y, dz + 0.31)
    box('metal', 0.04, 0.17, 0.04, x, 2.785, dz + 0.31)
    box('metal', 0.04, 0.05, 0.32, x, 2.865, dz + 0.16)
  }

  box('metal', 1.04, 0.04, 1.1, -3.45, roofY(-1.4) + 0.11, -1.4, 0, -slope)
  box('brick', 0.78, 1.65, 0.78, -3.45, 4.455, -1.4)
  box('brick', 0.9, 0.13, 0.9, -3.45, 5.28, -1.4)
  box('stone', 0.98, 0.12, 0.98, -3.45, 5.405, -1.4)
  for (const x of [-3.68, -3.2]) cyl('metal', 0.1, 0.12, 0.36, x, 5.62, -1.4, 8)

  for (const [a, b] of [[-6.7, -1.7], [1.7, 6.7]]) {
    box('stone', b - a, 1.02, 0.32, (a + b) / 2, 0.51, 9.25)
    box('stone', b - a + 0.06, 0.1, 0.42, (a + b) / 2, 1.07, 9.25)
  }
  for (const x of [-6.7, 6.7]) {
    box('stone', 0.32, 1.02, 5.55, x, 0.51, 6.48)
    box('stone', 0.42, 0.1, 5.6, x, 1.07, 6.48)
  }
  for (const x of [-1.7, 1.7]) {
    box('stone', 0.5, 1.7, 0.5, x, 0.85, 9.25)
    box('stone', 0.7, 0.12, 0.7, x, 1.76, 9.25)
    box('stone', 0.56, 0.14, 0.56, x, 1.89, 9.25)
  }
  box('darkWood', 4.0, 0.14, 0.24, 0, 2.03, 9.25)
  for (const dir of [-1, 1]) {
    const width = 1.34, height = 1.43, hingeX = dir * 1.34, hingeZ = 9.17
    const angle = -dir * 0.95
    const leaf = (key: Surface, g: THREE.BufferGeometry) => {
      g.translate(-dir * width / 2, 0.845, 0)
      place(key, g, hingeX, 0, hingeZ, angle)
    }
    leaf('wood', new THREE.BoxGeometry(width, height, 0.055))
    for (const y of [-0.51, 0.51]) {
      const rail = new THREE.BoxGeometry(width - 0.12, 0.085, 0.045)
      rail.translate(0, y, 0.045)
      leaf('darkWood', rail)
    }
    const brace = new THREE.BoxGeometry(1.36, 0.075, 0.035)
    brace.rotateZ(dir * 0.69)
    brace.translate(0, 0, 0.045)
    leaf('darkWood', brace)
    for (const y of [0.34, 1.36]) {
      cyl('metal', 0.035, 0.035, 0.13, hingeX, y, hingeZ, 6)
      box('metal', 0.18, 0.06, 0.055, dir * 1.42, y, hingeZ)
    }
    const latch = new THREE.BoxGeometry(0.08, 0.045, 0.055)
    latch.translate(-dir * (width / 2 - 0.12), 0.12, 0.04)
    leaf('metal', latch)
  }

  const well = new THREE.LatheGeometry([
    new THREE.Vector2(0.78, 0), new THREE.Vector2(0.74, 0.78), new THREE.Vector2(0.79, 0.84),
    new THREE.Vector2(0.79, 0.94), new THREE.Vector2(0.59, 0.94), new THREE.Vector2(0.59, 0.55),
  ], 16)
  place('stone', well, -5.1, 0, 5.4)
  const water = new THREE.CircleGeometry(0.59, 16)
  place('recess', water, -5.1, 0.57, 5.4, 0, -Math.PI / 2)
  for (const dx of [-0.65, 0.65]) box('wood', 0.11, 1.55, 0.11, -5.1 + dx, 0.94, 5.4)
  box('roof', 1.75, 0.09, 1.1, -5.1, 1.76, 5.4, 0, 0.12)
  cyl('wood', 0.055, 0.055, 1.48, -5.1, 1.34, 5.4, 8, Math.PI / 2)
  cyl('metal', 0.012, 0.012, 0.52, -5.0, 1.08, 5.4, 5)
  cyl('darkWood', 0.13, 0.1, 0.19, -5.0, 0.82, 5.4, 8)
  box('wood', 1.5, 0.9, 1.0, -5.8, 0.45, 7.9)
  box('roof', 1.8, 0.09, 1.25, -5.8, 0.98, 7.9, 0, -0.09)
  plane('recess', 0.4, 0.4, -5.8, 0.3, 8.405)
  for (let i = 0; i < 9; i++) cyl('darkWood', 0.075, 0.075, 1.3, 6.0 + (i % 3) * 0.18, 0.1 + Math.floor(i / 3) * 0.15, 2.8 + (i % 2) * 0.2, 6, Math.PI / 2)

  const persimmon = new THREE.Mesh(makeFruitTreeGeometry(9, 1.05, '#d98332'), mats.foliage)
  persimmon.position.set(8.3, 0, 4.6)
  persimmon.castShadow = true
  persimmon.receiveShadow = true
  group.add(persimmon)

  for (const key of Object.keys(pool) as Surface[]) {
    if (!pool[key].length) continue
    const mesh = new THREE.Mesh(mergeAll(pool[key]), surfaces[key])
    mesh.name = `homestead-${key}`
    mesh.castShadow = !['glass', 'recess', 'plate'].includes(key)
    mesh.receiveShadow = true
    if (key === 'glass') mesh.renderOrder = 1
    group.add(mesh)
    for (const geo of pool[key]) if (geo !== mesh.geometry) geo.dispose()
  }

  const chickenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 })
  const chickens: Chicken[] = []
  const chickenSpots: [number, number][] = [[2.9, 7.6], [2.5, 6.1], [4.1, 5.1], [2.2, 8.4]]
  chickenSpots.forEach(([x, z], i) => {
    const c = new THREE.Group()
    c.position.set(x, 0, z)
    c.rotation.y = i * 1.4
    const color = i % 2 ? '#e8e2d2' : '#b9824b'
    const body = new THREE.SphereGeometry(0.17, 8, 6)
    body.scale(1, 0.9, 1.25)
    body.translate(0, 0.28, 0)
    paintGeo(body, color, 0)
    const bodyParts: THREE.BufferGeometry[] = [body]
    for (const sx of [-0.06, 0.06]) {
      const leg = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5)
      leg.translate(sx, 0.09, 0)
      paintGeo(leg, '#d9a441', 0)
      bodyParts.push(leg)
    }
    const bodyMesh = new THREE.Mesh(mergeAll(bodyParts), chickenMat)
    bodyMesh.castShadow = true
    c.add(bodyMesh)
    const skull = new THREE.SphereGeometry(0.09, 7, 5)
    paintGeo(skull, color, 0)
    const beak = new THREE.ConeGeometry(0.035, 0.09, 5)
    beak.rotateX(Math.PI / 2)
    beak.translate(0, -0.01, 0.11)
    paintGeo(beak, '#d9a441', 0)
    const comb = new THREE.SphereGeometry(0.035, 5, 4)
    comb.translate(0, 0.09, 0.02)
    paintGeo(comb, '#b6432f', 0)
    const head = new THREE.Mesh(mergeAll([skull, beak, comb]), chickenMat)
    head.position.set(0, 0.42, 0.16)
    c.add(head)
    for (const geo of [...bodyParts, skull, beak, comb]) geo.dispose()
    group.add(c)
    chickens.push({ group: c, head, phase: i * 1.9 })
  })
  return { group, chickens }
}
