/**
 * 风过草野 · 原版草地漫游（搬进登录页左栏用）
 *
 * 这份逻辑原样来自 D:\桌面\local-dsh\main.js（风过草野那页），
 * 只做了三件事：把 canvas 改成自己创建、尺寸跟随传入的容器、
 * 去掉那一页专属的 DOM（暂停徽标 / 空格键 / 纸边裁切）。
 * 画面参数、图层顺序、运动方程一个都没动。
 */

import * as THREE from 'three'
import {
  W,
  H,
  TILE,
  TAU,
  buildTerrainTexture,
  createAnimalSheet,
  createBikeSheet,
  createPlaneTexture,
  createPlaneShadowTexture,
  createCloudTexture,
  createCloudShadowTexture,
  createSoftShadowTexture,
  roadCenter,
} from './meadow-art'

export interface Meadow {
  setPaused(v: boolean): boolean
  isPaused(): boolean
  setTime(t: number): void
  resize(): void
  dispose(): void
}

export function createMeadow(host: HTMLElement): Meadow {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 1600)
  camera.position.set(W / 2, H / 2, 800)
  camera.lookAt(W / 2, H / 2, 0)
  camera.updateProjectionMatrix()

  const unitPlane = new THREE.PlaneGeometry(1, 1)

  const worldY = (screenY: number) => H - screenY
  const wrap = (value: number, min: number, max: number) => {
    const span = max - min
    return (((value - min) % span) + span) % span + min
  }
  const shortestAngle = (from: number, to: number) => {
    let d = (to - from + Math.PI) % TAU
    if (d < 0) d += TAU
    return d - Math.PI
  }
  const damp = (current: number, target: number, rate: number, dt: number) =>
    current + (target - current) * (1 - Math.exp(-rate * dt))

  function layerMesh(
    texture: THREE.Texture,
    width: number,
    height: number,
    order: number,
    { opacity = 1, color = 0xffffff }: { opacity?: number; color?: number } = {}
  ) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      color,
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(unitPlane, material)
    mesh.scale.set(width, height, 1)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    scene.add(mesh)
    return mesh
  }

  /* ---------------- 地形 ---------------- */

  const SCROLL_SPEED = 27
  const terrainTexture = buildTerrainTexture()
  const terrainMaterial = new THREE.MeshBasicMaterial({
    map: terrainTexture,
    transparent: false,
    depthTest: false,
    depthWrite: false,
  })
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(W, TILE), terrainMaterial)
  terrain.name = 'terrain'
  terrain.position.set(W / 2, H / 2, 0)
  terrain.renderOrder = 0
  scene.add(terrain)

  /* ---------------- 动物 ---------------- */

  const animalSheets = {
    brown: createAnimalSheet('brown', 4701),
    black: createAnimalSheet('black', 8801),
    sheep: createAnimalSheet('sheep', 3307),
  }
  const softShadowTexture = createSoftShadowTexture()
  const animalShadowMaterial = new THREE.MeshBasicMaterial({
    map: softShadowTexture,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
  })

  const animalDefs = [
    { type: 'brown', x: 858, y: 334, size: 91, speed: 0.16, phase: 0.4, rx: 15, ry: 10 },
    { type: 'black', x: 902, y: 698, size: 88, speed: 0.13, phase: 2.1, rx: 13, ry: 12 },
    { type: 'sheep', x: 950, y: 430, size: 73, speed: 0.2, phase: 4.4, rx: 11, ry: 8 },
    { type: 'brown', x: 336, y: 506, size: 90, speed: 0.14, phase: 1.2, rx: 14, ry: 12 },
    { type: 'sheep', x: 410, y: 420, size: 72, speed: 0.24, phase: 3.0, rx: 10, ry: 9 },
    { type: 'black', x: 354, y: 864, size: 86, speed: 0.17, phase: 5.3, rx: 12, ry: 10 },
    { type: 'sheep', x: 82, y: 592, size: 71, speed: 0.21, phase: 0.8, rx: 9, ry: 8 },
    { type: 'brown', x: 72, y: 286, size: 87, speed: 0.15, phase: 2.8, rx: 12, ry: 9 },
  ] as const

  const animals = animalDefs.map((def, index) => {
    const texture = (animalSheets as Record<string, THREE.Texture>)[def.type].clone()
    texture.needsUpdate = true
    texture.offset.set(0, 0)

    const body = layerMesh(texture, def.size, def.size, 14)
    const shadow = layerMesh(softShadowTexture, def.size * 0.72, def.size * 0.92, 12)
    shadow.material = animalShadowMaterial
    body.name = `animal-${index}-body`
    shadow.name = `animal-${index}-shadow`

    return {
      ...def,
      texture,
      body,
      shadow,
      frame: 0,
      angle: 0,
      visible: true,
      yHome: def.y + 512,
    }
  })

  /* ---------------- 骑车人 ---------------- */

  const bikeTexture = createBikeSheet()
  const bikeSize = 94
  const bike = layerMesh(bikeTexture, bikeSize, bikeSize, 10)
  const bikeShadow = layerMesh(softShadowTexture, bikeSize * 0.42, bikeSize * 0.66, 8)
  bike.name = 'cyclist'
  bikeShadow.name = 'cyclist-shadow'
  bikeShadow.material = new THREE.MeshBasicMaterial({
    map: softShadowTexture,
    transparent: true,
    opacity: 0.63,
    depthTest: false,
    depthWrite: false,
  })
  bikeShadow.material.color.setHex(0x273522)

  const BIKE_SCREEN_Y = 674
  let bikeX = roadCenter((BIKE_SCREEN_Y + 512) % TILE)
  let bikeAngle = 0

  /* ---------------- 飞机 ---------------- */

  const planeTexture = createPlaneTexture()
  const planeShadowTexture = createPlaneShadowTexture()
  const planeSize = 118
  const planeMesh = layerMesh(planeTexture, planeSize, planeSize, 36)
  planeMesh.name = 'aeroplane'
  const planeGroundShadow = layerMesh(planeShadowTexture, 138, 138, 12)
  planeGroundShadow.name = 'aeroplane-ground-shadow'
  planeGroundShadow.material.opacity = 0.24
  planeGroundShadow.material.color.setHex(0x1f2b22)

  // ---- 航线：一路向上，直飞与 S 弯交替 ----
  // 竖向永远向上推进（y 只减不增），横向按「I 段直飞 → S 段平滑换道」循环，
  // 到顶后从底部淡入重来，所以永远朝前飞、绝不倒退掉头。
  const ROUTE = {
    x0: 472, // 第一条航线的横向位置
    x1: 552, // 换道后的位置
    straight: 150, // I 型直飞长度
    bend: 240, // S 型弯飞长度
    speed: 14, // 每秒上升像素（越慢飞得越久）
    yStart: 900, // 底部起点
    yTop: 120, // 顶部淡出线
    fade: 60, // 首尾淡入淡出长度
  }
  const CYCLE = ROUTE.straight + ROUTE.bend
  const TRAVEL = ROUTE.yStart - ROUTE.yTop // 780
  const LAP = CYCLE * 2 // 必须与 TRAVEL 相等于，否则顶部会硬跳

  /** 沿航线第 d 个像素处的位置，切线用解析导数（不跨接缝取差分，机头永不上飘） */
  function pathAt(d: number) {
    const dd = ((d % LAP) + LAP) % LAP
    const cycle = Math.floor(dd / CYCLE)
    const u = dd - cycle * CYCLE
    const from = cycle === 0 ? ROUTE.x0 : ROUTE.x1
    const to = cycle === 0 ? ROUTE.x1 : ROUTE.x0
    const span = to - from

    let x = from
    let dx = 0
    if (u > ROUTE.straight) {
      const p = Math.min(1, (u - ROUTE.straight) / ROUTE.bend)
      x = from + span * p * p * (3 - 2 * p) // smoothstep：两端斜率为 0，接直飞不折
      dx = (span * 6 * p * (1 - p)) / ROUTE.bend
    }

    const len = Math.hypot(dx, 1)
    // 纵向用全局行程 dd（不是单段 u），才能一次性从底飞到顶
    return { x, y: ROUTE.yStart - dd, tx: dx / len, ty: -1 / len }
  }

  if (LAP !== TRAVEL) console.warn('[meadow] 航线长度与竖直行程不一致:', LAP, TRAVEL)

  /** 只取位置（自检用） */
  function pointAt(d: number) {
    const p = pathAt(d)
    return { x: p.x, y: p.y }
  }

  /** 顶部/底部淡出，遮住循环接缝 */
  function edgeFade(y: number) {
    const nearBottom = (ROUTE.yStart - y) / ROUTE.fade
    const nearTop = (y - ROUTE.yTop) / ROUTE.fade
    return Math.max(0, Math.min(1, Math.min(nearBottom, nearTop)))
  }

  const plane = { x: ROUTE.x0, y: ROUTE.yStart, angle: 0, bank: 0, d: 0 }

  /* ---------------- 云 ---------------- */

  const cloudDefs = [
    { name: 'centre', seed: 90210, textureW: 620, textureH: 412, wide: 1.13, width: 500, x: 522, y: 642, kind: 'centre' },
    { name: 'left-high', seed: 91111, textureW: 460, textureH: 300, wide: 1.0, width: 304, x: 106, y: 232, kind: 'drift', phase: 1.7, ax: 16, ay: 9, sx: 0.018, sy: 0.014 },
    { name: 'right-high', seed: 92341, textureW: 460, textureH: 300, wide: 1.17, width: 374, x: 910, y: 170, kind: 'drift', phase: 4.2, ax: 21, ay: 11, sx: 0.014, sy: 0.019 },
    { name: 'left-low', seed: 93517, textureW: 460, textureH: 300, wide: 0.93, width: 230, x: 24, y: 742, kind: 'drift', phase: 2.6, ax: 14, ay: 10, sx: 0.022, sy: 0.012 },
    { name: 'right-low', seed: 94777, textureW: 460, textureH: 300, wide: 0.88, width: 286, x: 974, y: 870, kind: 'drift', phase: 5.1, ax: 18, ay: 8, sx: 0.017, sy: 0.016 },
    { name: 'left-edge', seed: 95813, textureW: 420, textureH: 280, wide: 0.8, width: 186, x: 52, y: 476, kind: 'drift', phase: 0.9, ax: 9, ay: 7, sx: 0.013, sy: 0.018 },
    { name: 'right-edge', seed: 97123, textureW: 420, textureH: 280, wide: 0.82, width: 174, x: 985, y: 560, kind: 'drift', phase: 3.6, ax: 10, ay: 6, sx: 0.019, sy: 0.013 },
  ]

  type Cloud = {
    mesh: THREE.Mesh
    shadow: THREE.Mesh
    width: number
    displayH: number
    x: number
    y: number
    kind: string
    baseX: number
    baseY: number
    cx: number
    cy: number
    phase?: number
    ax?: number
    ay?: number
    sx?: number
    sy?: number
  }

  const clouds: Cloud[] = []
  let centreCloud: Cloud | null = null

  for (const def of cloudDefs) {
    const { canvas: cloudCanvas, texture } = createCloudTexture(def.seed, def.textureW, def.textureH, def.wide)
    const displayH = def.width * (def.textureH / def.textureW)
    const mesh = layerMesh(texture, def.width, displayH, 30, { opacity: 0.975 })
    mesh.name = `cloud-${def.name}`
    mesh.frustumCulled = false

    const shadowTexture = createCloudShadowTexture(cloudCanvas)
    const shadowW = def.width * (shadowTexture.image.width / def.textureW)
    const shadowH = displayH * (shadowTexture.image.height / def.textureH)
    const shadow = layerMesh(shadowTexture, shadowW, shadowH, 20)
    shadow.name = `cloud-shadow-${def.name}`
    shadow.material.opacity = 0.33
    shadow.material.color.setHex(0xffffff)

    const cloud: Cloud = {
      mesh,
      shadow,
      width: def.width,
      displayH,
      x: def.x,
      y: def.y,
      kind: def.kind,
      baseX: def.x,
      baseY: def.y,
      cx: def.x,
      cy: def.y,
      phase: (def as any).phase,
      ax: (def as any).ax,
      ay: (def as any).ay,
      sx: (def as any).sx,
      sy: (def as any).sy,
    }
    if (def.kind === 'centre') {
      centreCloud = cloud
      mesh.material.opacity = 0.96
    }
    clouds.push(cloud)
  }

  const centre = centreCloud as Cloud

  /* ---------------- 机影落在云面上 ---------------- */

  const cloudPlaneShadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uCloud: { value: (centre.mesh.material as THREE.MeshBasicMaterial).map },
      uPlane: { value: planeShadowTexture },
      uPlaneCenter: { value: new THREE.Vector2(512, worldY(650)) },
      uPlaneRot: { value: 0 },
      uPlaneSize: { value: new THREE.Vector2(138, 138) },
      uStrength: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xy;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uCloud;
      uniform sampler2D uPlane;
      uniform vec2 uPlaneCenter;
      uniform float uPlaneRot;
      uniform vec2 uPlaneSize;
      uniform float uStrength;
      varying vec2 vUv;
      varying vec2 vWorld;

      void main() {
        float cloudAlpha = texture2D(uCloud, vUv).a;
        float mask = smoothstep(0.16, 0.58, cloudAlpha);
        if (mask < 0.001 || uStrength < 0.001) discard;

        vec2 d = vWorld - (uPlaneCenter + vec2(7.0, -13.0));
        float c = cos(-uPlaneRot);
        float s = sin(-uPlaneRot);
        vec2 rotated = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
        vec2 shadowUv = rotated / uPlaneSize + 0.5;
        float inside = step(0.0, shadowUv.x) * step(shadowUv.x, 1.0)
                     * step(0.0, shadowUv.y) * step(shadowUv.y, 1.0);
        float shadowAlpha = texture2D(uPlane, clamp(shadowUv, 0.0, 1.0)).a;
        float a = shadowAlpha * mask * inside * uStrength * 0.54;
        gl_FragColor = vec4(vec3(0.145, 0.195, 0.165), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  const cloudPlaneShadow = new THREE.Mesh(unitPlane, cloudPlaneShadowMaterial)
  cloudPlaneShadow.name = 'aeroplane-shadow-on-cloud'
  cloudPlaneShadow.scale.set(centre.width, centre.displayH, 1)
  cloudPlaneShadow.position.set(centre.x, worldY(centre.y), 0)
  cloudPlaneShadow.renderOrder = 33
  cloudPlaneShadow.frustumCulled = false
  scene.add(cloudPlaneShadow)

  /* ---------------- 尺寸 ---------------- */

  let size = 1
  function resize() {
    // 登录页左栏不是正方形（878×900、手机上 390×320），
    // 所以按宽度定标、纵向按比例撑开视锥，画面不会被拉扁。
    const cw = Math.max(1, host.clientWidth)
    const ch = Math.max(1, host.clientHeight)
    size = Math.round(cw)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(cw, ch, false)

    const halfH = (H / 2) * (ch / cw)
    camera.left = -W / 2
    camera.right = W / 2
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()

    canvas.style.width = '100%'
    canvas.style.height = '100%'
  }

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  /* ---------------- 状态 ---------------- */

  const state = { time: 0, paused: false }
  let disposed = false
  let raf = 0
  let last = performance.now()

  const visibleForY = (y: number, margin = 90) => y > -margin && y < H + margin

  function updateAnimals(time: number, dt: number) {
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i]
      const screenY = wrap(a.yHome - 512 + time * SCROLL_SPEED, -150, 1150)
      const wx = Math.sin(time * a.speed + a.phase) * a.rx
      const wy = Math.sin(time * a.speed * 0.79 + a.phase * 1.7 + 0.6) * a.ry
      const x = a.x + wx
      const y = screenY + wy

      a.body.position.set(x, worldY(y), 0)
      a.shadow.position.set(x + a.size * 0.14, worldY(y + a.size * 0.17), 0)

      const vx = Math.cos(time * a.speed + a.phase) * a.rx * a.speed
      const vy = Math.cos(time * a.speed * 0.79 + a.phase * 1.7 + 0.6) * a.ry * a.speed * 0.79
      if (Math.abs(vx) + Math.abs(vy) > 0.035) {
        const target = Math.atan2(-vx, -vy)
        a.angle += shortestAngle(a.angle, target) * (1 - Math.exp(-2.2 * dt))
      }

      a.body.rotation.z = a.angle
      a.shadow.rotation.z = a.angle

      const frame = Math.floor(time * (5.2 + (i % 3) * 0.45) + i * 1.7) % 8
      if (frame !== a.frame) {
        a.frame = frame
        a.texture.offset.x = frame / 8
      }

      const onStage = visibleForY(y, 110)
      a.body.visible = onStage
      a.shadow.visible = onStage
      a.visible = onStage
    }
  }

  function updateBike(time: number, dt: number) {
    const imageY = (BIKE_SCREEN_Y + 512 - time * SCROLL_SPEED + TILE * 1000) % TILE
    const targetX = roadCenter(imageY)
    bikeX = damp(bikeX, targetX, 8.5, dt)

    const d = (roadCenter((imageY + 4 + TILE) % TILE) - roadCenter((imageY - 4 + TILE) % TILE)) / 8
    const targetAngle = Math.atan2(d, 1)
    bikeAngle += shortestAngle(bikeAngle, targetAngle) * (1 - Math.exp(-4.8 * dt))

    bike.position.set(bikeX, worldY(BIKE_SCREEN_Y), 0)
    bike.rotation.z = bikeAngle
    bikeShadow.position.set(bikeX + 14, worldY(BIKE_SCREEN_Y + 19), 0)
    bikeShadow.rotation.z = bikeAngle

    const frame = Math.floor(time * 8.4) % 8
    bikeTexture.offset.x = frame / 8
  }

  function updatePlane(time: number, dt: number) {
    // 沿航线匀速上升：d 只增不减。
    plane.d += ROUTE.speed * dt
    const p = pathAt(plane.d)

    plane.x = p.x
    plane.y = p.y

    // 机头 = 切线方向（精灵默认朝上）
    const targetAngle = Math.atan2(-p.tx, -p.ty)
    plane.angle = targetAngle

    // 前方 12px 的切线夹角 → 正在直飞还是正在弯飞
    const ahead = pathAt(plane.d + 26)
    const turn = shortestAngle(targetAngle, Math.atan2(-ahead.tx, -ahead.ty))
    const bankTarget = Math.max(-0.75, Math.min(0.75, turn * 8))
    plane.bank = damp(plane.bank, bankTarget, 3.2, dt)

    // 顶部淡出、底部淡入，接缝看不见
    const fade = edgeFade(plane.y)

    const bankScale = 1 - Math.abs(plane.bank) * 0.085
    planeMesh.position.set(plane.x, worldY(plane.y), 0)
    planeMesh.rotation.z = plane.angle + plane.bank * 0.02
    planeMesh.scale.set(planeSize * bankScale, planeSize, 1)
    planeMesh.visible = fade > 0.15
    ;(planeMesh.material as THREE.MeshBasicMaterial).opacity = fade

    planeGroundShadow.position.set(plane.x + 26, worldY(plane.y + 42), 0)
    planeGroundShadow.rotation.z = plane.angle
    planeGroundShadow.visible = fade > 0.15

    const nx = (plane.x - centre.cx) / (centre.width * 0.39)
    const ny = (plane.y - centre.cy) / (centre.displayH * 0.36)
    const inside = Math.max(0, 1 - Math.sqrt(nx * nx + ny * ny))
    const overlap = Math.min(1, inside * 1.8) * fade

    planeGroundShadow.material.opacity = Math.max(0.085, 0.236 * (1 - overlap * 0.92)) * fade

    cloudPlaneShadow.visible = overlap > 0.012
    cloudPlaneShadowMaterial.uniforms.uPlaneCenter.value.set(plane.x, worldY(plane.y))
    cloudPlaneShadowMaterial.uniforms.uPlaneRot.value = plane.angle
    cloudPlaneShadowMaterial.uniforms.uPlaneSize.value.set(
      planeSize * (planeShadowTexture.image.width / planeTexture.image.width),
      planeSize * (planeShadowTexture.image.height / planeTexture.image.height)
    )
    cloudPlaneShadowMaterial.uniforms.uStrength.value = overlap
  }

  function updateClouds(time: number) {
    for (const c of clouds) {
      if (c.kind === 'centre') {
        c.cx = 522 + Math.sin(time * 0.043 + 0.8) * 18
        c.cy = 748 + Math.sin(time * 0.052 - 0.35) * 325
        ;(c.mesh.material as THREE.MeshBasicMaterial).opacity = 0.96
      } else {
        c.cx = c.baseX + Math.sin(time * (c.sx as number) + (c.phase as number)) * (c.ax as number)
        c.cy = c.baseY + Math.sin(time * (c.sy as number) + (c.phase as number) * 1.6) * (c.ay as number)
      }

      c.mesh.position.set(c.cx, worldY(c.cy), 0)
      c.shadow.position.set(c.cx + c.width * 0.105, worldY(c.cy + c.displayH * 0.17), 0)
      c.shadow.rotation.z = 0
    }

    cloudPlaneShadow.position.set(centre.cx, worldY(centre.cy), 0)
    cloudPlaneShadow.scale.set(centre.width, centre.displayH, 1)
  }

  function render(time: number, dt: number) {
    terrainTexture.offset.y = ((time * SCROLL_SPEED) / TILE) % 1
    updateAnimals(time, dt)
    updateBike(time, dt)
    updatePlane(time, dt)
    updateClouds(time)
    renderer.render(scene, camera)
  }

  function loop(now: number) {
    if (disposed) return
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
    last = now
    if (state.paused) {
      render(state.time, 0)
      return
    }
    state.time += dt
    render(state.time, dt)
  }

  render(0, 0.016)
  raf = requestAnimationFrame(loop)

  // 开发态自检钩子（生产构建会被摇掉）
  if (import.meta.env.DEV) {
    ;(window as any).__meadow = { plane, pathAt, pointAt, LAP, TRAVEL, ROUTE, edgeFade, state, planeMesh }
  }

  return {
    setPaused(v: boolean) {
      state.paused = v
      last = performance.now()
      return state.paused
    },
    isPaused: () => state.paused,
    setTime(t: number) {
      state.time = Math.max(0, Number(t) || 0)
      render(state.time, 0)
    },
    resize,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      const kill = (obj: THREE.Mesh) => {
        const mt = obj.material as THREE.Material & { map?: THREE.Texture }
        mt.map?.dispose()
        mt.dispose()
      }
      scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) kill(o as THREE.Mesh)
      })
      unitPlane.dispose()
      terrain.geometry.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}