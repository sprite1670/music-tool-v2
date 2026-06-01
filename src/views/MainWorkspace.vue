<template>
  <div class="workspace">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="logo" @click="reloadApp">
          <svg class="logo-icon" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" />
            <path d="M10 20V12L16 16L22 12V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="16" cy="23" r="1.5" fill="currentColor" />
          </svg>
          <span class="logo-text">MusicTool</span>
        </div>
      </div>

      <div class="toolbar-center">
        <div class="search-box">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索歌曲、歌手..."
            clearable
            round
            size="small"
            @keyup.enter="doSearch"
          >
            <template #prefix>
              <n-icon :component="SearchOutline" />
            </template>
          </n-input>
          <n-button size="small" type="primary" @click="doSearch">搜索</n-button>
        </div>
      </div>

      <div class="toolbar-right">
        <n-button size="small" secondary @click="scanLocalSongs" title="扫描本地歌曲">
          <template #icon><n-icon :component="FolderOpenOutline" /></template>
          <span class="btn-text">扫描</span>
        </n-button>
        <n-button size="small" secondary :disabled="selectedCount === 0" @click="batchDownloadSongs" title="批量下载歌曲">
          <template #icon><n-icon :component="DownloadOutline" /></template>
          <span class="btn-text">下载</span>
        </n-button>
        <n-button size="small" secondary :disabled="selectedCount === 0" @click="batchDownloadLyrics" title="批量下载歌词">
          <template #icon><n-icon :component="DocumentTextOutline" /></template>
          <span class="btn-text">歌词</span>
        </n-button>
        <n-button size="small" secondary :disabled="selectedCount === 0" @click="batchDownloadCovers" title="批量下载封面">
          <template #icon><n-icon :component="ImageOutline" /></template>
          <span class="btn-text">封面</span>
        </n-button>
        <n-button size="small" secondary :disabled="selectedCount === 0" @click="batchConvert" title="批量格式转换">
          <template #icon><n-icon :component="SyncOutline" /></template>
          <span class="btn-text">转换</span>
        </n-button>
        <n-divider vertical style="margin: 0 4px;" />
        <n-button size="small" quaternary @click="showSettings = true" title="设置">
          <template #icon><n-icon :component="SettingsOutline" /></template>
        </n-button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="workspace-body">
      <!-- 左侧：歌曲列表 -->
      <div class="song-list-panel">
        <div class="panel-header">
          <span class="panel-title">歌曲列表</span>
          <span v-if="songs.length > 0" class="panel-count">{{ songs.length }} 首</span>
          <label v-if="songs.length > 0" class="select-all">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
            <span>全选</span>
          </label>
        </div>

        <div v-if="songs.length === 0" class="empty-state">
          <n-empty description="暂无歌曲">
            <template #extra>
              <n-button size="small" type="primary" @click="scanLocalSongs">扫描本地歌曲</n-button>
              <n-button size="small" secondary @click="focusSearch">搜索网络歌曲</n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="song-table-wrapper">
          <table class="song-table">
            <thead>
              <tr>
                <th class="col-check"></th>
                <th class="col-title">标题</th>
                <th class="col-artist">歌手</th>
                <th class="col-album">专辑</th>
                <th class="col-source">来源</th>
                <th class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="song in songs"
                :key="song.id + '|' + song.source"
                :class="{ active: currentSong?.id === song.id, selected: selectedIds.has(song.id + '|' + song.source) }"
                @click="selectSong(song)"
              >
                <td class="col-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(song.id + '|' + song.source)"
                    @change="toggleSelect(song)"
                  />
                </td>
                <td class="col-title">
                  <div class="title-cell">
                    <img v-if="song.cover_url" :src="song.cover_url" class="mini-cover" />
                    <div v-else class="mini-cover-placeholder">♪</div>
                    <span class="song-name">{{ song.name }}</span>
                  </div>
                </td>
                <td class="col-artist">{{ song.artists?.join(', ') || '-' }}</td>
                <td class="col-album">{{ song.album || '-' }}</td>
                <td class="col-source">
                  <n-tag size="tiny" :type="song.source === 'netease' ? 'success' : song.source === 'qq' ? 'warning' : 'info'" round>
                    {{ song.source === 'netease' ? '网易云' : song.source === 'qq' ? 'QQ' : song.source === 'kugou' ? '酷狗' : song.source }}
                  </n-tag>
                </td>
                <td class="col-actions" @click.stop>
                  <n-button size="tiny" quaternary @click="downloadSong(song)">下载</n-button>
                  <n-button size="tiny" quaternary @click="showLyricFor(song)">歌词</n-button>
                  <n-button size="tiny" quaternary @click="downloadCoverFor(song)">封面</n-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 右侧：歌曲信息编辑 -->
      <div class="info-panel">
        <div class="panel-header">
          <span class="panel-title">歌曲信息</span>
        </div>

        <div v-if="!currentSong" class="empty-state">
          <n-empty description="选择一首歌查看详情" />
        </div>

        <div v-else class="info-content">
          <div class="cover-section">
            <div class="cover-frame">
              <img v-if="currentSong.cover_url" :src="currentSong.cover_url" class="cover-img" />
              <div v-else class="cover-placeholder">
                <n-icon :component="DiscOutline" size="48" />
              </div>
            </div>
            <div class="cover-actions">
              <n-button size="tiny" secondary @click="downloadSong(currentSong)">下载歌曲</n-button>
              <n-button size="tiny" secondary @click="downloadCoverFor(currentSong)">下载封面</n-button>
              <n-button size="tiny" secondary @click="showLyricFor(currentSong)">查看歌词</n-button>
              <n-button v-if="currentSong?.source === 'local'" size="tiny" secondary @click="loadLyricsForCurrent">加载歌词</n-button>
            </div>
          </div>

          <div class="meta-form">
            <div class="form-row">
              <label>标题</label>
              <n-input v-model:value="editForm.title" size="small" placeholder="歌曲标题" />
            </div>
            <div class="form-row">
              <label>歌手</label>
              <n-input v-model:value="editForm.artist" size="small" placeholder="歌手/艺术家" />
            </div>
            <div class="form-row">
              <label>词作者</label>
              <n-input v-model:value="editForm.lyricist" size="small" placeholder="词作者" />
            </div>
            <div class="form-row">
              <label>曲作者</label>
              <n-input v-model:value="editForm.composer" size="small" placeholder="曲作者" />
            </div>
            <div class="form-row">
              <label>专辑</label>
              <n-input v-model:value="editForm.album" size="small" placeholder="专辑名称" />
            </div>
            <div class="form-row">
              <label>歌词</label>
              <n-input
                v-model:value="editForm.lyrics"
                type="textarea"
                size="small"
                :rows="8"
                placeholder="歌词内容（LRC格式）"
                class="lyrics-textarea"
              />
            </div>
            <div class="form-actions">
              <n-button size="small" type="primary" :loading="saving" @click="saveMetadata">保存修改</n-button>
              <n-button size="small" secondary @click="fetchLyricsForCurrent">获取歌词</n-button>
              <n-button size="small" quaternary @click="downloadLyricsForCurrent">下载歌词</n-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span class="status-text">{{ statusText }}</span>
      <span v-if="selectedCount > 0" class="status-extra">已选择 {{ selectedCount }} 首</span>
    </div>

    <!-- 歌词弹窗 -->
    <n-modal
      v-model:show="showLyricModal"
      title="歌词"
      preset="card"
      :style="{ width: '600px', maxHeight: '80vh' }"
    >
      <div class="lyric-modal-content">
        <div class="lyric-tabs">
          <div :class="['lyric-tab', { active: lyricTab === 'original' }]" @click="lyricTab = 'original'">原文</div>
          <div :class="['lyric-tab', { active: lyricTab === 'translated' }]" @click="lyricTab = 'translated'">翻译</div>
        </div>
        <pre class="lyric-display">{{ lyricDisplay }}</pre>
        <div class="lyric-modal-actions">
          <n-button size="small" type="primary" @click="saveLyricsToFile">保存到文件</n-button>
          <n-button size="small" secondary @click="showLyricModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 设置弹窗 -->
    <n-modal
      v-model:show="showSettings"
      title="设置"
      preset="card"
      :style="{ width: '500px' }"
    >
      <div class="settings-content">
        <div class="settings-row">
          <label>下载目录</label>
          <div class="settings-input-row">
            <n-input v-model:value="downloadDir" size="small" readonly placeholder="选择下载目录" />
            <n-button size="tiny" @click="selectDownloadDir">浏览</n-button>
          </div>
        </div>
        <div class="settings-row">
          <label>默认歌词来源</label>
          <n-radio-group v-model:value="defaultLyricSource" size="small">
            <n-radio-button value="netease">网易云</n-radio-button>
            <n-radio-button value="qq">QQ音乐</n-radio-button>
          </n-radio-group>
        </div>
        <div class="settings-row">
          <label>同时下载翻译歌词</label>
          <n-switch v-model:value="downloadTranslated" size="small" />
        </div>
        <div class="settings-actions">
          <n-button size="small" type="primary" @click="saveSettings">保存</n-button>
          <n-button size="small" quaternary @click="showSettings = false">取消</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 格式转换弹窗 -->
    <n-modal
      v-model:show="showConvertModal"
      title="格式转换"
      preset="card"
      :style="{ width: '560px' }"
    >
      <div class="convert-content">
        <div class="convert-row">
          <label>目标格式</label>
          <n-radio-group v-model:value="convertTargetFormat" size="small">
            <n-radio-button value="mp3">MP3</n-radio-button>
            <n-radio-button value="wav">WAV</n-radio-button>
            <n-radio-button value="ogg">OGG</n-radio-button>
          </n-radio-group>
        </div>
        <div class="convert-row">
          <n-button size="small" @click="addConvertFiles">添加音频文件</n-button>
          <span class="convert-hint">支持 MP3, WAV, FLAC, OGG 等格式</span>
        </div>
        <div class="convert-file-list">
          <div v-for="(item, index) in convertFiles" :key="index" class="convert-file-item">
            <span class="file-name">{{ item.name }}</span>
            <span class="file-status" :class="{ 'status-done': item.status === '完成', 'status-error': item.status.includes('失败') }">
              {{ item.status }}
            </span>
            <n-button size="tiny" quaternary @click="removeConvertFile(index)">删除</n-button>
          </div>
          <n-empty v-if="convertFiles.length === 0" description="暂无文件" size="small" />
        </div>
        <n-progress v-if="converting" :percentage="convertProgress" :show-indicator="true" />
        <div class="convert-actions">
          <n-button size="small" type="primary" :loading="converting" :disabled="convertFiles.length === 0" @click="startConvert">
            开始转换
          </n-button>
          <n-button size="small" quaternary @click="showConvertModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NInput, NButton, NIcon, NTag, NEmpty, NModal,
  NRadioGroup, NRadioButton, NSwitch, NDivider, useMessage,
} from 'naive-ui'
import {
  SearchOutline, FolderOpenOutline, DocumentTextOutline,
  ImageOutline, DownloadOutline,
  SyncOutline, SettingsOutline, DiscOutline,
} from '@vicons/ionicons5'
import {
  searchMusic, getLyrics, saveFileDialog,
  downloadBlob, selectFolderDialog, isTauri,
  downloadSong as platformDownloadSong, loadLyricsForLocal,
} from '@/services/platform'
import { addRecent } from '@/services/recent'
import { invoke } from '@tauri-apps/api/core'

const message = useMessage()

// ── 搜索 ──────────────────────────────────
const searchQuery = ref('')
const searching = ref(false)

async function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  searching.value = true
  statusText.value = `正在搜索 "${q}"...`
  try {
    const results = await searchMusic(q, 'all')
    songs.value = results
    statusText.value = `搜索完成，找到 ${results.length} 首歌曲`
    if (results.length > 0) selectSong(results[0])
  } catch (e: any) {
    message.error(`搜索失败: ${String(e)}`)
    statusText.value = '搜索失败'
  } finally {
    searching.value = false
  }
}

function focusSearch() {
  const input = document.querySelector('.search-box input') as HTMLInputElement
  input?.focus()
}

function reloadApp() {
  songs.value = []
  currentSong.value = null
  selectedIds.value = new Set()
  searchQuery.value = ''
  statusText.value = '就绪'
}

// ── 歌曲列表与选择 ────────────────────────
const songs = ref<any[]>([])
const currentSong = ref<any>(null)
const selectedIds = ref<Set<string>>(new Set())

const selectedCount = computed(() => selectedIds.value.size)
const isAllSelected = computed(() =>
  songs.value.length > 0 && songs.value.every(s => selectedIds.value.has(s.id + '|' + s.source))
)

function selectSong(song: any) {
  currentSong.value = song
  editForm.value = {
    title: song.name || '',
    artist: song.artists?.join(', ') || '',
    album: song.album || '',
    lyricist: song.lyricist || '',
    composer: song.composer || '',
    lyrics: '',
  }
  fetchLyricsForCurrent()
}

function toggleSelect(song: any) {
  const key = song.id + '|' + song.source
  const next = new Set(selectedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(songs.value.map(s => s.id + '|' + s.source))
  }
}

// ── 元数据编辑 ──────────────────────────────
const editForm = ref({ title: '', artist: '', album: '', lyricist: '', composer: '', lyrics: '' })
const saving = ref(false)

async function saveMetadata() {
  if (!currentSong.value) return
  saving.value = true
  try {
    const song = currentSong.value
    const meta: Record<string, string> = {}
    if (editForm.value.title && editForm.value.title !== song.name) {
      meta.title = editForm.value.title
    }
    if (editForm.value.artist) meta.artist = editForm.value.artist
    if (editForm.value.album) meta.album = editForm.value.album
    if (editForm.value.lyricist) meta.lyricist = editForm.value.lyricist
    if (editForm.value.composer) meta.composer = editForm.value.composer

    if (isTauri) {
      // 桌面版：调用 Rust 后端写入文件
      await invoke('save_metadata', {
        song,
        meta,
        lyrics: editForm.value.lyrics || undefined,
      })
      message.success('元数据已保存（桌面版）')
    } else if (song.file) {
      // Web 版：用 music-metadata-browser 写入本地文件
      message.info('正在写入元数据...')
      try {
        const { writeMetaTags } = require('music-metadata-browser')
        const tags: Record<string, any> = {}
        if (meta.title) tags.title = meta.title
        if (meta.artist) tags.artist = meta.artist
        if (meta.album) tags.album = meta.album
        if (meta.lyricist) tags.lyricist = meta.lyricist
        if (meta.composer) tags.composer = meta.composer
        if (editForm.value.lyrics) {
          tags.unsynchronisedLyrics = [{ language: 'chi', text: editForm.value.lyrics }]
        }
        await writeMetaTags(song.file, tags)
        message.success('元数据已写入文件')
      } catch (e: any) {
        message.error(`写入失败: ${String(e)}`)
      }
    } else {
      // 网络歌曲：只保存在内存
      Object.assign(song, {
        name: editForm.value.title,
        artists: editForm.value.artist.split(',').map((s: string) => s.trim()),
        album: editForm.value.album,
        lyricist: editForm.value.lyricist,
        composer: editForm.value.composer,
      })
      message.success('信息已更新（网络歌曲仅本会话有效）')
    }

    addRecent({
      name: currentSong.value?.name || '未知',
      artists: currentSong.value?.artists || [],
      cover: currentSong.value?.cover_url || '',
      action: '编辑元数据',
    })
  } finally {
    saving.value = false
  }
}

// ── 歌词 ──────────────────────────────────
const showLyricModal = ref(false)
const lyricTab = ref<'original' | 'translated'>('original')
const lyricData = ref<{ lyric: string; translated?: string }>({ lyric: '' })

const lyricDisplay = computed(() => {
  if (lyricTab.value === 'translated') return lyricData.value.translated || '（无翻译歌词）'
  return lyricData.value.lyric || '（无歌词）'
})

async function fetchLyricsForCurrent() {
  if (!currentSong.value) return
  try {
    const result = await getLyrics(
      currentSong.value.id,
      currentSong.value.source,
      currentSong.value.name
    )
    lyricData.value = result
    editForm.value.lyrics = result.lyric || ''
  } catch (e) {
    console.warn('获取歌词失败', e)
  }
}

// 为本地歌曲加载歌词（多源搜索）
async function loadLyricsForCurrent() {
  if (!currentSong.value) return
  const song = currentSong.value
  try {
    message.info('正在从网络加载歌词...')
    const result = await loadLyricsForLocal(song.name, song.artists?.[0])
    if (result.lyric) {
      lyricData.value = result
      editForm.value.lyrics = result.lyric
      message.success(`歌词加载成功（来源：${result.from || '未知'}）`)
    } else {
      message.warning('未找到歌词')
    }
  } catch (e: any) {
    message.error(`加载歌词失败: ${String(e)}`)
  }
}

async function showLyricFor(song: any) {
  currentSong.value = song
  await fetchLyricsForCurrent()
  showLyricModal.value = true
}

async function downloadLyricsForCurrent() {
  if (!currentSong.value) return
  if (!editForm.value.lyrics) {
    await fetchLyricsForCurrent()
  }
  const text = editForm.value.lyrics
  if (!text) {
    message.warning('暂无歌词')
    return
  }
  const filename = `${currentSong.value.name} - ${currentSong.value.artists?.[0] || '未知'}.lrc`
  downloadBlob(text, filename)
  message.success('歌词已下载')
  addRecent({
    name: currentSong.value.name,
    artists: currentSong.value.artists || [],
    cover: '',
    action: '下载歌词',
  })
}

async function saveLyricsToFile() {
  const text = lyricDisplay.value
  if (!text || text.includes('（无')) {
    message.warning('没有可保存的歌词')
    return
  }
  const filename = `${currentSong.value?.name || 'lyrics'}.lrc`
  const filePath = await saveFileDialog({
    title: '保存歌词',
    defaultPath: filename,
    filters: [{ name: 'LRC文件', extensions: ['lrc'] }],
  })
  if (filePath) {
    message.success(`已保存: ${filePath}`)
  } else {
    downloadBlob(text, filename)
    message.success('歌词已下载')
  }
}

// ── 歌曲下载（不自动下载歌词，用户手动点击）──
async function downloadSong(song: any) {
  if (!song) return
  try {
    message.info(`正在下载《${song.name}》...`)
    const result = await platformDownloadSong(song)
    if (result.ok) {
      message.success(`《${song.name}》下载完成`)
    } else {
      message.error('无法获取下载链接，该歌曲可能受版权保护')
    }
    addRecent({
      name: song.name,
      artists: song.artists || [],
      cover: song.cover_url || '',
      action: '下载歌曲',
    })
  } catch (e: any) {
    message.error(`下载失败: ${String(e)}`)
  }
}

// ── 批量下载歌曲 ────────────────────────
async function batchDownloadSongs() {
  const selected = songs.value.filter(s => selectedIds.value.has(s.id + '|' + s.source))
  if (selected.length === 0) return
  message.info(`即将下载 ${selected.length} 首歌曲...`)
  let success = 0
  for (const song of selected) {
    try {
      const result = await platformDownloadSong(song)
      if (result.ok) success++
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 1500))
  }
  message.success(`已完成 ${success}/${selected.length} 首歌曲下载`)
}

// ── 封面下载 ──────────────────────────────
async function downloadCoverFor(song: any) {
  if (!song.cover_url) {
    message.warning('该歌曲暂无封面')
    return
  }
  try {
    const resp = await fetch(song.cover_url)
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = `${song.name} - ${song.artists?.[0] || '未知'}.jpg`
    a.click()
    URL.revokeObjectURL(objUrl)
    message.success('封面已下载')
    addRecent({
      name: song.name,
      artists: song.artists || [],
      cover: song.cover_url,
      action: '下载封面',
    })
  } catch (e: any) {
    message.error(`封面下载失败: ${String(e)}`)
  }
}

// ── 批量操作 ──────────────────────────────
async function batchDownloadLyrics() {
  const selected = songs.value.filter(s => selectedIds.value.has(s.id + '|' + s.source))
  message.info(`正在下载 ${selected.length} 首歌词...`)
  let success = 0
  for (const song of selected) {
    try {
      const result = await getLyrics(song.id, song.source, song.name)
      if (result.lyric) {
        const filename = `${song.name} - ${song.artists?.[0] || '未知'}.lrc`
        downloadBlob(result.lyric, filename)
        success++
        await new Promise(r => setTimeout(r, 600))
      }
    } catch { /* skip */ }
  }
  message.success(`已完成 ${success}/${selected.length} 首歌词下载`)
}

async function batchDownloadCovers() {
  const selected = songs.value.filter(s => selectedIds.value.has(s.id + '|' + s.source) && s.cover_url)
  if (selected.length === 0) {
    message.warning('选中歌曲均无封面')
    return
  }
  message.info(`正在下载 ${selected.length} 张封面...`)
  let success = 0
  for (const song of selected) {
    try {
      const resp = await fetch(song.cover_url)
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `${song.name} - ${song.artists?.[0] || '未知'}.jpg`
      a.click()
      URL.revokeObjectURL(objUrl)
      success++
      await new Promise(r => setTimeout(r, 600))
    } catch { /* skip */ }
  }
  message.success(`已完成 ${success}/${selected.length} 张封面下载`)
}

// ── 格式转换 ──────────────────────────────
const showConvertModal = ref(false)
const convertFiles = ref<{ file: File; name: string; status: string }[]>([])
const convertTargetFormat = ref<'mp3' | 'wav' | 'ogg'>('mp3')
const converting = ref(false)
const convertProgress = ref(0)

function batchConvert() {
  convertFiles.value = []
  convertTargetFormat.value = 'mp3'
  showConvertModal.value = true
}

function addConvertFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'audio/*'
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return
    for (const file of Array.from(files)) {
      convertFiles.value.push({ file, name: file.name, status: '等待中' })
    }
  }
  input.click()
}

function removeConvertFile(index: number) {
  convertFiles.value.splice(index, 1)
}

// 音频 Buffer 转 WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * numChannels * bytesPerSample
  const bufferLength = 44 + dataLength
  const arrayBuffer = new ArrayBuffer(bufferLength)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  const offset = 44
  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i))

  let index = 0
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      view.setInt16(offset + index, intSample, true)
      index += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// 音频 Buffer 转 MP3 Blob（Web 端暂不支持，提示用户用 WAV）
async function audioBufferToMp3(_buffer: AudioBuffer): Promise<Blob> {
  message.warning('Web 版暂不支持 MP3 编码，已自动转为 WAV 格式')
  return audioBufferToWav(_buffer)
}

// 开始转换
async function startConvert() {
  if (convertFiles.value.length === 0) {
    message.warning('请先添加音频文件')
    return
  }
  converting.value = true
  convertProgress.value = 0
  const total = convertFiles.value.length

  for (let i = 0; i < total; i++) {
    const item = convertFiles.value[i]
    item.status = '转换中...'
    try {
      const arrayBuffer = await item.file.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      let blob: Blob
      if (convertTargetFormat.value === 'wav') {
        blob = audioBufferToWav(audioBuffer)
      } else if (convertTargetFormat.value === 'mp3') {
        blob = await audioBufferToMp3(audioBuffer)
      } else {
        // OGG: 使用 MediaRecorder
        blob = await convertToOgg(audioBuffer)
      }

      const ext = convertTargetFormat.value
      const newName = item.name.replace(/\.[^.]+$/, '') + '.' + ext
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = newName
      a.click()
      URL.revokeObjectURL(objUrl)
      item.status = '完成'
    } catch (e: any) {
      console.error('转换失败', e)
      item.status = `失败: ${String(e).substring(0, 30)}`
    }
    convertProgress.value = Math.round(((i + 1) / total) * 100)
  }

  converting.value = false
  message.success('格式转换完成')
}

// 音频 Buffer 转 OGG Blob（使用 MediaRecorder）
async function convertToOgg(buffer: AudioBuffer): Promise<Blob> {
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  )
  const source = offlineContext.createBufferSource()
  source.buffer = buffer
  source.connect(offlineContext.destination)
  source.start()
  const renderedBuffer = await offlineContext.startRendering()

  // 使用 MediaRecorder 录制为 OGG
  const dest = new AudioContext().createMediaStreamDestination()
  const source2 = new AudioContext().createBufferSource()
  source2.buffer = renderedBuffer
  source2.connect(dest)
  source2.start()

  const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      resolve(blob)
    }
    recorder.start()
    setTimeout(() => recorder.stop(), (renderedBuffer.length / renderedBuffer.sampleRate) * 1000 + 200)
  })
}

// ── 扫描本地歌曲（Web 版：文件选择器）───
async function scanLocalSongs() {
  if (isTauri) {
    const result = await selectFolderDialog({ title: '选择音乐文件夹' })
    if (!result) return
    const folderPath = Array.isArray(result) ? result[0] : result
    message.info('正在扫描...')
    const { readDir, readFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
    const { parseBlob } = await import('music-metadata-browser')
    const audioExts = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.wma', '.aac', '.ape']
    const entries = await readDir(folderPath)
    const files = entries.filter((e: any) =>
      e.isFile && audioExts.some(ext => e.name.toLowerCase().endsWith(ext))
    )
    const parsed: any[] = []
    for (const file of files) {
      try {
        const data = await readFile(`${folderPath}/${file.name}`)
        const blob = new Blob([data])
        const metadata = await parseBlob(blob)
        parsed.push({
          id: file.name + Date.now(),
          name: metadata.common?.title || file.name.replace(/\.[^.]+$/, ''),
          artists: metadata.common?.artist ? [metadata.common.artist] : ['本地文件'],
          album: metadata.common?.album || '本地音乐',
          duration: Math.round((metadata.format?.duration || 0)),
          source: 'local',
          cover_url: '',
          file: blob,
          lyricist: metadata.common?.lyricist || '',
          composer: metadata.common?.composer || '',
        })
      } catch { /* ignore unreadable files */ }
    }
    songs.value = parsed
    if (parsed.length > 0) selectSong(parsed[0])
    statusText.value = `已扫描 ${parsed.length} 首本地歌曲`
    message.success(`已扫描 ${parsed.length} 首本地歌曲`)
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'audio/*'
  input.onchange = async (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return
    const parsed: any[] = []
    for (const file of Array.from(files)) {
      let metadata: any = {}
      try {
        const { parseBlob } = await import('music-metadata-browser')
        metadata = await parseBlob(file)
      } catch { /* ignore */ }

      parsed.push({
        id: file.name + Date.now(),
        name: metadata.common?.title || file.name.replace(/\.[^.]+$/, ''),
        artists: metadata.common?.artist ? [metadata.common.artist] : ['本地文件'],
        album: metadata.common?.album || '本地音乐',
        duration: Math.round((metadata.format?.duration || 0)),
        source: 'local',
        cover_url: '',
        file: file,
        lyricist: metadata.common?.lyricist || '',
        composer: metadata.common?.composer || '',
      })
    }
    songs.value = parsed
    if (parsed.length > 0) selectSong(parsed[0])
    statusText.value = `已扫描 ${parsed.length} 首本地歌曲`
    message.success(`已扫描 ${parsed.length} 首本地歌曲`)
  }
  input.click()
}

// ── 设置 ──────────────────────────────────
const showSettings = ref(false)
const downloadDir = ref(localStorage.getItem('download-dir') || '')
const defaultLyricSource = ref(localStorage.getItem('lyric-source') || 'netease')
const downloadTranslated = ref(localStorage.getItem('download-translated') === 'true')

async function selectDownloadDir() {
  const result = await selectFolderDialog({ title: '选择下载目录' })
  if (result) {
    downloadDir.value = Array.isArray(result) ? result[0] : result
  }
}

function saveSettings() {
  localStorage.setItem('download-dir', downloadDir.value)
  localStorage.setItem('lyric-source', defaultLyricSource.value)
  localStorage.setItem('download-translated', String(downloadTranslated.value))
  message.success('设置已保存')
  showSettings.value = false
}

// ── 状态栏 ────────────────────────────────
const statusText = ref('就绪')
</script>

<style lang="scss" scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F7F9FC;
}

// ── 顶部工具栏 ────────────────────────────
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #E1E8ED;
  gap: 12px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  &:hover { opacity: 0.8; }

  .logo-icon {
    width: 24px;
    height: 24px;
    color: #4ECDC4;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 700;
    background: linear-gradient(135deg, #4ECDC4, #2EAA9E);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.toolbar-center {
  flex: 1;
  max-width: 520px;
  min-width: 200px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;

  :deep(.n-input) {
    flex: 1;
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  .btn-text {
    @media (max-width: 1100px) {
      display: none;
    }
  }
}

// ── 主内容区 ──────────────────────────────
.workspace-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

// ── 左侧面板：歌曲列表 ────────────────────
.song-list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border-right: 1px solid #E1E8ED;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #F0F3F6;
  flex-shrink: 0;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #1A1A2E;
  }

  .panel-count {
    font-size: 12px;
    color: #6B7280;
  }

  .select-all {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    user-select: none;

    input { cursor: pointer; }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-table-wrapper {
  flex: 1;
  overflow: auto;
}

.song-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    position: sticky;
    top: 0;
    background: #FAFBFC;
    text-align: left;
    padding: 8px 10px;
    font-weight: 600;
    color: #6B7280;
    font-size: 12px;
    border-bottom: 1px solid #E1E8ED;
    white-space: nowrap;
  }

  td {
    padding: 8px 10px;
    border-bottom: 1px solid #F0F3F6;
    color: #1A1A2E;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.1s;

    &:hover { background: #F7F9FC; }

    &.active {
      background: rgba(78, 205, 196, 0.08);
    }

    &.selected {
      background: rgba(78, 205, 196, 0.06);
    }
  }

  .col-check {
    width: 36px;
    text-align: center;

    input { cursor: pointer; }
  }

  .col-title { min-width: 160px; }
  .col-artist { min-width: 100px; }
  .col-album { min-width: 120px; }
  .col-source { width: 60px; }
  .col-actions {
    width: 100px;
    text-align: right;
  }
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-cover {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.mini-cover-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4ECDC4, #2EAA9E);
  color: white;
  font-size: 12px;
  flex-shrink: 0;
}

.song-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

// ── 右侧面板：歌曲信息 ────────────────────
.info-panel {
  width: 360px;
  min-width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  overflow-y: auto;
}

.info-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cover-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.cover-frame {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, #EEF2F7, #F7F9FC);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  color: #9CA3AF;
}

.cover-actions {
  display: flex;
  gap: 8px;
}

.meta-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
  }
}

.lyrics-textarea {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.form-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

// ── 底部状态栏 ────────────────────────────
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 16px;
  background: #FAFBFC;
  border-top: 1px solid #E1E8ED;
  font-size: 12px;
  color: #6B7280;
  flex-shrink: 0;
}

.status-extra {
  color: #4ECDC4;
  font-weight: 500;
}

// ── 歌词弹窗 ──────────────────────────────
.lyric-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lyric-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #E1E8ED;
  padding-bottom: 4px;
}

.lyric-tab {
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  color: #6B7280;
  transition: all 0.15s;

  &:hover { background: #F7F9FC; }

  &.active {
    background: rgba(78, 205, 196, 0.12);
    color: #2EAA9E;
    font-weight: 600;
  }
}

.lyric-display {
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.8;
  color: #1A1A2E;
  padding: 8px;
  background: #F7F9FC;
  border-radius: 8px;
  margin: 0;
}

.lyric-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}

// ── 设置弹窗 ──────────────────────────────
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }
}

.settings-input-row {
  display: flex;
  gap: 8px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

// ── 格式转换弹窗 ──────────────────────────
.convert-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.convert-row {
  display: flex;
  align-items: center;
  gap: 12px;

  label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    min-width: 60px;
  }
}

.convert-hint {
  font-size: 12px;
  color: #9CA3AF;
}

.convert-file-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 8px;
}

.convert-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid #F3F4F6;

  &:last-child {
    border-bottom: none;
  }

  .file-name {
    flex: 1;
    font-size: 12px;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-status {
    font-size: 11px;
    color: #6B7280;
    min-width: 60px;
    text-align: right;

    &.status-done {
      color: #10B981;
    }

    &.status-error {
      color: #EF4444;
    }
  }
}

.convert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
