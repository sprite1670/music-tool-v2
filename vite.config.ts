import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// 读取 SCSS 变量文件，注入到每个 <style lang="scss"> 中
const scssVars = readFileSync(resolve(__dirname, 'src/styles/_variables.scss'), 'utf-8')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 全局注入变量，所有 <style lang="scss"> 可直接使用 $primary-color 等
        additionalData: scssVars,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      // 开发模式下代理到集成服务器（8080）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
