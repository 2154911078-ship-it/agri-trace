import * as THREE from 'three'

/* ==========================================================================
   树冠接触阴影：在树下铺一圈柔和暗斑，让树木"落地"，消除漂浮感
   - 单次 InstancedMesh 绘制，不增加额外阴影贴图开销
   ========================================================================== */

export interface CanopySpot {
  x: number
  z: number
  s: number
}

function makeSoftShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(16,24,14,0.55)')
  g.addColorStop(0.55, 'rgba(16,24,14,0.3)')
  g.addColorStop(1, 'rgba(16,24,14,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function addCanopyShadows(
  parent: THREE.Object3D,
  spots: CanopySpot[],
  radiusScale = 1.55,
  opacity = 0.5,
): THREE.InstancedMesh | null {
  if (!spots.length) return null
  const tex = makeSoftShadowTexture()
  const mesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity }),
    spots.length,
  )
  const dummy = new THREE.Object3D()
  spots.forEach((sp, i) => {
    dummy.position.set(sp.x, 0.03, sp.z)
    dummy.rotation.set(-Math.PI / 2, 0, sp.s * 12.989)
    dummy.scale.setScalar(sp.s * radiusScale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.renderOrder = 2
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}
