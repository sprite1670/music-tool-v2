<template>
  <div class="home-view">
    <h1 class="page-title">
      <span class="icon">🎵</span> 欢迎使用 MusicTool
    </h1>

    <!-- 快捷入口 -->
    <div class="quick-grid">
      <div class="quick-card" @click="$router.push('/search')">
        <div class="qc-icon" style="background: linear-gradient(135deg, #4ECDC4, #44A08D);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <circle cx="11" cy="11" r="7" stroke="white" stroke-width="2" fill="none"/>
            <path d="M16 16 L21 21" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="qc-title">搜索歌曲</div>
        <div class="qc-desc">搜索网易云音乐 / QQ音乐</div>
      </div>

      <div class="quick-card" @click="$router.push('/converter')">
        <div class="qc-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M6 4v16l12-8L6 4z"/>
          </svg>
        </div>
        <div class="qc-title">格式转换</div>
        <div class="qc-desc">MP3/FLAC/WAV/AAC/OGG</div>
      </div>

      <div class="quick-card" @click="$router.push('/metadata')">
        <div class="qc-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  stroke="white" stroke-width="1.5" fill="none"/>
            <path d="M14 2v6h6M9 13h6M9 17h4" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="qc-title">编辑标签</div>
        <div class="qc-desc">修改歌名、歌手、专辑封面</div>
      </div>

      <div class="quick-card" @click="$router.push('/downloads')">
        <div class="qc-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                  stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        <div class="qc-title">下载管理</div>
        <div class="qc-desc">高品质歌曲下载 (320k/FLAC)</div>
      </div>
    </div>

    <!-- 最近使用 -->
    <section v-if="recentSongs.length > 0" class="recent-section">
      <h2 class="section-title">最近操作</h2>
      <div class="song-list-mini">
        <div v-for="(song, idx) in recentSongs" :key="idx" class="song-row">
          <img :src="song.cover || defaultCover" class="row-cover" />
          <div class="row-info">
            <div class="row-name">{{ song.name }}</div>
            <div class="row-sub">{{ song.artists?.join(' / ') }}</div>
          </div>
          <n-tag :type="'info'" size="small" round>{{ song.action }}</n-tag>
        </div>
      </div>
      <n-button v-if="recentSongs.length > 0" size="small" quaternary @click="clearRecent" style="margin-top: 8px;">
        清除记录
      </n-button>
    </section>

    <!-- 使用统计 -->
    <section class="stats-section">
      <h2 class="section-title">工具说明</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">2</div>
          <div class="stat-label">支持的音乐平台</div>
          <div class="stat-detail">网易云音乐 · QQ音乐</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">5</div>
          <div class="stat-label">支持的音频格式</div>
          <div class="stat-detail">MP3 · FLAC · WAV · AAC · OGG</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">✓</div>
          <div class="stat-label">跨平台支持</div>
          <div class="stat-detail">Windows 11 · macOS</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">0</div>
          <div class="stat-label">云存储依赖</div>
          <div class="stat-detail">纯接口调用 · 本地处理</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NTag } from 'naive-ui'
import { getRecent, clearRecent as clearRecentService } from '@/services/recent'

const recentSongs = ref<any[]>([])

function loadRecent() {
  recentSongs.value = getRecent()
}

function clearRecent() {
  clearRecentService()
  recentSongs.value = []
}

onMounted(() => {
  loadRecent()
})

const defaultCover = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect fill="#E1E8ED" width="40" height="40" rx="6"/></svg>'
)
</script>

<style lang="scss" scoped>
.home-view {
  max-width: 1000px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.quick-card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(78,205,196,0.15);
    border-color: rgba(78,205,196,0.3);
  }

  .qc-icon {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .qc-title {
    font-size: 15px;
    font-weight: 600;
    color: #2C3E50;
    margin-bottom: 4px;
  }

  .qc-desc {
    font-size: 12px;
    color: #90A4AE;
  }
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 16px;
}

.recent-section,
.stats-section {
  margin-bottom: 40px;
}

.song-list-mini {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #FFFFFF;
  border-radius: 8px;
  transition: background 0.15s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);

  &:hover { background: #F7F9FC; }

  .row-cover {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .row-info {
    flex: 1;
    min-width: 0;

    .row-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-sub {
      font-size: 11px;
      color: #90A4AE;
      margin-top: 2px;
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: #FFFFFF;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);

  .stat-value {
    font-size: 32px;
    font-weight: 800;
    color: #4ECDC4;
    margin-bottom: 6px;
  }

  .stat-label {
    font-size: 13px;
    font-weight: 600;
    color: #2C3E50;
    margin-bottom: 4px;
  }

  .stat-detail {
    font-size: 12px;
    color: #90A4AE;
  }
}
</style>
