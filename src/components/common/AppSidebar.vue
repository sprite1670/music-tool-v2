<template>
  <aside class="app-sidebar">
    <nav class="sidebar-nav">
      <div
        v-for="item in menuItems"
        :key="item.name"
        :class="['nav-item', { active: props.activeMenu === item.name }]"
        @click="$emit('navigate', item.name)"
      >
        <div class="nav-icon">
          <n-icon :component="item.icon" size="20" />
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </nav>

    <!-- 底部区域 -->
    <div class="sidebar-footer">
      <div class="nav-item" @click="$emit('navigate', 'settings')">
        <div class="nav-icon">
          <n-icon :component="SettingsOutline" size="20" />
        </div>
        <span class="nav-label">设置</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import {
  SearchOutline,
  SyncOutline,
  CreateOutline,
  DownloadOutline,
  DiscOutline,
  FolderOpenOutline,
  SettingsOutline,
} from '@vicons/ionicons5'

const props = defineProps<{
  activeMenu: string
}>()

defineEmits<{
  (e: 'navigate', name: string): void
}>()

const menuItems = [
  { name: 'home', label: '首页', icon: DiscOutline },
  { name: 'search', label: '搜索', icon: SearchOutline },
  { name: 'converter', label: '格式转换', icon: SyncOutline },
  { name: 'metadata', label: '元数据', icon: CreateOutline },
  { name: 'downloads', label: '下载管理', icon: DownloadOutline },
]
</script>

<style lang="scss" scoped>

.app-sidebar {
  width: $sidebar-width;
  background: $bg-secondary;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 12px 8px;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;
  color: $text-secondary;
  font-size: 14px;

  &:hover {
    background: $primary-bg;
    color: $primary-color;
  }

  &.active {
    background: linear-gradient(135deg, rgba(78, 205, 196, 0.12), rgba(78, 205, 196, 0.06));
    color: $primary-dark;
    font-weight: 600;

    .nav-icon {
      color: $primary-color;
    }
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    transition: transform 0.2s;
  }

  .nav-label {
    white-space: nowrap;
  }
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid $border-light;
}
</style>
