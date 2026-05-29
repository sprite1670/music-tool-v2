<template>
  <header class="app-header">
    <div class="header-left">
      <!-- Logo -->
      <div class="logo" @click="$router.push('/')">
        <svg class="logo-icon" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" />
          <path d="M10 20V12L16 16L22 12V20" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="16" cy="23" r="1.5" fill="currentColor" />
        </svg>
        <span class="logo-text">MusicTool</span>
      </div>
    </div>

    <div class="header-center">
      <!-- 搜索框 -->
      <n-input
        v-model:value="searchQuery"
        :placeholder="'搜索歌曲、歌手...'"
        clearable
        round
        size="medium"
        @keyup.enter="onSearch"
        @focus="showSearchHistory = true"
        @blur="hideSearchHistory"
      >
        <template #prefix>
          <n-icon :component="SearchOutline" />
        </template>
      </n-input>

      <!-- 快捷搜索提示 -->
      <div v-if="showSearchHistory && searchHistory.length > 0" class="search-dropdown">
        <div class="dropdown-title">最近搜索</div>
        <div
          v-for="(item, idx) in searchHistory"
          :key="idx"
          class="history-item"
          @mousedown.prevent="quickSearch(item)"
        >
          <n-icon :component="TimeOutline" size="14" />
          <span>{{ item }}</span>
        </div>
      </div>
    </div>

    <div class="header-right">
      <n-button quaternary circle size="small" @click="$router.push('/settings')">
        <template #icon>
          <n-icon :component="SettingsOutline" />
        </template>
      </n-button>

      <!-- 窗口控制按钮（Tauri 环境） -->
      <template v-if="isTauri">
        <div class="window-controls">
          <button class="wc-btn minimize" @click="minimizeWindow">−</button>
          <button class="wc-btn maximize" @click="toggleMaximize">□</button>
          <button class="wc-btn close" @click="closeWindow">✕</button>
        </div>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NIcon, NButton } from 'naive-ui'
import {
  SearchOutline, TimeOutline, SettingsOutline,
} from '@vicons/ionicons5'

const emit = defineEmits<{
  (e: 'search', query: string): void
}>()

const searchQuery = ref('')
const showSearchHistory = ref(false)
const isTauri = ref(false)
const searchHistory = ref<string[]>([])

onMounted(async () => {
  // 检测是否在 Tauri 环境中
  try {
    await import('@tauri-apps/api/core')
    isTauri.value = true
  } catch {
    isTauri.value = false
  }
  const saved = localStorage.getItem('search-history')
  if (saved) {
    searchHistory.value = JSON.parse(saved)
  }
})

const onSearch = () => {
  if (searchQuery.value.trim()) {
    emit('search', searchQuery.value.trim())
    // 保存搜索历史
    const history = [searchQuery.value.trim(), ...searchHistory.value.filter(
      h => h !== searchQuery.value.trim()
    )].slice(0, 8)
    localStorage.setItem('search-history', JSON.stringify(history))
    searchHistory.value = history
    showSearchHistory.value = false
  }
}

const quickSearch = (query: string) => {
  searchQuery.value = query
  emit('search', query)
  showSearchHistory.value = false
}

const hideSearchHistory = () => {
  setTimeout(() => { showSearchHistory.value = false }, 200)
}

const minimizeWindow = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  } catch {}
}
const toggleMaximize = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().toggleMaximize()
  } catch {}
}
const closeWindow = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  } catch {}
}
</script>

<style lang="scss" scoped>

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $header-height;
  padding: 0 20px;
  background: $bg-secondary;
  border-bottom: 1px solid $border-color;
  gap: 20px;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover { opacity: 0.8; }

  .logo-icon {
    width: 30px;
    height: 30px;
    color: $primary-color;
  }

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, $primary-color, $primary-dark);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.header-center {
  flex: 1;
  max-width: 480px;
  position: relative;

  :deep(.n-input) {
    --n-border-focus: 1px solid $primary-color !important;
    --n-box-shadow-focus: 0 0 0 2px rgba(78, 205, 196, 0.2) !important;
  }
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 6px;
  background: $bg-secondary;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  padding: 8px 0;
  z-index: 100;

  .dropdown-title {
    padding: 8px 16px;
    font-size: 12px;
    color: $text-muted;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.15s;
    font-size: 14px;

    &:hover {
      background: $primary-bg;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.window-controls {
  display: flex;
  margin-left: 12px;

  .wc-btn {
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: $text-secondary;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: $bg-tertiary;
      color: $text-primary;
    }

    &.close:hover {
      background: $error;
      color: white;
    }
  }
}
</style>
