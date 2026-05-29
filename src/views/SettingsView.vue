<template>
  <div class="settings-view">
    <h1 class="page-title"><span class="icon">⚙️</span> 设置</h1>

    <!-- 音乐源配置 -->
    <section class="setting-section card">
      <h3 class="section-title">音乐源配置</h3>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">网易云音乐 API</div>
          <div class="item-desc">用于搜索和下载网易云音乐的歌曲</div>
        </div>
        <n-switch v-model:value="neteaseEnabled" />
      </div>
      <div class="setting-sub" v-if="neteaseEnabled">
        <label>API 地址：</label>
        <n-input v-model:value="neteaseApiUrl" placeholder="http://localhost:3000"
                 style="max-width: 360px;" />
      </div>

      <n-divider />

      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">QQ音乐 API</div>
          <div class="item-desc">用于搜索和下载 QQ 音乐的歌曲</div>
        </div>
        <n-switch v-model:value="qqEnabled" />
      </div>
      <div class="setting-sub" v-if="qqEnabled">
        <label>API 地址：</label>
        <n-input v-model:value="qqApiUrl" placeholder="http://localhost:3300"
                 style="max-width: 360px;" />
      </div>
    </section>

    <!-- 下载设置 -->
    <section class="setting-section card">
      <h3 class="section-title">下载设置</h3>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">默认音质</div>
        </div>
        <n-select v-model:value="defaultQuality" :options="qualityOptions"
                  style="width: 180px;" />
      </div>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">保存路径</div>
          <div class="item-desc">{{ downloadDir || '未设置（使用默认目录）' }}</div>
        </div>
        <n-button @click="selectDir">选择目录</n-button>
      </div>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">命名规则</div>
        </div>
        <n-select v-model:value="namingRule" :options="namingOptions"
                  style="width: 240px;" />
      </div>
    </section>

    <!-- 转换设置 -->
    <section class="setting-section card">
      <h3 class="section-title">转换设置</h3>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">FFmpeg 路径</div>
          <div class="item-desc">{{ ffmpegPath || '自动检测' }}</div>
        </div>
        <n-button @click="detectFFmpeg" size="small">检测</n-button>
      </div>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">默认输出格式</div>
        </div>
        <n-select v-model:value="defaultFormat" :options="formatOptions"
                  style="width: 160px;" />
      </div>
    </section>

    <!-- 外观设置 -->
    <section class="setting-section card">
      <h3 class="section-title">外观</h3>
      <div class="setting-item">
        <div class="item-info">
          <div class="item-name">主题模式</div>
        </div>
        <n-radio-group v-model:value="themeMode">
          <n-radio-button value="light">浅色</n-radio-button>
          <n-radio-button value="dark">深色</n-radio-button>
          <n-radio-button value="auto">跟随系统</n-radio-button>
        </n-radio-group>
      </div>
    </section>

    <!-- 关于 -->
    <section class="setting-section card about-section">
      <div class="about-content">
        <div class="about-logo">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="#4ECDC4">
            <circle cx="16" cy="16" r="14" stroke="#4ECDC4" stroke-width="2" fill="none"/>
            <path d="M10 20V12L16 16L22 12V20" stroke="#4ECDC4" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="16" cy="23" r="1.5" fill="#4ECDC4"/>
          </svg>
        </div>
        <div class="about-text">
          <h2>MusicTool</h2>
          <p class="version">版本 1.0.0</p>
          <p class="desc">简洁清新的跨平台音乐工具<br/>支持歌曲搜索 · 歌词下载 · 格式转换 · 元数据编辑</p>
        </div>
      </div>
    </section>

    <!-- 保存按钮 -->
    <div class="save-bar">
      <n-button type="primary" size="large" @click="saveSettings" style="min-width:140px;">
        保存设置
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NSwitch, NSelect, NButton, NInput, NRadioGroup,
  NRadioButton, NDivider, useMessage,
} from 'naive-ui'
import { selectFolderDialog } from '@/services/platform'

const message = useMessage()

// 音乐源
const neteaseEnabled = ref(true)
const neteaseApiUrl = ref('https://music.163.com')
const qqEnabled = ref(true)
const qqApiUrl = ref('')

// 下载
const defaultQuality = ref('320k')
const downloadDir = ref('')
const namingRule = ref('{artist} - {title}')
// 转换
const ffmpegPath = ref('')
const defaultFormat = ref('mp3')
// 外观
const themeMode = ref<'light' | 'dark' | 'auto'>('light')

const qualityOptions = [
  { label: '标准 (128k)', value: '128k' },
  { label: '高品质 (320k)', value: '320k' },
  { label: '无损 (FLAC)', value: 'flac' },
]

const namingOptions = [
  { label: '{artist} - {title}', value: '{artist} - {title}' },
  { label: '{title} - {artist}', value: '{title} - {artist}' },
  { label: '{album}/{track}. {title}', value: '{album}/{track}. {title}' },
]

const formatOptions = [
  { label: 'MP3', value: 'mp3' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' },
  { label: 'AAC', value: 'aac' },
  { label: 'OGG', value: 'ogg' },
]

onMounted(() => {
  const saved = localStorage.getItem('musictool-settings')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      Object.assign({ neteaseEnabled, neteaseApiUrl, qqEnabled, qqApiUrl,
                     defaultQuality, namingRule, defaultFormat, themeMode },
                   s)
    } catch {}
  }
})

async function selectDir() {
  try {
    const result = await selectFolderDialog({ title: '选择下载目录' })
    if (result) downloadDir.value = Array.isArray(result) ? result[0] : result
  } catch (e: any) {
    if (e.message !== 'TAURI_ONLY') console.warn('选择目录失败', e)
  }
}

async function detectFFmpeg() {
  try {
    // 简单检测：尝试调用系统 ffmpeg --version
    message.info('正在检测 FFmpeg...')
    // 实际检测需要主进程支持，暂时提示用户手动配置
    message.warning('请手动确认 FFmpeg 已安装并在 PATH 中')
  } catch {
    message.error('未检测到 FFmpeg，请确认已安装或放入 binaries 目录')
  }
}

function saveSettings() {
  const settings = {
    neteaseEnabled: neteaseEnabled.value,
    neteaseApiUrl: neteaseApiUrl.value,
    qqEnabled: qqEnabled.value,
    qqApiUrl: qqApiUrl.value,
    defaultQuality: defaultQuality.value,
    downloadDir: downloadDir.value,
    namingRule: namingRule.value,
    defaultFormat: defaultFormat.value,
    themeMode: themeMode.value,
  }
  localStorage.setItem('musictool-settings', JSON.stringify(settings))
  message.success('设置已保存！')
}
</script>

<style lang="scss" scoped>

.settings-view { max-width: 800px; }

.setting-section {
  margin-bottom: $spacing-lg;

  .section-title {
    font-size: 15px; font-weight: 700; color: $text-primary;
    margin-bottom: $spacing-md;
  }
}

.setting-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0;
  gap: 16px;

  .item-info {
    flex: 1; min-width: 0;
    .item-name { font-size: 14px; font-weight: 500; color: $text-primary; }
    .item-desc { font-size: 12px; color: $text-muted; margin-top: 2px; }
  }
}

.setting-sub {
  padding-left: 8px;
  margin-top: 6px;
  font-size: 13px;
  color: $text-secondary;
  label { min-width: 60px; }
}

.about-section { text-align: center; padding: $spacing-xl; }

.about-content {
  .about-logo { margin-bottom: 16px; }

  .about-text h2 { font-size: 22px; margin: 0 0 4px; color: $text-primary; }
  .version { font-size: 13px; color: $text-muted; margin: 0 0 12px; }
  .desc { font-size: 13px; color: $text-secondary; line-height: 1.7; margin: 0; }
}

.save-bar {
  display: flex; justify-content: flex-end; margin-top: $spacing-lg;
}
</style>
