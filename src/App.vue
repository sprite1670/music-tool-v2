<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-notification-provider>
      <n-dialog-provider>
        <n-message-provider>
          <div class="app-container">
            <router-view />
          </div>
        </n-message-provider>
      </n-dialog-provider>
    </n-notification-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  NConfigProvider, NNotificationProvider, NDialogProvider,
  NMessageProvider,
} from 'naive-ui'

const themeOverrides = {
  common: {
    primaryColor: '#4ECDC4',
    primaryColorHover: '#7EDDD6',
    primaryColorPressed: '#26A69A',
    primaryColorSuppl: '#7EDDD6',
  },
  Card: {
    borderRadius: '12px',
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
  },
  Input: {
    borderRadius: '8px',
  },
}
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
               'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.app-container {
  height: 100vh;
  background: #F7F9FC;
  color: #2C3E50;
}
</style>
