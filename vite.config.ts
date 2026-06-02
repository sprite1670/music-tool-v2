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
    strictPort: true,
    proxy: {
      // 网易云 API 代理
      '/api/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/netease/, ''),
      },
      // QQ 音乐 API 代理
      '/api/qq': {
        target: 'https://u.y.qq.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/qq/, ''),
      },
      // QQ 音乐歌词代理
      '/api/qq-lyric': {
        target: 'https://c.y.qq.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/qq-lyric/, ''),
      },
      // 酷狗搜索代理
      '/api/kugou': {
        target: 'https://songsearch.kugou.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/kugou/, ''),
      },
      // 酷狗歌词代理
      '/api/lyrics': {
        target: 'https://lyrics.kugou.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/lyrics/, ''),
      },
      // imjad 代理
      '/api/imjad': {
        target: 'https://api.imjad.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/imjad/, ''),
      },
      // 酷狗 wwwapi 代理
      '/api/kgwww': {
        target: 'https://wwwapi.kugou.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/kgwww/, ''),
      },
      // ytmusic 代理
      '/api/ytmusic': {
        target: 'https://ytmusic-api.yemsyyy.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ytmusic/, ''),
      },
    },
  },
})
