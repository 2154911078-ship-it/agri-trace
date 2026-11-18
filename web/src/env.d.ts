/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string
  readonly VITE_API_BASE: string
  readonly VITE_PUBLIC_ORIGIN?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}