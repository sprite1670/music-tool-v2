<template>
  <footer class="player-bar" v-if="currentSong">
    <div class="player-left">
      <div class="song-cover">
        <img :src="currentSong.cover || defaultCover" alt="cover" />
      </div>
      <div class="song-info">
        <div class="song-name">{{ currentSong.name }}</div>
        <div class="song-artist">{{ currentSong.artists?.join(' / ') }}</div>
      </div>
    </div>

    <div class="player-center">
      <div class="player-controls">
        <n-button quaternary circle size="small">
          <template #icon><n-icon :component="PlaySkipBackOutline" /></template>
        </n-button>
        <n-button circle type="primary" size="medium"
          :style="{ backgroundColor: '#4ECDC4' }"
          @click="togglePlay">
          <template #icon>
            <n-icon :component="isPlaying ? PauseOutline : PlayOutline" size="22" />
          </template>
        </n-button>
        <n-button quaternary circle size="small">
          <template #icon><n-icon :component="PlaySkipForwardOutline" /></template>
        </n-button>
      </div>
      <div class="progress-section">
        <span class="time">{{ formatTime(currentTime) }}</span>
        <n-slider v-model:value="progress" :step="0.1" :min="0" :max="100"
                  style="width: 320px; margin: 0 12px;" />
        <span class="time">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <div class="player-right">
      <n-button quaternary circle size="small">
        <template #icon><n-icon :component="VolumeHighOutline" /></template>
      </n-button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NIcon, NSlider } from 'naive-ui'
import {
  PlayOutline, PauseOutline, PlaySkipBackOutline,
  PlaySkipForwardOutline, VolumeHighOutline,
} from '@vicons/ionicons5'

interface SongInfo {
  name: string
  artists?: string[]
  cover?: string
  duration?: number
}

const currentSong = ref<SongInfo | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const progress = ref(0)

const defaultCover = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<rect fill="#E1E8ED" width="48" height="48" rx="8"/>' +
  '<circle cx="24" cy="20" r="10" fill="#B0BEC5"/><path d="M18 32 L30 38 L30 18" stroke="#90A4AE" stroke-width="3" fill="none"/></svg>'
)

const togglePlay = () => { isPlaying.value = !isPlaying.value }

const formatTime = (sec: number): string => {
  if (!sec) return '00:00'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style lang="scss" scoped>

.player-bar {
  height: $player-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: $bg-secondary;
  border-top: 1px solid $border-color;
  gap: 24px;
}

.player-left {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 260px;
  flex-shrink: 0;

  .song-cover {
    width: 44px;
    height: 44px;
    border-radius: $radius-sm;
    overflow: hidden;
    box-shadow: $shadow-sm;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .song-info {
    min-width: 0;

    .song-name {
      font-size: 13px;
      font-weight: 600;
      color: $text-primary;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .song-artist {
      font-size: 12px;
      color: $text-muted;
      margin-top: 2px;
    }
  }
}

.player-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .player-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .progress-section {
    display: flex;
    align-items: center;
    font-size: 11px;
    color: $text-muted;

    .time {
      min-width: 40px;
      text-align: center;
    }
  }
}

.player-right {
  width: 60px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
