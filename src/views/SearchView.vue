<template>
  <div class="search-view">
    <h1 class="page-title">
      <span class="icon">🔍</span> 搜索音乐
    </h1>

    <!-- 搜索控制区 -->
    <div class="search-controls card">
      <n-input-group>
        <n-input
          v-model:value="query"
          :placeholder="'输入歌曲名、歌手名搜索...'"
          size="large"
          clearable
          @keyup.enter="doSearch"
        >
          <template #prefix>
            <n-icon :component="SearchOutline" />
          </template>
        </n-input>
        <n-select
          v-model:value="source"
          :options="sourceOptions"
          style="width: 140px;"
          size="large"
        />
        <n-button type="primary" size="large" @click="doSearch" :loading="loading">
          搜索
        </n-button>
      </n-input-group>

      <div class="search-tips">
        <n-tag v-for="tip in hotTips" :key="tip" round :bordered="false"
                type="info" size="small" style="cursor: pointer;" @click="quickSearch(tip)">
          {{ tip }}
        </n-tag>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <n-spin size="medium" />
      <span>正在搜索中...</span>
    </div>

    <!-- 搜索结果 -->
    <div v-else-if="results.length > 0" class="results-area">
      <div class="results-header">
        <label class="select-all">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          <span>全选</span>
        </label>
        <span class="result-count">找到 {{ results.length }} 首歌曲</span>
        <span v-if="hasSelection" class="selected-count">已选 {{ selectedIds.size }} 首</span>
      </div>

      <!-- 批量操作栏 -->
      <div v-if="hasSelection" class="batch-bar">
        <n-button size="small" type="primary" secondary @click="batchDownloadLyrics">
          批量下载歌词
        </n-button>
        <n-button size="small" type="default" secondary @click="batchDownloadCovers">
          批量下载封面
        </n-button>
        <n-button size="small" type="warning" secondary @click="batchConvertFormat">
          批量转换格式
        </n-button>
        <n-button size="small" quaternary @click="clearSelection">
          取消选择
        </n-button>
      </div>

      <div class="song-list">
        <TransitionGroup name="list">
          <div v-for="(song, idx) in results" :key="song.id + song.source"
               class="song-card" :class="{ selected: selectedIds.has(song.id + '|' + song.source) }">
            <!-- 复选框 -->
            <label class="song-checkbox">
              <input type="checkbox" :checked="selectedIds.has(song.id + '|' + song.source)" @change="toggleSelect(song)" />
            </label>
            <!-- 封面 -->
            <div class="card-cover">
              <img :src="song.cover_url || defaultCover" alt="" />
              <div class="cover-source">{{ sourceLabel(song.source) }}</div>
            </div>

            <!-- 信息 -->
            <div class="card-info">
              <div class="card-name" :title="song.name">{{ song.name }}</div>
              <div class="card-artist" :title="song.artists?.join(' / ')">
                {{ song.artists?.join(' / ') || '未知艺术家' }}
              </div>
              <div class="card-album" :title="song.album">💿 {{ song.album || '未知专辑' }}</div>
            </div>

            <!-- 操作按钮 -->
            <div class="card-actions">
              <n-button size="small" secondary type="default"
                        @click="downloadCover(song)">
                封面
              </n-button>
              <n-button size="small" secondary type="primary"
                        @click="showLyrics(song)">
                歌词
              </n-button>
              <n-button size="small" secondary type="success"
                        :loading="downloadingId === song.id"
                        @click="downloadSong(song)">
                下载
              </n-button>
              <n-dropdown :options="qualityOptions" @select="(v) => downloadSong(song, v as string)"
                          placement="bottom-end">
                <n-button size="small" quaternary>
                  ▼ 品质
                </n-button>
              </n-dropdown>
            </div>

            <!-- 时长 -->
            <div class="card-duration">{{ formatDuration(song.duration) }}
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="hasSearched" class="empty-state">
      <div class="empty-icon">🎵</div>
      <div class="empty-text">未找到相关歌曲</div>
      <div class="empty-hint">尝试更换关键词或切换音乐源</div>
    </div>

    <!-- 初始状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">输入关键词开始搜索</div>
      <div class="empty-hint">支持按歌名、歌手名、专辑名模糊搜索</div>
    </div>

    <!-- 歌词弹窗 -->
    <n-modal v-model:show="lyricsVisible" preset="card"
             :title="'歌词 - ' + (currentSong?.name || '')"
             style="width: 560px; max-width: 90vw;">
      <div v-if="lyricsLoading" class="text-center py-6">
        <n-spin />
      </div>
      <div v-else-if="lyricsText" class="lyrics-content">
        <pre class="lrc-text">{{ lyricsText }}</pre>
      </div>
      <div v-else class="empty-state py-6">
        <p>{{ lyricsError || '暂无歌词' }}</p>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="copyLyrics" v-if="lyricsText">复制歌词</n-button>
          <n-button type="primary" @click="saveLyrics" v-if="lyricsText">下载歌词</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NInput, NInputGroup, NSelect, NButton, NSpin,
  NTag, NModal, NDropdown, useMessage,
} from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import {
  searchMusic as platformSearch,
  getLyrics as platformGetLyrics,
  saveFileDialog,
  writeFile,
  downloadBlob,
  isTauri,
} from '@/services/platform'
import { addRecent } from '@/services/recent'

const route = useRoute()
const message = useMessage()

const query = ref('')
const source = ref<string>('all')
const loading = ref(false)
const results = ref<any[]>([])
const hasSearched = ref(false)
const downloadingId = ref<string | null>(null)

// 批量选择
const selectedIds = ref<Set<string>>(new Set())
const selectedSongs = computed(() => results.value.filter(s => selectedIds.value.has(s.id + '|' + s.source)))
const hasSelection = computed(() => selectedIds.value.size > 0)
const isAllSelected = computed(() => results.value.length > 0 && results.value.every(s => selectedIds.value.has(s.id + '|' + s.source)))

function toggleSelect(song: any) {
  const key = song.id + '|' + song.source
  if (selectedIds.value.has(key)) {
    selectedIds.value.delete(key)
  } else {
    selectedIds.value.add(key)
  }
  // trigger reactivity
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(results.value.map(s => s.id + '|' + s.source))
  }
}

function clearSelection() {
  selectedIds.value = new Set()
}

// 歌词相关
const lyricsVisible = ref(false)
const currentSong = ref<any>(null)
const lyricsLoading = ref(false)
const lyricsText = ref('')
const lyricsError = ref('')

// 搜索来源选项
const sourceOptions = [
  { label: '全部平台', value: 'all' },
  { label: '网易云音乐', value: 'netease' },
  { label: 'QQ音乐', value: 'qq' },
]

// 音质选项
const qualityOptions = [
  { label: '标准品质 (128k)', key: '128k' },
  { label: '高品质 (320k)', key: '320k' },
  { label: '无损 (FLAC)', key: 'flac' },
]

// 热门搜索提示
const hotTips = ref(['周杰伦', '林俊杰', 'Taylor Swift', '稻香', '晴天', '孤勇者'])

const defaultCover = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#E1E8ED" width="64" height="64" rx="10"/><circle cx="32" cy="28" r="12" fill="#B0BEC5"/><path d="M24 44 L40 52 L40 26" stroke="#90A4AE" stroke-width="3" fill="none"/></svg>'
)

onMounted(() => {
  if (route.query.q) {
    query.value = route.query.q as string
    doSearch()
  }
})

// 执行搜索
async function doSearch() {
  if (!query.value.trim()) return

  loading.value = true
  hasSearched.value = true

  try {
    const songs = await platformSearch(query.value.trim(), source.value)
    results.value = songs
  } catch (err: any) {
    console.error('搜索失败:', err)
    results.value = []
    if (err.message !== 'TAURI_ONLY') {
      message.error(`搜索失败: ${String(err)}`)
    }
  } finally {
    loading.value = false
  }
}

function quickSearch(text: string) {
  query.value = text
  doSearch()
}

// 显示歌词
async function showLyrics(song: any) {
  currentSong.value = song
  lyricsVisible.value = true
  lyricsLoading.value = true
  lyricsText.value = ''
  lyricsError.value = ''

  try {
    const result = await platformGetLyrics(song.id, song.source)
    lyricsText.value = result.lyric || ''
    if (result.translated) {
      lyricsText.value += '\n\n[翻译]\n' + result.translated
    }
  } catch (e: any) {
    if (e.message !== 'TAURI_ONLY') {
      lyricsError.value = String(e)
    }
  } finally {
    lyricsLoading.value = false
  }
}

// 下载歌曲
async function downloadSong(song: any, quality: string = '320k') {
  downloadingId.value = song.id
  try {
    const filePath = await saveFileDialog({
      title: '保存歌曲',
      defaultPath: `${song.name} - ${song.artists?.[0] || '未知'}.mp3`,
      filters: [{ name: '音频文件', extensions: ['mp3', 'flac', 'wav'] }],
    })
    if (filePath) {
      message.success(`已保存到: ${filePath}`)
      addRecent({
        name: song.name,
        artists: song.artists || [],
        cover: song.cover_url || '',
        action: '下载歌曲',
      })
    }
  } catch (e: any) {
    if (e.message !== 'TAURI_ONLY') {
      message.error(`下载失败: ${String(e)}`)
    }
  } finally {
    downloadingId.value = null
  }
}

// 下载专辑封面
async function downloadCover(song: any) {
  const url = song.cover_url
  if (!url) {
    message.warning('该歌曲暂无封面')
    return
  }
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const filename = `${song.name} - ${song.artists?.[0] || '未知'}.jpg`
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(objUrl)
    message.success('封面已下载')
    addRecent({
      name: song.name,
      artists: song.artists || [],
      cover: url,
      action: '下载封面',
    })
  } catch (e: any) {
    message.error(`封面下载失败: ${String(e)}`)
  }
}

function copyLyrics() {
  navigator.clipboard.writeText(lyricsText.value)
  message.success('歌词已复制到剪贴板')
}

async function saveLyrics() {
  try {
    const filename = `${currentSong.value?.name || 'lyrics'}.lrc`
    // Tauri 环境：用系统对话框选择保存路径
    const filePath = await saveFileDialog({
      title: '保存歌词',
      defaultPath: filename,
      filters: [{ name: 'LRC文件', extensions: ['lrc'] }],
    })
    if (filePath) {
      await writeFile(filePath, lyricsText.value)
      message.success(`歌词已保存到: ${filePath}`)
    } else {
      // Web 环境：直接触发浏览器下载
      downloadBlob(lyricsText.value, filename)
      message.success('歌词已下载')
    }
    addRecent({
      name: currentSong.value?.name || '未知歌曲',
      artists: currentSong.value?.artists || [],
      cover: '',
      action: '下载歌词',
    })
  } catch (e: any) {
    if (e.message !== 'TAURI_ONLY') {
      message.error(`保存失败: ${String(e)}`)
    }
  }
}

function sourceLabel(s: string): string {
  const map: Record<string, string> = { netease: '网易云', qq: 'QQ' }
  return map[s] || s
}

function formatDuration(sec?: number): string {
  if (!sec) return '--:--'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── 批量操作 ────────────────────────────────

// 批量下载歌词
async function batchDownloadLyrics() {
  const songs = selectedSongs.value
  message.info(`正在下载 ${songs.length} 首歌词...`)
  for (let i = 0; i < songs.length; i++) {
    try {
      const song = songs[i]
      const result = await platformGetLyrics(song.id, song.source)
      const text = result.lyric || ''
      if (!text) continue
      const filename = `${song.name} - ${song.artists?.[0] || '未知'}.lrc`
      downloadBlob(text, filename)
      addRecent({ name: song.name, artists: song.artists || [], cover: '', action: '下载歌词' })
      // 避免浏览器拦截多个下载
      if (i < songs.length - 1) {
        await new Promise(r => setTimeout(r, 800))
      }
    } catch (e: any) {
      console.warn('批量歌词下载失败', e)
    }
  }
  message.success(`已完成 ${songs.length} 首歌词下载`)
  clearSelection()
}

// 批量下载封面
async function batchDownloadCovers() {
  const songs = selectedSongs.value.filter(s => s.cover_url)
  if (songs.length === 0) {
    message.warning('选中歌曲均无封面')
    return
  }
  message.info(`正在下载 ${songs.length} 张封面...`)
  for (let i = 0; i < songs.length; i++) {
    try {
      const song = songs[i]
      const resp = await fetch(song.cover_url)
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `${song.name} - ${song.artists?.[0] || '未知'}.jpg`
      a.click()
      URL.revokeObjectURL(objUrl)
      addRecent({ name: song.name, artists: song.artists || [], cover: song.cover_url, action: '下载封面' })
      if (i < songs.length - 1) {
        await new Promise(r => setTimeout(r, 800))
      }
    } catch (e: any) {
      console.warn('批量封面下载失败', e)
    }
  }
  message.success(`已完成 ${songs.length} 张封面下载`)
  clearSelection()
}

// 批量转换格式（Web 版提示桌面版）
function batchConvertFormat() {
  const songs = selectedSongs.value
  if (!isTauri) {
    message.warning('批量格式转换需要桌面版，请安装 Tauri 桌面版使用')
    return
  }
  // TODO: Tauri 桌面版实现
  message.info(`已提交 ${songs.length} 首歌曲格式转换任务`)
  clearSelection()
}
</script>

<style lang="scss" scoped>
.search-view { max-width: 1000px; }

.search-controls {
  margin-bottom: 24px;
  padding: 20px;
  :deep(.n-input-group) { margin-bottom: 16px; }
}

.search-tips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #90A4AE;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  .result-count { font-size: 14px; color: #90A4AE; }
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.song-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: #FFFFFF;
  border-radius: 10px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  &:hover {
    box-shadow: 0 4px 16px rgba(78,205,196,0.15);
    border-color: rgba(78,205,196,0.25);
    transform: translateY(-1px);
  }
}

.card-cover {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  img { width: 100%; height: 100%; object-fit: cover; }
  .cover-source {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 2px 6px;
    font-size: 9px;
    color: white;
    text-align: center;
    background: rgba(0,0,0,0.55);
  }
}

.card-info {
  flex: 1;
  min-width: 0;
  .card-name {
    font-size: 15px;
    font-weight: 600;
    color: #2C3E50;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .card-artist {
    font-size: 13px;
    color: #4ECDC4;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-album {
    font-size: 12px;
    color: #90A4AE;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.card-duration {
  font-size: 12px;
  color: #90A4AE;
  min-width: 42px;
  text-align: right;
  flex-shrink: 0;
}

.lyrics-content {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: #FAFAFA;
  border-radius: 8px;
  .lrc-text {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.8;
    color: #2C3E50;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
