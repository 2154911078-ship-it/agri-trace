import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export { RoundedBoxGeometry, mergeGeometries }

/* ==========================================================================
   程序化材质 / 几何工具
   - 所有贴图都在 Canvas 里现画，零外部资源
   - 叶、瓦、地面细节都复用同一套低多边形几何，方便合并与实例化
   ========================================================================== */

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function canvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat: [number, number] = [1, 1],
) {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  const ctx = el.getContext('2d') as CanvasRenderingContext2D
  draw(ctx)
  const t = new THREE.CanvasTexture(el)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  return t
}

function flecks(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  colors: string[],
  r: () => number,
  radius: [number, number] = [0.5, 2.2],
) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]
    ctx.beginPath()
    ctx.ellipse(
      r() * size,
      r() * size,
      radius[0] + r() * (radius[1] - radius[0]),
      radius[0] + r() * (radius[1] - radius[0]),
      r() * Math.PI,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}

export function makeSoilTexture(seed = 17) {
  return canvasTex(512, 512, ctx => {
    const r = rng(seed)
    ctx.fillStyle = '#7a5a41'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 70; i++) {
      const cx = r() * 512
      const cy = r() * 512
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + r() * 120)
      g.addColorStop(0, r() > 0.5 ? 'rgba(104,78,54,0.20)' : 'rgba(58,40,27,0.18)')
      g.addColorStop(1, 'rgba(90,64,44,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 512)
    }
    flecks(ctx, 512, 1400, ['rgba(52,35,23,0.30)', 'rgba(116,88,60,0.32)', 'rgba(150,120,86,0.20)'], r, [0.4, 2.8])
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(165,143,112,0.34)' : 'rgba(45,32,21,0.32)'
      ctx.beginPath()
      ctx.ellipse(r() * 512, r() * 512, 1.2 + r() * 3.2, 0.8 + r() * 2, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    // 细碎根须 / 秸秆
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(176,152,116,${0.06 + r() * 0.1})`
      ctx.lineWidth = 0.6 + r() * 0.7
      const x = r() * 512
      const y = r() * 512
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + (r() - 0.5) * 16, y + 5 + r() * 13, x + (r() - 0.5) * 22, y + 12 + r() * 26)
      ctx.stroke()
    }
  }, [2, 2])
}

export function makePlasterTexture() {
  return canvasTex(512, 512, ctx => {
    const r = rng(41)
    ctx.fillStyle = '#efece2'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 90; i++) {
      const x = r() * 512
      const y = r() * 512
      const rad = 16 + r() * 90
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, r() > 0.5 ? 'rgba(201,193,174,0.13)' : 'rgba(255,255,250,0.18)')
      g.addColorStop(1, 'rgba(220,214,198,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 512)
    }
    // 雨痕
    for (let i = 0; i < 22; i++) {
      const x = r() * 512
      const w = 1 + r() * 4
      const g = ctx.createLinearGradient(0, 0, 0, 512)
      g.addColorStop(0, 'rgba(164,158,140,0.09)')
      g.addColorStop(1, 'rgba(164,158,140,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, w, 200 + r() * 290)
    }
    flecks(ctx, 512, 500, ['rgba(190,183,164,0.25)', 'rgba(255,255,255,0.22)'], r, [0.4, 1.6])
    // 极细裂纹
    ctx.strokeStyle = 'rgba(167,160,142,0.16)'
    ctx.lineWidth = 0.7
    for (let i = 0; i < 9; i++) {
      let x = r() * 512
      let y = r() * 512
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 46
        y += r() * 32
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }, [2, 1])
}

export function makeWoodTexture() {
  return canvasTex(512, 512, ctx => {
    const r = rng(83)
    ctx.fillStyle = '#806344'
    ctx.fillRect(0, 0, 512, 512)
    const plank = 64
    for (let x = 0; x < 512; x += plank) {
      ctx.fillStyle = r() > 0.5 ? '#876a48' : '#765a3d'
      ctx.fillRect(x + 2, 0, plank - 4, 512)
      ctx.fillStyle = 'rgba(52,37,24,0.5)'
      ctx.fillRect(x, 0, 2, 512)
      ctx.fillStyle = 'rgba(255,235,200,0.055)'
      ctx.fillRect(x + 3, 0, 2, 512)
      for (let i = 0; i < 46; i++) {
        const gx = x + 5 + r() * (plank - 10)
        ctx.strokeStyle = `rgba(${r() > 0.5 ? '60,43,27' : '166,132,92'},${0.06 + r() * 0.12})`
        ctx.lineWidth = 0.6 + r() * 1.1
        ctx.beginPath()
        ctx.moveTo(gx, r() * 512)
        ctx.bezierCurveTo(gx + (r() - 0.5) * 8, 140 + r() * 100, gx + (r() - 0.5) * 9, 300 + r() * 100, gx + (r() - 0.5) * 6, 512)
        ctx.stroke()
      }
      if (r() > 0.6) {
        const kx = x + 14 + r() * (plank - 28)
        const ky = 60 + r() * 390
        ctx.strokeStyle = 'rgba(60,41,25,0.32)'
        ctx.lineWidth = 1.4
        for (let k = 1; k < 4; k++) {
          ctx.beginPath()
          ctx.ellipse(kx, ky, k * 2.1, k * 3.2, 0.3, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
  }, [1, 2])
}

export function makeStoneTexture() {
  return canvasTex(512, 512, ctx => {
    const r = rng(137)
    ctx.fillStyle = '#8f8a7a'
    ctx.fillRect(0, 0, 512, 512)
    ctx.strokeStyle = 'rgba(64,60,50,0.32)'
    ctx.lineWidth = 2
    let y = 0
    let row = 0
    while (y < 512) {
      const h = 26 + r() * 18
      let x = row % 2 === 0 ? -20 : -60
      while (x < 512) {
        const w = 38 + r() * 46
        const tone = 130 + r() * 42
        ctx.fillStyle = `rgb(${tone + 12},${tone + 8},${tone - 6})`
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 4 + r() * 6)
        ctx.fill()
        ctx.strokeStyle = 'rgba(66,61,51,0.30)'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,245,0.07)'
        ctx.fillRect(x + 6, y + 4, w - 12, 2)
        x += w
      }
      y += h
      row++
    }
    flecks(ctx, 512, 700, ['rgba(60,55,45,0.22)', 'rgba(214,208,190,0.20)'], r, [0.4, 1.6])
  }, [2, 1])
}

export function makeBrickTexture() {
  return canvasTex(512, 512, ctx => {
    const r = rng(211)
    ctx.fillStyle = '#8d8072'
    ctx.fillRect(0, 0, 512, 512)
    let row = 0
    for (let y = 0; y < 512; y += 42) {
      const off = row++ % 2 === 0 ? 0 : -52
      for (let x = off; x < 512; x += 104) {
        const tone = 132 + r() * 34
        ctx.fillStyle = `rgb(${tone + 26},${tone - 12},${tone - 38})`
        ctx.fillRect(x + 3, y + 3, 98, 36)
        ctx.fillStyle = 'rgba(255,235,215,0.07)'
        ctx.fillRect(x + 5, y + 4, 94, 2)
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = `rgba(70,50,40,${0.06 + r() * 0.12})`
          ctx.fillRect(x + 5 + r() * 90, y + 6 + r() * 28, 1 + r() * 3, 1 + r() * 2)
        }
      }
    }
    flecks(ctx, 512, 400, ['rgba(60,46,36,0.18)', 'rgba(214,190,164,0.16)'], r, [0.4, 1.4])
  }, [2, 2])
}

export function makeRoofTexture() {
  return canvasTex(512, 512, ctx => {
    const r = rng(307)
    ctx.fillStyle = '#48504b'
    ctx.fillRect(0, 0, 512, 512)
    for (let x = 0; x < 512; x += 22) {
      ctx.fillStyle = 'rgba(23,30,27,0.42)'
      ctx.fillRect(x, 0, 4, 512)
      ctx.fillStyle = 'rgba(158,168,158,0.08)'
      ctx.fillRect(x + 6, 0, 3, 512)
    }
    for (let y = 0; y < 512; y += 52) {
      ctx.fillStyle = 'rgba(20,26,23,0.28)'
      ctx.fillRect(0, y, 512, 3)
      ctx.fillStyle = 'rgba(210,216,206,0.05)'
      ctx.fillRect(0, y + 3, 512, 2)
    }
    flecks(ctx, 512, 800, ['rgba(18,24,21,0.3)', 'rgba(128,138,128,0.16)', 'rgba(74,84,76,0.34)'], r, [0.5, 2.4])
  }, [3, 2])
}

export function makeStrataTexture() {
  return canvasTex(1024, 512, ctx => {
    const r = rng(419)
    const bands: [number, string, string][] = [
      [0.1, '#5f4a33', '#4b3927'],
      [0.34, '#8c6a48', '#7a5a3d'],
      [0.62, '#9b7653', '#87613f'],
      [0.82, '#7a6c5d', '#66594c'],
      [1, '#6b645a', '#57514a'],
    ]
    let last = 0
    for (const [to, top, bottom] of bands) {
      const g = ctx.createLinearGradient(0, last * 512, 0, to * 512)
      g.addColorStop(0, top)
      g.addColorStop(1, bottom)
      ctx.fillStyle = g
      ctx.fillRect(0, last * 512, 1024, (to - last) * 512)
      // 层线
      ctx.strokeStyle = 'rgba(48,38,28,0.36)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = 0; x <= 1024; x += 24) {
        const y = last * 512 + Math.sin(x * 0.017 + last * 9) * 3
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      last = to
    }
    // 剖面石块 / 根系
    for (let i = 0; i < 160; i++) {
      const y = 120 + r() * 390
      ctx.fillStyle = `rgba(${88 + r() * 50},${80 + r() * 40},${66 + r() * 36},${0.22 + r() * 0.3})`
      ctx.beginPath()
      ctx.ellipse(r() * 1024, y, 3 + r() * 13, 2 + r() * 7, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(62,47,32,0.4)'
    for (let i = 0; i < 80; i++) {
      const x = r() * 1024
      const y = r() * 90
      ctx.lineWidth = 0.6 + r() * 1.4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + (r() - 0.5) * 22, y + 20 + r() * 30, x + (r() - 0.5) * 34, y + 30 + r() * 55)
      ctx.stroke()
    }
    flecks(ctx, 1024, 900, ['rgba(40,32,24,0.22)', 'rgba(190,170,140,0.12)'], r, [0.5, 2.4])
  })
}

export function makeMulchTexture() {
  return canvasTex(256, 256, ctx => {
    const r = rng(523)
    ctx.fillStyle = '#373b33'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = r() > 0.55 ? `rgba(210,214,200,${0.05 + r() * 0.16})` : `rgba(16,20,16,${0.08 + r() * 0.2})`
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3.5, 1 + r() * 2)
    }
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(225,228,216,${0.05 + r() * 0.1})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(r() * 256, r() * 256)
      ctx.lineTo(r() * 256, r() * 256)
      ctx.stroke()
    }
  }, [2, 2])
}

export function makeSolarTexture() {
  return canvasTex(128, 128, ctx => {
    ctx.fillStyle = '#29496b'
    ctx.fillRect(0, 0, 128, 128)
    const r = rng(411)
    for (let y = 0; y < 128; y += 16) {
      for (let x = 0; x < 128; x += 16) {
        ctx.fillStyle = `rgba(${42 + r() * 24},${82 + r() * 34},${124 + r() * 34},0.5)`
        ctx.fillRect(x + 1, y + 1, 14, 14)
      }
    }
    ctx.strokeStyle = 'rgba(154,205,240,0.62)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 128; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 128)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(128, i)
      ctx.stroke()
    }
    const g = ctx.createLinearGradient(0, 0, 128, 128)
    g.addColorStop(0, 'rgba(190,226,250,0.38)')
    g.addColorStop(0.45, 'rgba(100,150,200,0.06)')
    g.addColorStop(1, 'rgba(245,250,255,0.2)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  })
}

export function makeSoftCircleTexture() {
  return canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62)
    g.addColorStop(0, 'rgba(33,44,29,0.6)')
    g.addColorStop(0.5, 'rgba(33,44,29,0.26)')
    g.addColorStop(1, 'rgba(33,44,29,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  })
}

export function makeSmokeTexture() {
  return canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60)
    g.addColorStop(0, 'rgba(248,246,240,0.55)')
    g.addColorStop(0.45, 'rgba(228,226,218,0.24)')
    g.addColorStop(1, 'rgba(210,208,200,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(64, 64, 60, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function makeSkyTexture() {
  return canvasTex(1024, 512, ctx => {
    const r = rng(601)
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#9fc4de')
    g.addColorStop(0.34, '#bcd6e0')
    g.addColorStop(0.52, '#e0e9e2')
    g.addColorStop(0.64, '#f4ecdc')
    g.addColorStop(1, '#e4e3d8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 512)
    // 极淡的云带
    for (let i = 0; i < 26; i++) {
      const x = r() * 1024
      const y = 90 + r() * 150
      const w = 60 + r() * 210
      const h = 8 + r() * 26
      const cg = ctx.createRadialGradient(x, y, 0, x, y, w)
      cg.addColorStop(0, `rgba(255,255,252,${0.14 + r() * 0.16})`)
      cg.addColorStop(0.55, `rgba(250,251,247,${0.07 + r() * 0.08})`)
      cg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, h / w)
      ctx.translate(-x, -y)
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.arc(x, y, w, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // 地平线暖光
    const hg = ctx.createRadialGradient(512, 340, 20, 512, 340, 460)
    hg.addColorStop(0, 'rgba(255,238,204,0.30)')
    hg.addColorStop(1, 'rgba(255,238,204,0)')
    ctx.fillStyle = hg
    ctx.fillRect(0, 180, 1024, 300)
  })
}

export function makeEnvTexture() {
  return canvasTex(512, 256, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#cfe2ea')
    g.addColorStop(0.46, '#eef1e8')
    g.addColorStop(0.52, '#d8d3c2')
    g.addColorStop(1, '#8e957f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 256)
    const sun = ctx.createRadialGradient(150, 76, 2, 150, 76, 60)
    sun.addColorStop(0, 'rgba(255,250,232,0.95)')
    sun.addColorStop(0.25, 'rgba(255,240,205,0.35)')
    sun.addColorStop(1, 'rgba(255,240,205,0)')
    ctx.fillStyle = sun
    ctx.fillRect(60, 0, 200, 180)
  })
}

/* ------------------------------- 几何 ------------------------------- */

export function makeLeafGeometry(len = 1, width = 0.34, curl = 0.12) {
  const w = width * 0.5
  const positions = new Float32Array([
    0, 0, 0,
    -w, len * 0.33, curl * 0.35,
    w, len * 0.33, curl * 0.35,
    -w * 0.72, len * 0.7, curl * 0.8,
    w * 0.72, len * 0.7, curl * 0.8,
    0, len, curl,
  ])
  const idx = [0, 1, 3, 0, 3, 5, 0, 5, 4, 0, 4, 2, 1, 2, 4, 1, 4, 3, 3, 4, 5]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const uv = new Float32Array([0.5, 0, 0, 0.4, 1, 0.4, 0.16, 0.72, 0.84, 0.72, 0.5, 1])
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(idx)
  const out = geo.toNonIndexed()
  geo.dispose()
  out.computeVertexNormals()
  return out
}

export function makeHalfPipeGeometry(length = 1, radius = 0.08, segments = 6) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI
    const x = Math.cos(a) * radius
    const y = Math.sin(a) * radius
    positions.push(x, y, 0, x, y, length)
    uvs.push(i / segments, 0, i / segments, 1)
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, c, b, b, c, d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  const out = geo.toNonIndexed()
  geo.dispose()
  out.computeVertexNormals()
  return out
}

export function paintGeo(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0.06) {
  const pos = geo.getAttribute('position')
  if (!pos) return geo
  const base = new THREE.Color(color)
  const arr = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    // 位置哈希，保证同一模型每次生成的颜色一致
    const h = Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453
    const k = 1 + ((h - Math.floor(h)) * 2 - 1) * jitter
    c.copy(base).multiplyScalar(k)
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

function normaliseGeo(geo: THREE.BufferGeometry) {
  let g = geo.index ? geo.toNonIndexed() : geo
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name)
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  if (!g.getAttribute('uv')) {
    const n = g.getAttribute('position').count
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  }
  if (!g.getAttribute('color')) {
    const n = g.getAttribute('position').count
    const arr = new Float32Array(n * 3).fill(1)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }
  g.clearGroups()
  return g
}

export function mergeAll(list: THREE.BufferGeometry[]) {
  const geos = list.map(normaliseGeo).filter(Boolean)
  if (!geos.length) return new THREE.BufferGeometry()
  if (geos.length === 1) return geos[0]
  const merged = mergeGeometries(geos, false)
  if (!merged) throw new Error('parkKit: mergeGeometries failed')
  return merged
}

export function setShadows(root: THREE.Object3D, cast = true, receive = true) {
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = cast
      m.receiveShadow = receive
    }
  })
  return root
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) {
      mat.forEach((x) => {
        const any = x as THREE.MeshStandardMaterial
        any.map?.dispose()
        if (any.emissiveMap) any.emissiveMap.dispose()
        x.dispose()
      })
    } else if (mat) {
      const any = mat as THREE.MeshStandardMaterial
      any.map?.dispose()
      if (any.emissiveMap) any.emissiveMap.dispose()
      mat.dispose()
    }
  })
}
