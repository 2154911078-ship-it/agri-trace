import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // 本地内置 three.js（src/three-opt/three），不依赖 npm 包
      { find: /^three$/, replacement: fileURLToPath(new URL('./src/three-opt/three/build/three.module.js', import.meta.url)) },
      { find: /^three\/examples\/jsm\//, replacement: fileURLToPath(new URL('./src/three-opt/three/examples/jsm/', import.meta.url)) },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5181,
    strictPort: true,
    open: false,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
