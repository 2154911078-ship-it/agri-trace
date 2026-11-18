import * as THREE from 'three'
import { makeLeafGeometry, mergeAll, paintGeo, rng } from './parkKit'

/* ==========================================================================
   植被与作物几何
   - 每个函数返回一份带顶点色的合并几何，供 InstancedMesh / Mesh 复用
   - 叶、果、枝全部程序化，不依赖外部模型
   ========================================================================== */

const UP = new THREE.Vector3(0, 1, 0)
const BASE_LEAF = makeLeafGeometry(1, 0.34, 0.13)
const TMP_Q = new THREE.Quaternion()
const TMP_M = new THREE.Matrix4()
const TMP_S = new THREE.Vector3()

function leaf(
  list: THREE.BufferGeometry[],
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  width: number,
  color: THREE.ColorRepresentation,
  roll = 0,
) {
  const g = BASE_LEAF.clone()
  const d = dir.clone().normalize()
  TMP_Q.setFromUnitVectors(UP, d)
  if (roll) {
    const rq = new THREE.Quaternion().setFromAxisAngle(d, roll)
    TMP_Q.premultiply(rq)
  }
  TMP_S.set((len * width) / 0.34, len, len)
  TMP_M.compose(origin, TMP_Q, TMP_S)
  g.applyMatrix4(TMP_M)
  paintGeo(g, color, 0.1)
  list.push(g)
}

function blade(
  list: THREE.BufferGeometry[],
  base: THREE.Vector3,
  lean: THREE.Vector3,
  len: number,
  width: number,
  color: THREE.ColorRepresentation,
  curl = 0.3,
  twist = 0,
  segments = 4,
) {
  const side = new THREE.Vector3(-lean.z, 0, lean.x)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  if (twist) side.applyAxisAngle(new THREE.Vector3(0, 1, 0), twist)
  const positions: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const y = base.y + len * t
    const bend = curl * len * t * t
    const cx = base.x + lean.x * bend
    const cz = base.z + lean.z * bend
    const w = width * Math.max(0.06, 1 - t * 0.94)
    positions.push(cx - side.x * w * 0.5, y, cz - side.z * w * 0.5)
    positions.push(cx + side.x * w * 0.5, y, cz + side.z * w * 0.5)
  }
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  paintGeo(g, color, 0.1)
  list.push(g)
}

function branch(
  list: THREE.BufferGeometry[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  r0: number,
  r1: number,
  color: THREE.ColorRepresentation,
  radial = 5,
) {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  if (len < 0.001) return
  const g = new THREE.CylinderGeometry(Math.max(0.006, r1), Math.max(0.008, r0), len, radial, 1)
  g.translate(0, len / 2, 0)
  TMP_Q.setFromUnitVectors(UP, dir.clone().normalize())
  g.applyQuaternion(TMP_Q)
  g.translate(from.x, from.y, from.z)
  paintGeo(g, color, 0.05)
  list.push(g)
}

function blob(
  list: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: THREE.ColorRepresentation,
  detail = 1,
) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  g.scale(sx, sy, sz)
  g.translate(x, y, z)
  paintGeo(g, color, 0.07)
  list.push(g)
}

function pickColor(r: () => number, colors: string[]) {
  return colors[Math.min(colors.length - 1, Math.floor(r() * colors.length))]
}

/* ------------------------------- 乔木 ------------------------------- */

export function makeBroadleafGeometry(seed = 1, scale = 1, density = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const h = (3.2 + r() * 0.8) * scale
  const trunkR = 0.19 * scale
  const barks = ['#64503a', '#6d573f', '#5b4833', '#735d45']
  const bark = pickColor(r, barks)

  // 根部扩展，让树干自然扎进地面
  const flare = new THREE.CylinderGeometry(trunkR * 1.08, trunkR * 1.45, 0.3 * scale, 9, 1)
  flare.translate(0, 0.15 * scale, 0)
  paintGeo(flare, bark, 0.07)
  list.push(flare)

  // 两段主干，轻微弯曲
  const bend = new THREE.Vector3((r() - 0.5) * 0.16 * scale, h * 0.34, (r() - 0.5) * 0.16 * scale)
  const top = new THREE.Vector3(bend.x + (r() - 0.5) * 0.22 * scale, h * 0.62, bend.z + (r() - 0.5) * 0.22 * scale)
  branch(list, new THREE.Vector3(0, 0.02 * scale, 0), bend, trunkR * 1.02, trunkR * 0.82, bark, 7)
  branch(list, bend, top, trunkR * 0.82, trunkR * 0.56, bark, 7)

  // 主枝 + 分叉
  const n = 5 + Math.floor(r() * 2)
  const tips: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6
    const reach = (0.95 + r() * 0.6) * scale
    const base = new THREE.Vector3(bend.x * 0.5, h * (0.34 + r() * 0.15), bend.z * 0.5)
    const mid = new THREE.Vector3(Math.cos(a) * reach * 0.55, h * (0.54 + r() * 0.1), Math.sin(a) * reach * 0.55)
    const tip = new THREE.Vector3(Math.cos(a) * reach, h * (0.66 + r() * 0.16), Math.sin(a) * reach)
    branch(list, base, mid, trunkR * 0.5, trunkR * 0.26, bark, 5)
    branch(list, mid, tip, trunkR * 0.25, trunkR * 0.1, bark, 4)
    tips.push(tip)
    for (let k = 0; k < 2; k++) {
      const ta = a + (k ? 0.6 : -0.6) + (r() - 0.5) * 0.5
      const twig = tip.clone().add(new THREE.Vector3(
        Math.cos(ta) * (0.45 + r() * 0.4),
        0.2 + r() * 0.35,
        Math.sin(ta) * (0.45 + r() * 0.4),
      ))
      branch(list, tip, twig, trunkR * 0.09, trunkR * 0.035, bark, 3)
      tips.push(twig)
    }
  }

  const cy = h * 0.82
  const rx = (1.55 + r() * 0.4) * scale
  const ry = (0.95 + r() * 0.3) * scale
  const rz = (1.45 + r() * 0.4) * scale
  const darks = ['#37602e', '#3f6733', '#476f38', '#4f783d']
  const mids = ['#578643', '#5f8e48', '#67984f', '#709f56']
  const lights = ['#7bab5e', '#86b268', '#92ba72', '#9cc17d']

  // 内部暗色团块撑起冠部体积
  for (let i = 0; i < Math.max(3, Math.round(6 * density)); i++) {
    const a = r() * Math.PI * 2
    const rad = (0.12 + r() * 0.5) * scale
    blob(
      list,
      Math.cos(a) * rx * rad * 0.8,
      cy + (r() - 0.55) * ry * 0.7,
      Math.sin(a) * rz * rad * 0.8,
      rx * (0.34 + r() * 0.16),
      ry * (0.34 + r() * 0.16),
      rz * (0.34 + r() * 0.16),
      pickColor(r, darks),
      1,
    )
  }
  // 外围团簇，打散球形轮廓
  const outerBlobCount = Math.max(5, Math.round(11 * density))
  for (let i = 0; i < outerBlobCount; i++) {
    const a = (i / outerBlobCount) * Math.PI * 2 + r() * 0.4
    const rad = 0.5 + r() * 0.3
    blob(
      list,
      Math.cos(a) * rx * rad,
      cy + (r() - 0.35) * ry * 0.55,
      Math.sin(a) * rz * rad,
      rx * (0.15 + r() * 0.11),
      ry * (0.15 + r() * 0.09),
      rz * (0.15 + r() * 0.11),
      pickColor(r, mids),
      1,
    )
  }

  const leafCount = Math.round((340 + Math.floor(r() * 80)) * density)
  for (let i = 0; i < leafCount; i++) {
    const a = r() * Math.PI * 2
    const b = Math.acos(2 * r() - 1)
    const rad = 0.5 + Math.pow(r(), 0.4) * 0.5
    const px = Math.sin(b) * Math.cos(a) * rx * rad
    const py = cy + Math.cos(b) * ry * rad * 0.95
    const pz = Math.sin(b) * Math.sin(a) * rz * rad
    // 叶幕贴冠面：切向为主 + 少量径向/上倾，避免叶片径向炸刺
    const radial = new THREE.Vector3(px, (py - cy) * 0.6, pz)
    if (radial.lengthSq() < 1e-4) radial.set(r() - 0.5, 0.5, r() - 0.5)
    radial.normalize()
    const dir = new THREE.Vector3(-radial.z, 0, radial.x).multiplyScalar(0.5 + r() * 0.4)
      .add(radial.clone().multiplyScalar(0.16 + r() * 0.2))
      .add(new THREE.Vector3((r() - 0.5) * 0.5, 0.25 + r() * 0.4, (r() - 0.5) * 0.5))
    const shell = Math.max(Math.abs(px) / rx, Math.abs(py - cy) / ry, Math.abs(pz) / rz)
    const palette = shell > 0.62 && py > cy ? lights : shell > 0.45 ? (r() > 0.4 ? lights : mids) : (r() > 0.55 ? mids : darks)
    leaf(
      list,
      new THREE.Vector3(px, py, pz),
      dir,
      (0.15 + r() * 0.1) * scale,
      (0.12 + r() * 0.08) * scale,
      pickColor(r, palette),
      r() * Math.PI,
    )
  }
  // 枝梢叶簇，收住冠部边缘
  for (const tip of tips) {
    for (let k = 0; k < (density < 0.8 ? 2 : 3); k++) {
      leaf(
        list,
        tip.clone().add(new THREE.Vector3((r() - 0.5) * 0.24, (r() - 0.5) * 0.18, (r() - 0.5) * 0.24)),
        new THREE.Vector3(tip.x * 0.3 + (r() - 0.5), 0.4 + r() * 0.4, tip.z * 0.3 + (r() - 0.5)),
        (0.14 + r() * 0.08) * scale,
        (0.1 + r() * 0.06) * scale,
        pickColor(r, r() > 0.5 ? lights : mids),
        r() * Math.PI,
      )
    }
  }
  return mergeAll(list)
}

export function makeCypressGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const h = (4.2 + r() * 1.2) * scale
  const bark = '#5f4c37'
  const flare = new THREE.CylinderGeometry(0.14 * scale, 0.2 * scale, 0.24 * scale, 8)
  flare.translate(0, 0.12 * scale, 0)
  paintGeo(flare, bark, 0.06)
  list.push(flare)
  branch(list, new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, h * 0.42, 0), 0.13 * scale, 0.07 * scale, bark, 6)

  const darks = ['#33552c', '#3a5e31', '#416636', '#486d3a']
  const mids = ['#4d763e', '#547f44', '#5b874a']
  const lights = ['#668f53', '#6f985a', '#78a162']

  // 立体塔形叶团，构成柏树的主体轮廓
  const layers = 8
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1)
    const y = h * (0.22 + t * 0.7)
    const rad = (0.66 - t * 0.56) * scale
    const count = t < 0.4 ? 3 : 2
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + i * 0.9 + r() * 0.4
      blob(
        list,
        Math.cos(a) * rad * 0.42,
        y + (r() - 0.5) * 0.1 * scale,
        Math.sin(a) * rad * 0.42,
        rad * (0.58 + r() * 0.16),
        (0.3 + r() * 0.1) * scale,
        rad * (0.58 + r() * 0.16),
        pickColor(r, t > 0.7 && r() > 0.5 ? lights : darks),
        1,
      )
    }
  }
  blob(list, 0, h * 0.94, 0, 0.12 * scale, 0.2 * scale, 0.12 * scale, '#3d6232', 1)

  // 针叶，打散团块的几何感
  const needles = 235
  for (let i = 0; i < needles; i++) {
    const t = Math.pow(r(), 0.9)
    const y = h * (0.18 + t * 0.76)
    const rad = (0.72 - t * 0.6) * scale * (0.8 + r() * 0.35)
    const a = r() * Math.PI * 2
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad),
      new THREE.Vector3(Math.cos(a) * 1.1, 0.5 - t * 0.15, Math.sin(a) * 1.1),
      (0.34 + r() * 0.26) * scale * (1 - t * 0.25),
      (0.1 + r() * 0.05) * scale,
      pickColor(r, t > 0.55 ? (r() > 0.4 ? lights : mids) : (r() > 0.75 ? mids : darks)),
      r() * 2.5,
    )
  }
  // 顶端细叶
  for (let i = 0; i < 20; i++) {
    const a = r() * Math.PI * 2
    leaf(
      list,
      new THREE.Vector3(0, h * (0.88 + r() * 0.08), 0),
      new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5),
      (0.16 + r() * 0.12) * scale,
      0.07 * scale,
      pickColor(r, lights),
      r() * 2,
    )
  }
  return mergeAll(list)
}

export function makeFruitTreeGeometry(seed = 1, scale = 1, fruitColor = '#d98432') {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const h = (2.4 + r() * 0.7) * scale
  const flare = new THREE.CylinderGeometry(0.13 * scale, 0.19 * scale, 0.24 * scale, 8)
  flare.translate(0, 0.12 * scale, 0)
  paintGeo(flare, '#6b5238', 0.06)
  list.push(flare)
  branch(list, new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, h * 0.5, 0), 0.16 * scale, 0.1 * scale, '#6b5238', 7)
  const colors = ['#42693a', '#4a733e', '#578449', '#639353', '#71a05e']
  const tips: THREE.Vector3[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r()
    const tip = new THREE.Vector3(Math.cos(a) * (0.65 + r() * 0.45) * scale, h * (0.58 + r() * 0.18), Math.sin(a) * (0.65 + r() * 0.45) * scale)
    branch(list, new THREE.Vector3(0, h * 0.34, 0), tip, 0.08 * scale, 0.032 * scale, '#6b5238', 5)
    tips.push(tip)
    for (let k = 0; k < 3; k++) {
      leaf(
        list,
        tip.clone().add(new THREE.Vector3((r() - 0.5) * 0.16, (r() - 0.5) * 0.16, (r() - 0.5) * 0.16)),
        new THREE.Vector3(tip.x + (r() - 0.5) * 0.4, 0.5 + r() * 0.5, tip.z + (r() - 0.5) * 0.4),
        (0.2 + r() * 0.12) * scale,
        0.2 * scale,
        pickColor(r, colors),
        r() * 3,
      )
    }
  }
  const cy = h * 0.82
  for (let i = 0; i < 7; i++) {
    blob(
      list,
      (r() - 0.5) * 1.2 * scale,
      cy + (r() - 0.5) * 0.6 * scale,
      (r() - 0.5) * 1.2 * scale,
      (0.52 + r() * 0.3) * scale,
      (0.42 + r() * 0.25) * scale,
      (0.52 + r() * 0.3) * scale,
      pickColor(r, colors),
      1,
    )
  }
  for (let i = 0; i < 135; i++) {
    const a = r() * Math.PI * 2
    const rad = Math.pow(r(), 0.55) * 1.25 * scale
    const px = Math.cos(a) * rad
    const pz = Math.sin(a) * rad
    const py = cy + (r() - 0.5) * 1.05 * scale
    leaf(
      list,
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(px, r() * 0.6 + 0.25, pz),
      (0.26 + r() * 0.18) * scale,
      0.24 * scale,
      pickColor(r, colors),
      r() * 3,
    )
  }
  // 果实
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2
    const rad = (0.4 + r() * 0.75) * scale
    const g = new THREE.SphereGeometry((0.075 + r() * 0.035) * scale, 7, 5)
    g.translate(Math.cos(a) * rad, cy - 0.1 * scale + (r() - 0.5) * 0.9 * scale, Math.sin(a) * rad)
    paintGeo(g, fruitColor, 0.08)
    list.push(g)
  }
  return mergeAll(list)
}

export function makeWillowGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const h = (3.55 + r() * 0.4) * scale
  const fork = new THREE.Vector3((r() - 0.5) * 0.1 * scale, h * 0.52, (r() - 0.5) * 0.1 * scale)
  branch(list, new THREE.Vector3(0, 0, 0), fork, 0.13 * scale, 0.07 * scale, '#6a5138', 8)

  const greens = ['#5f8442', '#6d944b', '#7aa257', '#88ae61', '#95ba6d']
  const darks = ['#527a3a', '#5d8741', '#679147']

  // 冠部体积，保证远看是浓绿而不是枯枝
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + r() * 0.5
    const rad = (0.2 + r() * 0.2) * scale
    blob(
      list,
      fork.x + Math.cos(a) * rad,
      fork.y + (0.26 + r() * 0.14) * scale,
      fork.z + Math.sin(a) * rad,
      (0.36 + r() * 0.12) * scale,
      (0.24 + r() * 0.08) * scale,
      (0.36 + r() * 0.12) * scale,
      pickColor(r, darks),
      0,
    )
  }

  const curtain = (
    top: THREE.Vector3,
    outward: THREE.Vector3,
    reach: number,
    dropY: number,
    leafCount: number,
  ) => {
    const mid = new THREE.Vector3(top.x + outward.x * reach * 0.42, top.y + 0.18 * scale, top.z + outward.z * reach * 0.42)
    const tip = new THREE.Vector3(top.x + outward.x * reach, top.y + 0.04 * scale, top.z + outward.z * reach)
    const end = new THREE.Vector3(tip.x + outward.x * reach * 0.28, dropY, tip.z + outward.z * reach * 0.28)
    branch(list, top, mid, 0.022 * scale, 0.013 * scale, '#6d944b', 4)
    branch(list, mid, tip, 0.013 * scale, 0.007 * scale, '#6d944b', 4)
    const curve = new THREE.CatmullRomCurve3([tip, tip.clone().lerp(end, 0.45), end], false, 'catmullrom', 0.5)
    const tube = new THREE.TubeGeometry(curve, 8, 0.009 * scale, 4, false)
    paintGeo(tube, '#6d944b', 0.06)
    list.push(tube)

    for (let k = 0; k < leafCount; k++) {
      const t = 0.04 + (k / Math.max(1, leafCount - 1)) * 0.94
      const p = curve.getPoint(t)
      const wide = (0.5 + r() * 0.32) * scale * (1.05 - t * 0.35)
      leaf(
        list,
        p,
        new THREE.Vector3(outward.x * (0.18 + r() * 0.28), -0.72 - r() * 0.38, outward.z * (0.18 + r() * 0.28)),
        wide,
        (0.24 + r() * 0.12) * scale,
        pickColor(r, greens),
        r() * 2.4,
      )
      if (r() > 0.35) {
        leaf(
          list,
          p.clone().add(new THREE.Vector3((r() - 0.5) * 0.1, -0.03, (r() - 0.5) * 0.1)),
          new THREE.Vector3(outward.x * (0.3 + r() * 0.3), -0.62 - r() * 0.3, outward.z * (0.3 + r() * 0.3)),
          wide * 0.78,
          (0.22 + r() * 0.1) * scale,
          pickColor(r, greens),
          r() * 2.4,
        )
      }
    }
  }

  const strands = 12
  for (let i = 0; i < strands; i++) {
    const a = (i / strands) * Math.PI * 2 + (r() - 0.5) * 0.34
    const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const reach = (1.35 + r() * 0.55) * scale
    const top = new THREE.Vector3(
      fork.x + outward.x * (0.35 + r() * 0.35) * scale,
      h * (0.78 + r() * 0.08),
      fork.z + outward.z * (0.35 + r() * 0.35) * scale,
    )
    curtain(top, outward, reach, h * (0.16 + r() * 0.12), 10)
  }

  // 内冠垂帘
  for (let i = 0; i < 15; i++) {
    const a = r() * Math.PI * 2
    const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const top = new THREE.Vector3(
      fork.x + outward.x * (0.15 + r() * 0.55) * scale,
      h * (0.62 + r() * 0.16),
      fork.z + outward.z * (0.15 + r() * 0.55) * scale,
    )
    curtain(top, outward, (0.7 + r() * 0.6) * scale, h * (0.2 + r() * 0.12), 7)
  }

  // 冠心密帘
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.4
    const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const top = new THREE.Vector3(
      fork.x + outward.x * (0.05 + r() * 0.28) * scale,
      fork.y + (0.28 + r() * 0.16) * scale,
      fork.z + outward.z * (0.05 + r() * 0.28) * scale,
    )
    curtain(top, outward, (0.55 + r() * 0.45) * scale, h * (0.24 + r() * 0.1), 6)
  }

  // 冠顶细叶
  for (let i = 0; i < 130; i++) {
    const a = r() * Math.PI * 2
    const rad = (0.2 + r() * 0.85) * scale
    leaf(
      list,
      new THREE.Vector3(fork.x + Math.cos(a) * rad, h * (0.6 + r() * 0.2), fork.z + Math.sin(a) * rad),
      new THREE.Vector3(Math.cos(a) * 0.4, -0.55 - r() * 0.45, Math.sin(a) * 0.4),
      (0.4 + r() * 0.26) * scale,
      (0.18 + r() * 0.1) * scale,
      pickColor(r, greens),
      r() * 2.4,
    )
  }
  return mergeAll(list)
}

export function makeBambooGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const culms = 10
  for (let c = 0; c < culms; c++) {
    const a = r() * Math.PI * 2
    const rad = (0.15 + r() * 0.85) * scale
    const ox = Math.cos(a) * rad
    const oz = Math.sin(a) * rad
    const h = (3.4 + r() * 2.2) * scale
    const leanX = (r() - 0.5) * 0.5
    const leanZ = (r() - 0.5) * 0.5
    const segments = 4
    let prev = new THREE.Vector3(ox, 0, oz)
    for (let s = 1; s <= segments; s++) {
      const t = s / segments
      const next = new THREE.Vector3(ox + leanX * t * t, h * t, oz + leanZ * t * t)
      branch(list, prev, next, 0.045 * scale * (1 - t * 0.35), 0.036 * scale * (1 - t * 0.35), '#7e8f4c', 5)
      if (s < segments) {
        const ring = new THREE.TorusGeometry(0.047 * scale * (1 - t * 0.3), 0.011 * scale, 4, 8)
        ring.rotateX(Math.PI / 2)
        ring.translate(next.x, next.y, next.z)
        paintGeo(ring, '#65773d', 0.03)
        list.push(ring)
      }
      prev = next
    }
    const colors = ['#5f7d3f', '#6e8e49', '#7c9c54', '#8aa75f']
    for (let k = 0; k < 22; k++) {
      const t = 0.45 + r() * 0.55
      const p = new THREE.Vector3(ox + leanX * t * t, h * t, oz + leanZ * t * t)
      const dir = new THREE.Vector3((r() - 0.5) * 2.2, 0.3 + r() * 0.5, (r() - 0.5) * 2.2)
      leaf(list, p, dir, (0.28 + r() * 0.2) * scale, 0.11 * scale, pickColor(r, colors), r() * 3)
    }
  }
  return mergeAll(list)
}

export function makeBushGeometry(seed = 1, scale = 1, density = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const darks = ['#3f6534', '#476d3a', '#4f763f']
  const mids = ['#588445', '#618c4b', '#6a9452']
  const lights = ['#76a35c', '#82ac66', '#8fb571']

  // 细枝
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.5
    branch(
      list,
      new THREE.Vector3(Math.cos(a) * 0.04 * scale, 0, Math.sin(a) * 0.04 * scale),
      new THREE.Vector3(Math.cos(a) * (0.2 + r() * 0.35) * scale, (0.26 + r() * 0.2) * scale, Math.sin(a) * (0.2 + r() * 0.35) * scale),
      0.022 * scale,
      0.008 * scale,
      '#6a5a3e',
      4,
    )
  }
  // 大小不一的团块叠出自然轮廓
  const bushBlobCount = Math.max(6, Math.round(16 * density))
  for (let i = 0; i < bushBlobCount; i++) {
    const a = r() * Math.PI * 2
    const rad = Math.pow(r(), 0.7) * 0.58 * scale
    const y = (0.13 + r() * 0.34) * scale
    blob(
      list,
      Math.cos(a) * rad,
      y,
      Math.sin(a) * rad,
      (0.1 + r() * 0.12) * scale,
      (0.08 + r() * 0.1) * scale,
      (0.1 + r() * 0.12) * scale,
      pickColor(r, y > 0.34 * scale ? (r() > 0.35 ? lights : mids) : darks),
      1,
    )
  }
  // 外缘叶片（切向贴面，避免炸刺）
  for (let i = 0; i < Math.round(230 * density); i++) {
    const a = r() * Math.PI * 2
    const rad = (0.2 + Math.pow(r(), 0.5) * 0.66) * scale
    const y = (0.1 + r() * 0.44) * scale
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad),
      new THREE.Vector3(-Math.sin(a) * 0.6 + (r() - 0.5) * 0.4, 0.4 + r() * 0.5, Math.cos(a) * 0.6 + (r() - 0.5) * 0.4),
      (0.1 + r() * 0.08) * scale,
      (0.12 + r() * 0.08) * scale,
      pickColor(r, y > 0.32 * scale ? (r() > 0.4 ? lights : mids) : (r() > 0.6 ? mids : darks)),
      r() * 3,
    )
  }
  return mergeAll(list)
}

/** 垂直农场托盘用的小型作物，单株约 230 顶点 */
export function makeTrayPlantGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const colors = ['#5c8546', '#699451', '#769f5b', '#84aa66']
  blob(list, 0, 0.06 * scale, 0, 0.09 * scale, 0.07 * scale, 0.09 * scale, '#4f7440', 0)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.03 * scale, 0.03 * scale, Math.sin(a) * 0.03 * scale),
      new THREE.Vector3(Math.cos(a) * (0.55 + r() * 0.25), 0.7 + r() * 0.35, Math.sin(a) * (0.55 + r() * 0.25)),
      (0.16 + r() * 0.06) * scale,
      (0.09 + r() * 0.03) * scale,
      pickColor(r, colors),
      r() * 2,
    )
  }
  for (let i = 0; i < 2; i++) {
    leaf(
      list,
      new THREE.Vector3(0, 0.05 * scale, 0),
      new THREE.Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3),
      (0.15 + r() * 0.05) * scale,
      0.08 * scale,
      pickColor(r, colors),
      r() * 2,
    )
  }
  return mergeAll(list)
}

export function makeReedGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const greens = ['#7e9355', '#8ba05e', '#98ab68', '#a4b573']
  const straw = ['#b3a976', '#c2b884']
  const blades = 13
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + r() * 0.6
    const h = (0.95 + r() * 0.7) * scale
    blade(
      list,
      new THREE.Vector3(Math.cos(a) * 0.06 * scale, 0, Math.sin(a) * 0.06 * scale),
      new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      h,
      (0.05 + r() * 0.024) * scale,
      i % 4 === 0 ? pickColor(r, straw) : pickColor(r, greens),
      0.28 + r() * 0.34,
      r() * 1.5,
    )
  }
  // 香蒲穗
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r() * 0.5
    const h = (1.25 + r() * 0.4) * scale
    const base = new THREE.Vector3(Math.cos(a) * 0.1 * scale, 0, Math.sin(a) * 0.1 * scale)
    const top = new THREE.Vector3(Math.cos(a) * (0.12 + r() * 0.08) * scale, h, Math.sin(a) * (0.12 + r() * 0.08) * scale)
    branch(list, base, top, 0.016 * scale, 0.009 * scale, '#87975c', 4)
    const head = new THREE.CapsuleGeometry(0.04 * scale, 0.14 * scale, 3, 6)
    head.translate(top.x, h - 0.1 * scale, top.z)
    paintGeo(head, '#7d5c3d', 0.06)
    list.push(head)
    const awn = new THREE.ConeGeometry(0.008 * scale, 0.09 * scale, 4)
    awn.translate(top.x, h + 0.13 * scale, top.z)
    paintGeo(awn, '#b9a576', 0.05)
    list.push(awn)
  }
  return mergeAll(list)
}

function grassBlade(
  list: THREE.BufferGeometry[],
  base: THREE.Vector3,
  lean: THREE.Vector3,
  len: number,
  width: number,
  root: THREE.Color,
  mid: THREE.Color,
  tip: THREE.Color,
  curl: number,
  twist: number,
  droop: number,
  segments = 3,
) {
  const side = new THREE.Vector3(-lean.z, 0, lean.x)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  if (twist) side.applyAxisAngle(UP, twist)
  const out = lean.clone().normalize()
  const rows: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const bend = curl * len * t * t
    rows.push(new THREE.Vector3(
      base.x + out.x * bend,
      base.y + len * (t - droop * t * t * t),
      base.z + out.z * bend,
    ))
  }
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const c = new THREE.Color()
  const tangent = new THREE.Vector3()
  const faceN = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = rows[i]
    tangent.subVectors(rows[Math.min(segments, i + 1)], rows[Math.max(0, i - 1)]).normalize()
    faceN.crossVectors(side, tangent).normalize()
    const w = width * (1 - t * t) * (0.6 + 0.4 * Math.sin(Math.PI * t))
    const crease = w * 0.22 * Math.sin(Math.PI * t)
    n.copy(UP).multiplyScalar(0.65).addScaledVector(out, 0.3).addScaledVector(faceN, 0.4).normalize()
    if (t < 0.5) c.copy(root).lerp(mid, t * 2)
    else c.copy(mid).lerp(tip, (t - 0.5) * 2)
    positions.push(p.x - side.x * w * 0.5, p.y, p.z - side.z * w * 0.5)
    positions.push(p.x + faceN.x * crease, p.y + faceN.y * crease, p.z + faceN.z * crease)
    positions.push(p.x + side.x * w * 0.5, p.y, p.z + side.z * w * 0.5)
    for (let k = 0; k < 3; k++) {
      normals.push(n.x, n.y, n.z)
      const shade = k === 1 ? 1.06 : 0.94
      colors.push(c.r * shade, c.g * shade, c.b * shade)
    }
  }
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = i * 3
    const b = a + 3
    if (i === segments - 1) {
      indices.push(a, b + 1, a + 1, a + 1, b + 1, a + 2)
    } else {
      indices.push(a, b, a + 1, a + 1, b, b + 1)
      indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  list.push(g)
}

export function makeGrassTuftGeometry(seed = 1, scale = 1, variant: 0 | 1 | 2 = 0) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const rootCol = new THREE.Color('#5f7a3a')
  const greens = ['#6f9448', '#7a9e50', '#86a95a', '#90b263', '#9bba6c']
  const tips = ['#b4c37a', '#bfc983', '#c7cb8a', '#a9bd6f']
  const dryMid = ['#aaae6c', '#b8b878']
  const dryTip = ['#cfc48c', '#d8cc93']
  const cfg = [
    { blades: 14, hMin: 0.2, hMax: 0.42, spread: 0.13, curlMin: 0.35, curlMax: 0.8, droop: 0.12, spikes: 1, wMul: 1.1 },
    { blades: 12, hMin: 0.32, hMax: 0.56, spread: 0.1, curlMin: 0.45, curlMax: 0.95, droop: 0.2, spikes: 2, wMul: 1.1 },
    { blades: 16, hMin: 0.12, hMax: 0.26, spread: 0.18, curlMin: 0.5, curlMax: 1.0, droop: 0.22, spikes: 0, wMul: 1 },
  ][variant]
  const mid = new THREE.Color()
  const tip = new THREE.Color()
  const root = new THREE.Color()
  for (let i = 0; i < cfg.blades; i++) {
    const a = (i / cfg.blades) * Math.PI * 2 + r() * 0.8
    const ring = Math.pow(r(), 0.7)
    const rad = (0.015 + ring * cfg.spread) * scale
    const inner = ring < 0.4
    const h = (cfg.hMin + r() * (cfg.hMax - cfg.hMin) + (inner ? 0.06 : 0)) * scale
    const dry = r() > 0.84
    mid.set(dry ? pickColor(r, dryMid) : pickColor(r, greens))
    tip.set(dry ? pickColor(r, dryTip) : pickColor(r, tips))
    root.copy(rootCol).multiplyScalar(0.92 + r() * 0.16)
    const curl = inner ? cfg.curlMin * (0.5 + r() * 0.5) : cfg.curlMin + r() * (cfg.curlMax - cfg.curlMin)
    grassBlade(
      list,
      new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad),
      new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      h,
      (0.022 + r() * 0.016) * cfg.wMul * scale,
      root,
      mid,
      tip,
      curl,
      (r() - 0.5) * 1.2,
      cfg.droop * (0.6 + r() * 0.8),
    )
  }
  for (let i = 0; i < cfg.spikes; i++) {
    const a = r() * Math.PI * 2
    const h = (cfg.hMax * 0.9 + r() * 0.18) * scale
    const bx = Math.cos(a) * 0.06 * scale
    const bz = Math.sin(a) * 0.06 * scale
    const tx = bx + Math.cos(a) * 0.09 * scale
    const tz = bz + Math.sin(a) * 0.09 * scale
    branch(list, new THREE.Vector3(bx, 0, bz), new THREE.Vector3(tx, h, tz), 0.007 * scale, 0.004 * scale, '#9aa865', 3)
    const spike = new THREE.ConeGeometry(0.012 * scale, 0.08 * scale, 4)
    spike.translate(tx + Math.cos(a) * 0.01 * scale, h + 0.03 * scale, tz + Math.sin(a) * 0.01 * scale)
    paintGeo(spike, '#c4b982', 0.06)
    list.push(spike)
  }
  return mergeAll(list)
}

export function makeFlowerGeometry(seed = 1, color = '#f4f0df', scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const h = (0.22 + r() * 0.2) * scale
  branch(list, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0), 0.012 * scale, 0.008 * scale, '#5f7d45', 3)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.02 * scale, h, Math.sin(a) * 0.02 * scale),
      new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)),
      0.07 * scale,
      0.05 * scale,
      color,
      a,
    )
  }
  const center = new THREE.SphereGeometry(0.024 * scale, 5, 3)
  center.translate(0, h + 0.015 * scale, 0)
  paintGeo(center, '#e8b74c', 0.04)
  list.push(center)
  return mergeAll(list)
}

/* ------------------------------- 作物 ------------------------------- */

export function makeCabbageGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const outer = ['#5d8b48', '#6b9752', '#79a55c']
  const inner = ['#9cc47a', '#b1d18e', '#c4dda3']
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.05 * scale, 0.02, Math.sin(a) * 0.05 * scale),
      new THREE.Vector3(Math.cos(a) * 0.75, 0.55, Math.sin(a) * 0.75),
      (0.3 + r() * 0.12) * scale,
      (0.17 + r() * 0.06) * scale,
      pickColor(r, outer),
      r() * 3,
    )
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r()
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.03 * scale, 0.08 * scale, Math.sin(a) * 0.03 * scale),
      new THREE.Vector3(Math.cos(a) * 0.32, 1, Math.sin(a) * 0.32),
      (0.2 + r() * 0.08) * scale,
      0.15 * scale,
      pickColor(r, inner),
      r() * 3,
    )
  }
  const core = new THREE.SphereGeometry(0.13 * scale, 6, 4)
  core.scale(1, 0.8, 1)
  core.translate(0, 0.17 * scale, 0)
  paintGeo(core, '#b9d594', 0.05)
  list.push(core)
  return mergeAll(list)
}

export function makeScallionGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5
    const h = (0.4 + r() * 0.25) * scale
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.025 * scale, 0, Math.sin(a) * 0.025 * scale),
      new THREE.Vector3(Math.cos(a) * 0.24, 1, Math.sin(a) * 0.24),
      h,
      0.05 * scale,
      i % 4 === 0 ? '#c8d3a8' : '#6f9a4d',
      r() * 2,
    )
  }
  return mergeAll(list)
}

export function makeWeedGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2
    leaf(
      list,
      new THREE.Vector3((r() - 0.5) * 0.24 * scale, 0, (r() - 0.5) * 0.24 * scale),
      new THREE.Vector3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4),
      (0.18 + r() * 0.2) * scale,
      0.05 * scale,
      r() > 0.55 ? '#8f8f5c' : '#7e8d55',
      r() * 3,
    )
  }
  return mergeAll(list)
}

export function makeGrapeVineGeometry(seed = 1, alert = false, scale = 1) {  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const trunkTop = new THREE.Vector3(0.02, 1.55 * scale, 0)
  branch(list, new THREE.Vector3(0, 0, 0), trunkTop, 0.075 * scale, 0.045 * scale, '#66513a', 6)
  const greens = alert
    ? ['#6f8f4e', '#7b9c55', '#8aa25a', '#a8a456', '#b7a94f']
    : ['#4f7d3f', '#5c8c49', '#6b9c55', '#79aa62', '#87b16c']
  const armY = 1.42 * scale
  const tips: THREE.Vector3[] = []
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const tip = new THREE.Vector3(Math.cos(a) * (0.5 + r() * 0.35) * scale, armY + (r() - 0.3) * 0.35 * scale, Math.sin(a) * (0.5 + r() * 0.35) * scale)
    branch(list, new THREE.Vector3(0, armY - 0.25 * scale, 0), tip, 0.032 * scale, 0.016 * scale, '#66513a', 5)
    tips.push(tip)
  }
  for (let i = 0; i < 56; i++) {
    const a = r() * Math.PI * 2
    const rad = (0.2 + r() * 0.92) * scale
    const px = Math.cos(a) * rad
    const pz = Math.sin(a) * rad
    const py = armY + (r() - 0.3) * 0.95 * scale
    leaf(
      list,
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(px, 0.35 + r() * 0.8, pz),
      (0.26 + r() * 0.18) * scale,
      0.34 * scale,
      pickColor(r, greens),
      r() * 3,
    )
  }
  const bunchColors = alert ? ['#7e3d5b', '#8f4766', '#a05270'] : ['#6d2f52', '#7d365d', '#8c3e67', '#a14a75']
  for (let b = 0; b < 5; b++) {
    const bx = (r() - 0.5) * 1.2 * scale
    const bz = (r() - 0.5) * 1.2 * scale
    const by = (0.75 + r() * 0.45) * scale
    for (let k = 0; k < 6; k++) {
      const g = new THREE.SphereGeometry((0.045 + r() * 0.018) * scale, 5, 3)
      const a = r() * Math.PI * 2
      g.translate(bx + Math.cos(a) * 0.055 * scale, by + k * 0.035 * scale, bz + Math.sin(a) * 0.055 * scale)
      paintGeo(g, pickColor(r, bunchColors), 0.07)
      list.push(g)
    }
  }
  return mergeAll(list)
}

export function makeGrapeHedgeGeometry(seed = 1, length = 10.6, alert = false, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const greens = alert
    ? ['#6f8f4e', '#7b9c55', '#8aa25a', '#a8a456', '#b7a94f']
    : ['#4f7d3f', '#5c8c49', '#6b9c55', '#79aa62', '#87b16c']
  const step = 0.26 * scale
  for (let z = -length / 2 + 0.1; z <= length / 2 - 0.1; z += step) {
    for (let k = 0; k < 2; k++) {
      const x = (r() - 0.5) * 0.6 * scale
      const y = (1.16 + r() * 0.82) * scale
      leaf(
        list,
        new THREE.Vector3(x, y, z + (r() - 0.5) * 0.14),
        new THREE.Vector3(x + (r() - 0.5) * 0.5, 0.4 + r() * 0.75, (r() - 0.5) * 0.5),
        (0.24 + r() * 0.14) * scale,
        0.31 * scale,
        pickColor(r, greens),
        r() * 3,
      )
    }
  }
  return mergeAll(list)
}

export function makeRiceTuftGeometry(seed = 1, ripe = false, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const greens = ripe
    ? ['#b49243', '#c6a24c', '#d2b25a', '#a9863d']
    : ['#628f44', '#6f9c4c', '#7ba956', '#88b45f']
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.5
    const h = (0.5 + r() * 0.32) * scale
    const lean = 0.22 + r() * 0.3
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.025 * scale, 0, Math.sin(a) * 0.025 * scale),
      new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean),
      h,
      0.075 * scale,
      pickColor(r, greens),
      r() * 2,
    )
    if (i % 3 === 0) {
      const head = new THREE.SphereGeometry(0.026 * scale, 5, 4)
      head.scale(1, 2.8, 1)
      head.translate(Math.cos(a) * lean * h * 0.7, h * 0.96, Math.sin(a) * lean * h * 0.7)
      paintGeo(head, ripe ? '#d9b963' : '#9fb95f', 0.06)
      list.push(head)
    }
  }
  return mergeAll(list)
}

export function makeRapePlantGeometry(seed = 1, mature = false, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const greens = ['#4f7a3f', '#5d8949', '#6b9853', '#79a45e']
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.03 * scale, 0, Math.sin(a) * 0.03 * scale),
      new THREE.Vector3(Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7),
      (0.22 + r() * 0.1) * scale,
      0.2 * scale,
      pickColor(r, greens),
      r() * 3,
    )
  }
  if (mature) {
    const stemTop = new THREE.Vector3(0, 0.62 * scale, 0)
    branch(list, new THREE.Vector3(0, 0.1 * scale, 0), stemTop, 0.022 * scale, 0.012 * scale, '#6c7a45', 4)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const f = makeFlowerGeometry(seed + i, '#e7c23e', scale * 0.85)
      const m = new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.13 * scale, 0.58 * scale + (i % 2) * 0.08 * scale, Math.sin(a) * 0.13 * scale)
      f.applyMatrix4(m)
      list.push(f)
    }
  }
  return mergeAll(list)
}

export function makeStrawberryGeometry(seed = 1, scale = 1) {
  const r = rng(seed)
  const list: THREE.BufferGeometry[] = []
  const greens = ['#3f7139', '#4d8244', '#5c934f', '#6ba25a']
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3
    leaf(
      list,
      new THREE.Vector3(Math.cos(a) * 0.04 * scale, 0.02, Math.sin(a) * 0.04 * scale),
      new THREE.Vector3(Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85),
      (0.18 + r() * 0.1) * scale,
      0.22 * scale,
      pickColor(r, greens),
      r() * 3,
    )
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5
    const f = makeFlowerGeometry(seed + 11 + i, '#f5f0dc', scale * 0.55)
    f.applyMatrix4(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.14 * scale, 0.16 * scale, Math.sin(a) * 0.14 * scale))
    list.push(f)
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 1.1
    const g = new THREE.SphereGeometry(0.05 * scale, 6, 4)
    g.scale(1, 1.15, 1)
    g.translate(Math.cos(a) * 0.17 * scale, 0.1 * scale, Math.sin(a) * 0.17 * scale)
    paintGeo(g, i % 2 === 0 ? '#bf3a2c' : '#cf5a3e', 0.06)
    list.push(g)
  }
  return mergeAll(list)
}
