import * as THREE from 'three'

/* ==========================================================================
   非农作物植被风动材质（树木 / 灌木 / 草地 / 芦苇 / 竹子）
   - 通过 onBeforeCompile 在顶点着色器中叠加轻微摆动，不改几何体
   - 摆幅随高度平滑增大（树根静止、树梢摆动），实例网格按世界坐标错开相位
   - 农作物（地块作物、葡萄、塔架盆栽）不使用本材质，不受影响
   ========================================================================== */

interface WindMaterial {
  mat: THREE.MeshStandardMaterial
  uTime: { value: number }
}

const registry: WindMaterial[] = []

const SWAY_GLSL = /* glsl */ `
float windK(float y) {
  float t = clamp(y / uMaxH, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
vec3 windOffset(vec3 p) {
  float k = windK(p.y);
  float ph = p.x * 0.85 + p.z * 0.65 + uTime * 1.7;
  #ifdef USE_INSTANCING
  ph += instanceMatrix[3][0] * 0.075 + instanceMatrix[3][2] * 0.075;
  #endif
  vec2 o = vec2(sin(ph), cos(ph * 0.82 + 1.31));
  return vec3(o.x * uAmp * k, 0.0, o.y * uAmp * k * 0.8);
}
`

export interface WindMaterialOptions {
  doubleSide?: boolean
  amplitude?: number
  maxHeight?: number
  roughness?: number
}

function installWind(mat: THREE.MeshStandardMaterial, amplitude: number, maxHeight: number) {
  const uTime = { value: 0 }
  const uAmp = { value: amplitude }
  const uMaxH = { value: maxHeight }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.uniforms.uAmp = uAmp
    shader.uniforms.uMaxH = uMaxH
    shader.vertexShader =
      'uniform float uTime;\nuniform float uAmp;\nuniform float uMaxH;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_GLSL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += windOffset(transformed);')
  }
  registry.push({ mat, uTime })
}

/** 树冠 / 灌木 / 竹叶等厚实植被的风动材质 */
export function createWindFoliageMaterial(opts: WindMaterialOptions = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? 0.9,
    emissive: 0x0c150a,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  })
  installWind(mat, opts.amplitude ?? 0.055, opts.maxHeight ?? 4.6)
  return mat
}

/** 草叶 / 芦苇等薄片植被的风动材质（双面） */
export function createWindBladeMaterial(opts: WindMaterialOptions = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? 0.86,
    emissive: 0x0c150a,
    side: opts.doubleSide === false ? THREE.FrontSide : THREE.DoubleSide,
  })
  installWind(mat, opts.amplitude ?? 0.11, opts.maxHeight ?? 1.4)
  return mat
}

/** 在动画循环中更新所有风动材质的时间 */
export function updateWind(timeSec: number) {
  for (const w of registry) w.uTime.value = timeSec
}
