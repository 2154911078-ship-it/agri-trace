/* ==========================================================================
   three-opt：本地内置 three.js + 非农作物对象视觉优化模块
   - three/          本地部署的 three.js r186（构建产物与 examples，不依赖 npm）
   - foliageWind.ts  植被风动材质（树木/灌木/草地），农作物不使用
   - canopyShadows.ts 树冠接触阴影（柔光暗斑，让树木落地）
   - homestead.ts    农舍视觉升级（按材质合并绘制 + 细节增强）
   ========================================================================== */

export { createWindFoliageMaterial, createWindBladeMaterial, updateWind } from './foliageWind'
export type { WindMaterialOptions } from './foliageWind'
export { addCanopyShadows } from './canopyShadows'
export type { CanopySpot } from './canopyShadows'
export { buildHomestead } from './homestead'
export type { HomesteadMats, HomesteadOutput, Chicken } from './homestead'
