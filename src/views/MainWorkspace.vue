<template>
  <div class="app">
    <!-- 顶部栏 -->
    <header class="header">
      <div class="header-left">
        <svg class="logo-icon" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/>
          <path d="M10 20V12L16 16L22 12V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="16" cy="23" r="1.5" fill="currentColor"/>
        </svg>
        <span class="logo-text">MusicTool</span>
      </div>

      <div class="header-center">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索歌曲、歌手..."
          clearable round size="small"
          @keyup.enter="doSearch"
        >
          <template #prefix><n-icon :component="SearchOutline"/></template>
        </n-input>
        <n-button size="small" type="primary" @click="doSearch">搜索</n-button>
      </div>

      <div class="header-right">
        <n-button size="small" secondary @click="scanLocalSongs">
          <template #icon><n-icon :component="FolderOpenOutline"/></template>
          扫描本地
        </n-button>
        <n-button size="small" quaternary @click="showSettings = true">
          <template #icon><n-icon :component="SettingsOutline"/></template>
        </n-button>
      </div>
    </header>

    <!-- 主体：左右分栏，所有功能同屏 -->
    <main class="main">
      <!-- 左栏：歌曲库 -->
      <aside class="left-panel">
        <div class="panel-header">
          <span class="panel-title">歌曲库</span>
          <div class="panel-actions">
            <label v-if="songs.length > 0" class="select-all-label">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"/>
              <span>全选</span>
            </label>
            <span class="count">{{ songs.length }} 首</span>
          </div>
        </div>

        <div v-if="songs.length === 0" class="empty">
          <n-empty description="暂无歌曲">
            <template #extra>
              <n-button size="small" type="primary" @click="scanLocalSongs">扫描本地</n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="song-rows">
          <div
            v-for="song in songs"
            :key="song.id + '|' + song.source"
            :class="['song-row', { active: currentSong?.id === song.id }]"
            @click="selectSong(song)"
          >
            <input type="checkbox" :checked="selectedIds.has(song.id + '|' + song.source)" @click.stop @change="toggleSelect(song)"/>
            <img v-if="song.cover_url" :src="song.cover_url" class="thumb"/>
            <div v-else class="thumb-placeholder">♪</div>
            <div class="song-text">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ song.artists?.join(', ') || '-' }}</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右栏：功能面板 -->
      <section class="right-panel">
        <!-- 功能按钮区 -->
        <div class="function-bar">
          <n-button
            :type="activePanel === 'convert' ? 'primary' : 'default'"
            size="small" secondary
            @click="activePanel = activePanel === 'convert' ? '' : 'convert'"
          >
            <template #icon><n-icon :component="SyncOutline"/></template>
            格式转换
          </n-button>
          <n-button
            :type="activePanel === 'lyrics' ? 'primary' : 'default'"
            size="small" secondary
            @click="activePanel = activePanel === 'lyrics' ? '' : 'lyrics'"
          >
            <template #icon><n-icon :component="DocumentTextOutline"/></template>
            歌词管理
          </n-button>
          <n-button
            :type="activePanel === 'metadata' ? 'primary' : 'default'"
            size="small" secondary
            @click="activePanel = activePanel === 'metadata' ? '' : 'metadata'"
          >
            <template #icon><n-icon :component="PencilOutline"/></template>
            元数据编辑
          </n-button>
          <div class="spacer"/>
          <span class="selected-count" v-if="selectedIds.size > 0">已选 {{ selectedIds.size }} 首</span>
        </div>

        <!-- 合并面板：转换 + 歌词 -->
        <div v-show="activePanel === 'convert' || activePanel === 'lyrics'" class="func-panel">
            <!-- 格式转换区块 -->
            <div class="panel-header">
              <span class="panel-title">🔄 格式转换</span>
              <span class="panel-subtitle">使用左侧歌曲库中已选中的歌曲</span>
            </div>
            <div class="panel-body">
              <div v-if="selectedSongs.length === 0" class="convert-empty">
                <n-empty description="请在左侧选择要转换的歌曲"/>
              </div>
              <div v-else class="convert-config">
                <div class="format-picker">
                  <span>目标格式：</span>
                  <n-radio-group v-model:value="convertTargetFormat" size="small">
                    <n-radio-button value="mp3">MP3</n-radio-button>
                    <n-radio-button value="wav">WAV</n-radio-button>
                    <n-radio-button value="ogg">OGG</n-radio-button>
                  </n-radio-group>
                </div>
                <div class="convert-actions-top">
                  <n-button size="small" :disabled="convertingAny" @click="startConvertAll">全部转换</n-button>
                  <span v-if="convertProgressText" class="convert-progress-text">{{ convertProgressText }}</span>
                </div>
                <div class="file-rows">
                  <div v-for="song in selectedSongs" :key="song.id" class="file-row">
                    <span class="fname">{{ song.name }}</span>
                    <div class="f-progress">
                      <template v-if="convertStates[song.id]?.status === 'converting'">
                        <n-progress type="line" :percentage="convertStates[song.id]?.progress || 0"
                                      :height="4" style="width:80px;" :show-indicator="false"/>
                        <span class="progress-val">{{ convertStates[song.id]?.progress || 0 }}%</span>
                      </template>
                      <span v-else :class="['fstatus',
                        convertStates[song.id]?.status === 'done' ? 'done' :
                        convertStates[song.id]?.status === 'error' ? 'fail' : '']">
                        {{ convertStates[song.id]?.status === 'done' ? '完成' :
                           convertStates[song.id]?.status === 'error' ? '失败' : '等待中' }}
                      </span>
                    </div>
                    <div class="f-actions">
                      <n-button v-if="convertStates[song.id]?.status !== 'converting'"
                                size="tiny" quaternary :disabled="convertingAny"
                                @click="startConvertOne(song)">转换</n-button>
                    </div>
                  </div>
                </div>
                <div v-if="hasConvertErrors" class="convert-errors">
                  <div v-for="song in selectedSongs.filter(s => convertStates[s.id]?.status === 'error')"
                       :key="'err-'+song.id" class="error-item">
                    ❌ {{ song.name }}：{{ convertStates[song.id]?.error }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 分隔线 + 歌词管理区块 -->
            <n-divider style="margin:0"/>

            <div class="panel-header">
              <span class="panel-title">📝 歌词管理</span>
              <div class="panel-header-actions">
                <n-button size="tiny" secondary @click="batchDownloadLyrics" :disabled="selectedIds.size === 0">批量下载</n-button>
              </div>
            </div>
            <div class="panel-body">
              <div v-if="currentSong && lyricData.lyric" class="lyric-preview">
                <n-tabs v-model:value="lyricTab">
                  <n-tab-pane name="original" tab="原文">
                    <pre class="lyric-text">{{ lyricData.lyric }}</pre>
                  </n-tab-pane>
                  <n-tab-pane name="translated" tab="翻译">
                    <pre class="lyric-text">{{ lyricData.translated || '（无翻译）' }}</pre>
                  </n-tab-pane>
                </n-tabs>
                <div class="lyric-actions">
                  <n-button size="small" type="primary" @click="downloadLyricsForCurrent">下载歌词</n-button>
                  <n-button size="small" secondary @click="loadLyricsForCurrent">重新加载</n-button>
                </div>
              </div>
              <div v-else-if="currentSong" class="lyric-empty">
                <n-empty description="暂无歌词">
                  <template #extra>
                    <n-button size="small" @click="loadLyricsForCurrent">加载网络歌词</n-button>
                  </template>
                </n-empty>
              </div>
              <div v-if="selectedIds.size > 0" class="lyrics-batch-list">
                <div class="sub-title">已选歌曲（{{ selectedIds.size }} 首）</div>
                <div v-for="song in songs.filter(s => selectedIds.has(s.id + '|' + s.source))" :key="song.id" class="batch-item">
                  <span>{{ song.name }}</span>
                  <n-button size="tiny" quaternary @click="showLyricFor(song)">预览</n-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 元数据编辑面板 -->
          <div v-show="activePanel === 'metadata'" class="func-panel">
            <div class="panel-header">
              <span class="panel-title">✏️ 元数据编辑</span>
              <div class="panel-header-actions">
                <n-button size="tiny" secondary :loading="fetchingMetadata" @click="fetchMetadataFromNetwork">
                  自动填写
                </n-button>
                <n-button size="tiny" secondary :loading="batchMetaLoading" @click="batchFetchMetadata">
                  批量自动填写
                </n-button>
              </div>
            </div>
            <div class="panel-body">
              <div v-if="currentSong" class="metadata-form-area">
                <div class="meta-cover">
                  <img v-if="currentSong.cover_url" :src="currentSong.cover_url" class="cover-img-sm"/>
                  <div v-else class="cover-placeholder-sm">♪</div>
                </div>
                <n-form label-placement="left" label-width="72">
                  <n-form-item label="标题"><n-input v-model:value="editForm.title"/></n-form-item>
                  <n-form-item label="歌手"><n-input v-model:value="editForm.artist" placeholder="多个用逗号分隔"/></n-form-item>
                  <n-form-item label="专辑"><n-input v-model:value="editForm.album"/></n-form-item>
                  <n-form-item label="歌词作者"><n-input v-model:value="editForm.lyricist"/></n-form-item>
                  <n-form-item label="作曲"><n-input v-model:value="editForm.composer"/></n-form-item>
                  <n-form-item label="歌词">
                    <n-input v-model:value="editForm.lyrics" type="textarea" :autosize="{ minRows: 5, maxRows: 10 }"/>
                  </n-form-item>
                </n-form>
                <div class="meta-btns">
                  <n-button type="primary" :loading="saving" @click="saveMetadata">保存</n-button>
                  <n-button size="small" secondary @click="loadLyricsForCurrent">加载歌词</n-button>
                </div>
              </div>
              <div v-else class="meta-empty">
                <n-empty description="请在左侧选择一首歌曲"/>
              </div>
            </div>
          </div>
      </section>
    </main>

    <!-- 设置弹窗 -->
    <n-modal v-model:show="showSettings" preset="card" title="设置" style="width: 420px">
      <div class="settings-content">
        <div class="settings-row">
          <label>默认歌词来源</label>
          <n-radio-group v-model:value="defaultLyricSource" size="small">
            <n-radio-button value="netease">网易云</n-radio-button>
            <n-radio-button value="qq">QQ音乐</n-radio-button>
          </n-radio-group>
        </div>
      </div>
      <template #footer>
        <n-button type="primary" @click="saveSettings">保存</n-button>
        <n-button @click="showSettings = false">取消</n-button>
      </template>
    </n-modal>

    <!-- 歌词预览弹窗 -->
    <n-modal v-model:show="showLyricModal" preset="card" title="歌词预览" style="width: 540px">
      <n-tabs v-model:value="lyricTab">
        <n-tab-pane name="original" tab="原文"><pre class="lyric-text-modal">{{ lyricData.lyric || '（无歌词）' }}</pre></n-tab-pane>
        <n-tab-pane name="translated" tab="翻译">{{ lyricData.translated || '（无翻译）' }}</n-tab-pane>
      </n-tabs>
      <template #footer>
        <n-button type="primary" @click="downloadLyricsForCurrent">下载歌词</n-button>
        <n-button @click="showLyricModal = false">关闭</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
import {
  NInput, NButton, NIcon, NEmpty, NTag, NModal,
  NForm, NFormItem, NRadioGroup, NRadioButton,
  NTabs, NTabPane, useMessage, NSelect, NProgress,
} from 'naive-ui'
import {
  SearchOutline, FolderOpenOutline, SettingsOutline,
  SyncOutline, DocumentTextOutline, DiscOutline, PencilOutline,
} from '@vicons/ionicons5'
import { invoke } from '@tauri-apps/api/core'
import {
  searchMusic, getLyrics, saveFileDialog,
  selectFolderDialog, openFileDialog, isTauri, loadLyricsForLocal,
} from '@/services/platform'
import { addRecent } from '@/services/recent'

const message = useMessage()

// ── 搜索 ────────────────────────
const searchQuery = ref('')
const doSearch = () => { message.info('请在搜索页面使用搜索功能') }

// ── 当前激活的功能面板 ────────────
const activePanel = ref<'convert' | 'lyrics' | 'metadata' | ''>('')

// ── 歌曲数据 ─────────────────────
const songs = ref<any[]>([])
const currentSong = ref<any>(null)
const selectedIds = ref<Set<string>>(new Set())

const isAllSelected = computed(() =>
  songs.value.length > 0 && songs.value.every(s => selectedIds.value.has(s.id + '|' + s.source))
)

function toggleSelect(song: any) {
  const key = song.id + '|' + song.source
  selectedIds.value.has(key) ? selectedIds.value.delete(key) : selectedIds.value.add(key)
  selectedIds.value = new Set(selectedIds.value)
}
function toggleSelectAll() {
  selectedIds.value = isAllSelected.value
    ? new Set() : new Set(songs.value.map(s => s.id + '|' + s.source))
}
function selectSong(song: any) {
  currentSong.value = song
  fetchLyricsForCurrent()
}

// ── 扫描本地歌曲 ─────────────────
async function scanLocalSongs() {
  const logLines: string[] = []
  function log(...args: any[]) {
    const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    logLines.push(`[${new Date().toLocaleTimeString()}] ${line}`)
    console.log(...args)
  }
  function logError(...args: any[]) {
    const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    logLines.push(`[${new Date().toLocaleTimeString()}] [ERROR] ${line}`)
    console.error(...args)
  }

  async function saveLog() {
    const logContent = logLines.join('\n')
    try {
      const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      await writeFile('music-tool-scan-log.txt', new TextEncoder().encode(logContent), { baseDir: BaseDirectory.Desktop })
      message.success('日志已保存到桌面')
      log('[scan] 日志已保存')
    } catch (e: any) {
      console.error('保存日志失败:', e)
      const summary = logLines.length > 25 ? logLines.slice(-25).join('\n') : logContent
      message.error('无法写入日志文件。\n\n===== 扫描日志（最后25行）=====\n' + summary)
    }
  }

  log('[scan] 开始扫描, isTauri=', isTauri)

  if (!isTauri) {
    logError('[scan] 不在 Tauri 环境中')
    message.error('本地扫描需要桌面版')
    return
  }

  try {
    // 1. 选择音频文件（支持多选）
    log('[scan] 打开文件选择对话框')
    const result = await openFileDialog({
      title: '选择音频文件',
      multiple: true,
      filters: [{
        name: '音频文件',
        extensions: ['mp3','flac','wav','m4a','ogg','wma','aac','ape','opus','m4p',
                     'amr','aiff','alac','mp4','m4b','wv','tta','dff','dsf','mid','midi','ac3','webm']
      }]
    })
    if (!result || (Array.isArray(result) && result.length === 0)) {
      log('[scan] 用户取消了文件选择')
      return
    }
    const allFiles: string[] = Array.isArray(result) ? result : [result]
    log('[scan] 选择的文件:', allFiles)

    if (allFiles.length === 0) {
      log('[scan] 未选择文件')
      return
    }

    message.info(`已选择 ${allFiles.length} 个文件，正在解析...`)

    // 从文件名解析歌名和歌手（后备）
    function parseNameFromFileName(name: string): { name: string; artist: string } {
      const base = name.replace(/\.[^.]+$/, '')
      const parts = base.split(/\s+/)
      if (parts.length >= 2) {
        return { name: parts[0], artist: parts.slice(1).join(' ') }
      }
      return { name: base, artist: '本地文件' }
    }
    // 判断标签是否被人为篡改/损坏
    function isBadMetadata(meta: any): boolean {
      const title = (meta.title || '') as string
      const artist = (meta.artist || '') as string
      // 包含大量问号或替换字符
      if ((title.match(/\?/g) || []).length >= 2) return true
      if ((artist.match(/\?/g) || []).length >= 2) return true
      if (title.includes('\uFFFD')) return true
      if (artist.includes('\uFFFD')) return true
      // 包含明显异常的标记文本（平台篡改标签常见内容）
      const badKeywords = ['账号已注销', 'fuklotyo', '茶北', 'ciper']
      const combined = (title + ' ' + artist).toLowerCase()
      for (const kw of badKeywords) {
        if (combined.includes(kw.toLowerCase())) return true
      }
      return false
    }

    // 2. 解析音频文件
    const { readFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
    const parsed: any[] = []

    for (const f of allFiles) {
      try {
        log('[scan] 读取文件:', f)
        const data = await readFile(f)
        const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data as any)
        log('[scan] 文件大小:', uint8Data.length)

        const blob = new Blob([uint8Data])
        const fileName = f.replace(/\\/g, '/').split('/').pop() || f
        const fileExt = fileName.split('.').pop()?.toLowerCase() || 'bin'

        // 用 Rust 后端读取元数据（支持 GBK 编码）
        let meta: any = {}
        try {
          meta = await invoke('read_metadata', { filePath: f })
          log('[scan] 元数据:', JSON.stringify(meta))
        } catch (metaErr: any) {
          logError('[scan] 读取元数据失败:', f, metaErr.message || metaErr)
          meta = {}
        }

        // 如果标签被篡改/异常，回退到文件名解析
        const fromFile = parseNameFromFileName(fileName)
        const useFileName = isBadMetadata(meta)
        if (useFileName) {
          log('[scan] 标签异常，使用文件名解析:', fileName, '=>', fromFile.name, fromFile.artist)
        }

        parsed.push({
          id: fileName + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          name: useFileName ? fromFile.name : (meta.title || fromFile.name),
          artists: useFileName ? [fromFile.artist] : (meta.artist ? [meta.artist] : [fromFile.artist]),
          album: meta.album || '本地音乐',
          duration: Math.round(meta.duration || 0),
          source: 'local',
          cover_url: '',
          file: blob,
          fileExt,
          filePath: f,
          lyricist: meta.lyricist || '',
          composer: meta.composer || '',
        })

        log('[scan] 解析成功:', fileName)
      } catch (err: any) {
        logError('[scan] 解析失败:', f, err.message || err)
      }
    }

    log('[scan] 解析完成: 成功', parsed.length, '个')
    await saveLog()

    if (parsed.length === 0) {
      message.warning('未发现可识别的音频文件')
      return
    }

    const oldCount = songs.value.length
    songs.value = [...songs.value, ...parsed]

    if (oldCount === 0 && parsed.length > 0) {
      selectSong(parsed[0])
    }

    message.success(`已添加 ${parsed.length} 首，共 ${songs.value.length} 首`)

  } catch (err: any) {
    logError('[scan] 扫描失败:', err)
    await saveLog()
    message.error('扫描失败：' + String(err.message || err))
  }
}

// ── 歌词 ─────────────────────────
const showLyricModal = ref(false)
const lyricTab = ref<'original'|'translated'>('original')
const lyricData = ref<{lyric:string, translated?:string}>({ lyric: '' })
const editForm = ref({ title:'', artist:'', album:'', lyricist:'', composer:'', lyrics:'' })
const showLyricPanel = ref(false)

async function fetchLyricsForCurrent() {
  if (!currentSong.value) return
  lyricData.value = { lyric: '' }
  editForm.value.lyrics = ''
  try {
    let r: { lyric: string; translated?: string; from?: string }
    if (currentSong.value.source === 'local') {
      // 本地歌曲：按歌名搜索歌词（不传无效 ID）
      console.log('[lyrics] 本地歌曲，按歌名搜索:', currentSong.value.name)
      r = await loadLyricsForLocal(currentSong.value.name, currentSong.value.artists?.[0])
    } else {
      r = await getLyrics(currentSong.value.id, currentSong.value.source, currentSong.value.name)
    }
    lyricData.value = r
    editForm.value.lyrics = r.lyric || ''
    console.log('[lyrics] 加载结果:', r.from, r.lyric ? `${r.lyric.length}字符` : '空')
    if (showLyricPanel.value) showLyricPanel.value = true
  } catch (e: any) {
    console.warn('[lyrics] 加载失败:', e)
    lyricData.value = { lyric: '' }
    editForm.value.lyrics = ''
  }
}

async function showLyricFor(song: any) {
  selectSong(song)
  showLyricModal.value = true
}

async function loadLyricsForCurrent() {
  if (!currentSong.value) return
  message.info('正在从网络加载歌词...')
  try {
    const r = await loadLyricsForLocal(currentSong.value.name, currentSong.value.artists?.[0])
    if (r.lyric) { lyricData.value = r; editForm.value.lyrics = r.lyric; message.success(`歌词加载成功（${r.from||'未知'}）`) }
    else message.warning('未找到歌词')
  } catch (e: any) { message.error(`失败：${e}`) }
}

// 清理文件名：只保留中文、英文、数字，其余删掉（含空格）
function cleanFileName(name: string): string {
  return name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
}

// 保存歌词到原文件所在文件夹
async function saveLyricsToFile(song: any, lyricContent: string) {
  const rawName = song.name || '未知歌曲'
  const cleanName = cleanFileName(rawName)
  const fileName = cleanName + '.lrc'
  if (song.filePath && isTauri) {
    try {
      await invoke('save_lyrics_file', { filePath: song.filePath, content: lyricContent, fileName })
    } catch (e: any) {
      console.warn('[lyrics] 保存到原文件夹失败，改用浏览器下载:', e)
      downloadBlob(lyricContent, fileName)
    }
  } else {
    downloadBlob(lyricContent, fileName)
  }
}

function downloadBlob(content: string, filename: string) {
  const b = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const u = URL.createObjectURL(b)
  const a = document.createElement('a'); a.href = u; a.download = filename; a.click()
  URL.revokeObjectURL(u)
}

async function downloadLyricsForCurrent() {
  if (!currentSong.value) return
  if (!editForm.value.lyrics) await fetchLyricsForCurrent()
  const t = editForm.value.lyrics
  if (!t) { message.warning('暂无歌词'); return }
  await saveLyricsToFile(currentSong.value, t)
  message.success('歌词已保存至原文件夹')
}

// ── 批量下载歌词（显示进度，保存到原文件夹）─────────────────
const batchLyricProgress = ref('')
async function batchDownloadLyrics() {
  const sel = songs.value.filter(s => selectedIds.value.has(s.id+'|'+s.source))
  if (!sel.length) return
  message.info(`正在下载 ${sel.length} 首歌词...`)
  let ok = 0
  let fail = 0
  const failedNames: string[] = []
  for (let i = 0; i < sel.length; i++) {
    const s = sel[i]
    batchLyricProgress.value = `${i+1}/${sel.length}`
    try {
      let r: { lyric: string; translated?: string; from?: string }
      if (s.source === 'local') {
        r = await loadLyricsForLocal(s.name, s.artists?.[0])
      } else {
        r = await getLyrics(s.id, s.source, s.name)
      }
      if (r.lyric) {
        await saveLyricsToFile(s, r.lyric)
        ok++
      } else {
        fail++
        failedNames.push(s.name)
        console.warn(`[batchLyrics] 未找到歌词: ${s.name}`)
      }
    } catch (e) {
      fail++
      failedNames.push(s.name)
      console.warn(`[batchLyrics] 下载失败: ${s.name}`, e)
    }
    await new Promise(r => setTimeout(r, 300))
  }
  batchLyricProgress.value = ''
  if (fail > 0) {
    const showNames = failedNames.slice(0, 5).join('、')
    const more = failedNames.length > 5 ? ` 等 ${failedNames.length} 首` : ''
    message.warning(`${ok}/${sel.length} 首完成，失败：${showNames}${more}`)
  } else {
    message.success(`已完成 ${ok}/${sel.length} 首`)
  }
}

// ── 封面下载 ─────────────────────
async function downloadCoverFor(song: any) {
  if (!song.cover_url) { message.warning('暂无封面'); return }
  try {
    const b = await (await fetch(song.cover_url)).blob()
    const u = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href = u; a.download = `${song.name} - ${song.artists?.[0]||'未知'}.jpg`; a.click()
    URL.revokeObjectURL(u)
    message.success('封面已下载')
  } catch (e: any) { message.error(`失败：${e}`) }
}

// ── 格式转换（Rust + ffmpeg.exe）───────
const convertTargetFormat = ref<'mp3' | 'wav' | 'ogg'>('mp3')
const convertStates = ref<Record<string, {
  status: 'waiting' | 'converting' | 'done' | 'error'
  progress: number
  error?: string
}>>({})

const selectedSongs = computed(() =>
  songs.value.filter(s => selectedIds.value.has(s.id + '|' + s.source)))
const convertingAny = computed(() =>
  Object.values(convertStates.value).some(s => s.status === 'converting'))
const hasConvertErrors = computed(() =>
  Object.values(convertStates.value).some(s => s.status === 'error'))
const convertProgressText = computed(() => {
  const total = selectedSongs.value.length
  if (total === 0) return ''
  const done = Object.values(convertStates.value).filter(s => s.status === 'done').length
  const converting = Object.values(convertStates.value).filter(s => s.status === 'converting').length
  if (converting > 0) return `转换中 ${done}/${total}`
  return done === total ? `全部完成 ${done}/${total}` : `就绪 ${done}/${total}`
})

async function convertOneSong(song: any, outputExt: string): Promise<void> {
  const sid = song.id
  convertStates.value[sid] = { status: 'converting', progress: 0 }

  try {
    if (!isTauri) {
      throw new Error('格式转换需要桌面版，请下载安装 Music Tool 桌面应用')
    }

    const rawSong = toRaw(song)
    const inputPath: string | undefined = rawSong.filePath
    if (!inputPath) throw new Error('文件路径丢失，请重新扫描本地歌曲')

    console.log(`[convert:${sid}] 开始，输入=${inputPath}，目标格式=${outputExt}`)

    // 1. 调用 Rust 命令（传文件路径，Rust 直接读文件）
    convertStates.value[sid].progress = 30
    const raw = await invoke('convert_audio', {
      inputPath,
      outputExt,
    })
    const outputBytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as number[])

    if (!outputBytes || outputBytes.length === 0) throw new Error('转换返回为空')
    console.log(`[convert:${sid}] 转换完成，输出大小=${outputBytes.length}`)

    // 2. 将输出二进制转为 Blob 并触发下载
    convertStates.value[sid].progress = 80
    const blob = new Blob([outputBytes as unknown as BlobPart], { type: `audio/${outputExt}` })

    const newName = `${song.name}.${outputExt}`
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u; a.download = newName; a.click()
    URL.revokeObjectURL(u)

    convertStates.value[sid] = { status: 'done', progress: 100 }
    message.success(`${song.name} 转换完成`)

  } catch (e: any) {
    const errMsg = e?.message || String(e)
    convertStates.value[sid] = { status: 'error', progress: 0, error: errMsg.slice(0, 120) }
    console.error(`[convert:${sid}] 失败:`, e)
    message.error(`${song.name} 转换失败：${errMsg.slice(0, 80)}`)
  }
}

async function startConvertOne(song: any) {
  await convertOneSong(song, convertTargetFormat.value)
}

async function startConvertAll() {
  if (selectedSongs.value.length === 0) { message.warning('请先选择歌曲'); return }
  for (const song of selectedSongs.value) {
    if (convertStates.value[song.id]?.status === 'converting') continue
    await convertOneSong(song, convertTargetFormat.value)
  }
}

// ── 元数据编辑 ───────────────────
const saving = ref(false)
const fetchingMetadata = ref(false)
const batchMetaLoading = ref(false)
const showMetaPanel = ref(false)

function openMetadataEditor() {
  if (!currentSong.value) return
  editForm.value = {
    title: currentSong.value.name || '',
    artist: (currentSong.value.artists||[]).join(', '),
    album: currentSong.value.album || '',
    lyricist: currentSong.value.lyricist || '',
    composer: currentSong.value.composer || '',
    lyrics: editForm.value.lyrics || '',
  }
  showMetaPanel.value = true
  activePanel.value = 'metadata'
}

async function fetchMetadataFromNetwork() {
  if (!currentSong.value) return
  fetchingMetadata.value = true
  try {
    const keyword = currentSong.value.name || ''
    if (!keyword) throw new Error('歌曲名称为空')

    message.info('正在从网络搜索元数据...')
    const results = await searchMusic(keyword, 'all')
    if (!results || results.length === 0) {
      message.warning('未找到匹配的元数据')
      return
    }

    // 取第一个结果
    const r = results[0]
    console.log('[metadata] 自动填写，来源:', r.source, r.name)

    // 填写表单
    editForm.value.title = r.name || currentSong.value.name || ''
    editForm.value.artist = (r.artists || []).join(', ')
    editForm.value.album = r.album || ''

    // 更新封面 URL
    if (r.cover_url) {
      currentSong.value.cover_url = r.cover_url
    }

    // 尝试获取歌词并填写
    try {
      const lyricsResult = await getLyrics(r.id, r.source, r.name)
      if (lyricsResult?.lyric) {
        editForm.value.lyrics = lyricsResult.lyric
        message.success(`元数据已填写（${r.source}），歌词已加载`)
      } else {
        message.success(`元数据已填写（${r.source}）`)
      }
    } catch (lyricErr) {
      message.success(`元数据已填写（${r.source}）`)
    }
  } catch (e: any) {
    message.error(`自动填写失败：${e?.message || e}`)
    console.error('[metadata] 自动填写失败:', e)
  } finally {
    fetchingMetadata.value = false
  }
}

async function saveMetadata() {
  if (!currentSong.value) return
  saving.value = true
  try {
    if (currentSong.value.source === 'local' && isTauri) {
      const filePath = currentSong.value.filePath
      if (!filePath) throw new Error('文件路径丢失，请重新扫描本地歌曲')
      const metadata: any = {}
      if (editForm.value.title) metadata.title = editForm.value.title
      if (editForm.value.artist) metadata.artist = editForm.value.artist
      if (editForm.value.album) metadata.album = editForm.value.album
      metadata.year = null
      metadata.genre = null
      metadata.track_number = null
      metadata.disc_number = null
      await invoke('write_metadata', { filePath, metadata })
      message.success('元数据已写入文件')
    } else {
      Object.assign(currentSong.value, {
        name: editForm.value.title,
        artists: editForm.value.artist.split(',').map((s:string)=>s.trim()),
        album: editForm.value.album,
        lyricist: editForm.value.lyricist,
        composer: editForm.value.composer,
      })
      message.success('信息已更新')
    }
  } catch (e: any) { message.error(`保存失败：${e}`) }
  finally { saving.value = false }
}

// ── 批量自动填写元数据并自动保存 ─────────
async function batchFetchMetadata() {
  const sel = songs.value.filter(s => selectedIds.value.has(s.id+'|'+s.source))
  if (!sel.length) { message.warning('请先选择歌曲'); return }
  batchMetaLoading.value = true
  let ok = 0
  let fail = 0
  const failedNames: string[] = []
  try {
    for (let i = 0; i < sel.length; i++) {
      const s = sel[i]
      try {
        // 优先用 s.name 搜索；如果 s.name 异常（???等），回退到文件名
        let searchKey = s.name || ''
        const badPattern = /\?{2,}|账号已注销|fuklotyo/i
        if (!searchKey || badPattern.test(searchKey)) {
          // 从 filePath 提取文件名作为搜索关键词
          if (s.filePath) {
            const fn = s.filePath.replace(/\\/g, '/').split('/').pop() || ''
            searchKey = fn.replace(/\.[^.]+$/, '')
          }
        }
        console.log(`[batchMeta] 搜索: "${searchKey}"`)
        const results = await searchMusic(searchKey, 'all')
        if (!results || results.length === 0) {
          // 尝试用艺术家名搜索
          if (s.artists && s.artists.length && s.artists[0] !== '本地文件') {
            const key2 = `${searchKey} ${s.artists[0]}`
            console.log(`[batchMeta] 重试搜索: "${key2}"`)
            const results2 = await searchMusic(key2, 'all')
            if (results2 && results2.length > 0) {
              const r = results2[0]
              const metadata: any = {}
              if (r.name) metadata.title = r.name
              if (r.artists && r.artists.length) metadata.artist = r.artists.join(', ')
              if (r.album) metadata.album = r.album
              metadata.year = null
              metadata.genre = null
              metadata.track_number = null
              metadata.disc_number = null
              if (s.filePath && isTauri) {
                await invoke('write_metadata', { filePath: s.filePath, metadata })
              }
              s.name = r.name || s.name
              s.artists = r.artists || s.artists
              s.album = r.album || s.album
              ok++
              console.log(`[batchMeta] 已保存(重试): ${s.name}`)
              continue
            }
          }
          fail++
          failedNames.push(s.name || s.filePath || '未知')
          console.warn(`[batchMeta] 未找到: ${searchKey}`)
          continue
        }
        const r = results[0]
        const metadata: any = {}
        if (r.name) metadata.title = r.name
        if (r.artists && r.artists.length) metadata.artist = r.artists.join(', ')
        if (r.album) metadata.album = r.album
        metadata.year = null
        metadata.genre = null
        metadata.track_number = null
        metadata.disc_number = null
        // 自动保存到文件
        if (s.filePath && isTauri) {
          try {
            await invoke('write_metadata', { filePath: s.filePath, metadata })
            console.log(`[batchMeta] 已保存: ${r.name}`)
          } catch (writeErr: any) {
            console.warn(`[batchMeta] 保存失败: ${r.name}`, writeErr)
            // 保存失败不算完全失败，至少更新内存
          }
        }
        // 更新内存中的歌曲对象
        s.name = r.name || s.name
        s.artists = r.artists || s.artists
        s.album = r.album || s.album
        ok++
      } catch (e) {
        fail++
        failedNames.push(s.name || s.filePath || '未知')
        console.warn(`[batchMeta] 失败: ${s.name}`, e)
      }
    }
    if (fail > 0) {
      const showNames = failedNames.slice(0, 5).join('、')
      const more = failedNames.length > 5 ? ` 等 ${failedNames.length} 首` : ''
      message.warning(`批量填写完成：${ok} 成功，${fail} 失败：${showNames}${more}`)
    } else {
      message.success(`批量填写完成：${ok} 首全部成功`)
    }
  } catch (e: any) {
    message.error(`批量填写出错：${e?.message || e}`)
  } finally {
    batchMetaLoading.value = false
  }
}

// ── 设置 ─────────────────────────
const showSettings = ref(false)
const defaultLyricSource = ref(localStorage.getItem('lyric-source') || 'netease')
function saveSettings() {
  localStorage.setItem('lyric-source', defaultLyricSource.value)
  message.success('设置已保存')
  showSettings.value = false
}
</script>

<style lang="scss" scoped>
.app { display:flex; flex-direction:column; height:100vh; background:#F5F7FA; overflow:hidden; }

/* ── 顶部栏 ───────────────────── */
.header {
  display:flex; align-items:center; justify-content:space-between;
  height:52px; padding:0 20px; background:#FFF;
  border-bottom:1px solid #E1E8ED; flex-shrink:0;
}
.header-left { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.logo-icon { width:26px; height:26px; color:#4ECDC4; }
.logo-text {
  font-size:17px; font-weight:700;
  background:linear-gradient(135deg,#4ECDC4,#2EAA9E);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.header-center { flex:1; max-width:480px; margin:0 20px; display:flex; gap:8px; }
.header-center .n-input { flex:1; }
.header-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }

/* ── 主体左右分栏 ─────────────── */
.main { flex:1; display:flex; overflow:hidden; }

/* 左栏：歌曲库 */
.left-panel {
  width:320px; min-width:260px; border-right:1px solid #E1E8ED;
  display:flex; flex-direction:column; background:#FFF; flex-shrink:0;
}
.panel-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px; border-bottom:1px solid #F0F3F6; flex-shrink:0;
  font-size:14px; font-weight:600; color:#1A1A2E;
}
.panel-title { font-size:14px; font-weight:600; color:#1A1A2E; }
.panel-actions { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:400; }
.select-all-label { display:flex; align-items:center; gap:4px; cursor:pointer; color:#374151; }
.count { color:#9CA3AF; font-size:12px; }

.song-rows { flex:1; overflow-y:auto; }
.song-row {
  display:flex; align-items:center; gap:10px;
  padding:8px 16px; cursor:pointer; border-bottom:1px solid #F7F9FC;
  transition:background 0.15s;
  &:hover { background:#F7F9FC; }
  &.active { background:rgba(78,205,196,0.08); border-right:3px solid #4ECDC4; }
}
.thumb { width:34px; height:34px; border-radius:6px; object-fit:cover; flex-shrink:0; }
.thumb-placeholder {
  width:34px; height:34px; border-radius:6px;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#4ECDC4,#2EAA9E); color:#FFF; font-size:13px; flex-shrink:0;
}
.song-text { flex:1; min-width:0; }
.song-name { font-size:13px; font-weight:500; color:#1A1A2E; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.song-artist { font-size:11px; color:#9CA3AF; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.empty { flex:1; display:flex; align-items:center; justify-content:center; }

/* 右栏 */
.right-panel {
  flex:1; display:flex; flex-direction:column; overflow:hidden;
  padding:16px 20px; gap:12px;
}

/* 功能按钮栏 */
.function-bar {
  display:flex; align-items:center; gap:8px; flex-shrink:0;
  background:#FFF; border-radius:10px; padding:8px 14px;
  border:1px solid #E1E8ED;
}
.spacer { flex:1; }
.selected-count { font-size:12px; color:#9CA3AF; }

/* 功能面板区 */
.function-panels { flex:1; overflow-y:auto; min-height:0; }
.func-panel {
  background:#FFF; border-radius:12px; border:1px solid #E1E8ED;
  overflow:hidden;
}
.func-panel + .func-panel { margin-top:12px; }
.panel-header-actions { display:flex; gap:6px; }
.panel-body { padding:16px; }

/* 格式转换 */
.convert-config { margin-top:16px; }
.format-picker { display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:13px; color:#374151; }
.file-rows { max-height:180px; overflow-y:auto; margin-bottom:12px; }
.file-row {
  display:flex; align-items:center; gap:10px; padding:6px 8px;
  border-bottom:1px solid #F3F4F6; font-size:13px;
}
.fname { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#374151; }
.fstatus { font-size:11px; color:#9CA3AF; min-width:70px; text-align:right; }
.fstatus.done { color:#10B981; }
.fstatus.fail { color:#EF4444; }
.convert-empty { padding:20px; }
.panel-subtitle { font-size:12px; color:#9CA3AF; font-weight:400; }
.convert-actions-top { display:flex; gap:8px; margin-bottom:12px; align-items:center; }
.convert-progress-text { font-size:12px; color:#4ECDC4; font-weight:600; }
.f-progress { display:flex; align-items:center; min-width:80px; justify-content:flex-end; gap:4px; }
.progress-val { font-size:11px; color:#4ECDC4; font-weight:600; min-width:32px; text-align:right; }
.f-actions { display:flex; gap:4px; min-width:50px; justify-content:flex-end; }
.convert-errors { margin-top:8px; }
.error-item { font-size:12px; color:#EF4444; padding:4px 0; border-bottom:1px solid #FEE2E2; }

/* 歌词管理 */
.lyric-preview { }
.lyric-text {
  font-size:13px; line-height:1.8; white-space:pre-wrap;
  max-height:260px; overflow-y:auto; padding:8px;
  background:#F9FAFB; border-radius:8px; color:#374151;
}
.lyric-text-modal {
  font-size:13px; line-height:1.8; white-space:pre-wrap;
  max-height:400px; overflow-y:auto; padding:8px;
  background:#F9FAFB; border-radius:8px; color:#374151;
}
.lyric-actions { display:flex; gap:8px; margin-top:10px; }
.lyric-empty { padding:20px; }
.sub-title { font-size:13px; font-weight:600; color:#374151; margin:12px 0 8px; }
.lyrics-batch-list { max-height:200px; overflow-y:auto; }
.batch-item {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 8px; border-bottom:1px solid #F3F4F6; font-size:13px;
}

/* 元数据编辑 */
.metadata-form-area { display:flex; gap:20px; }
.meta-cover { flex-shrink:0; }
.cover-img-sm { width:100px; height:100px; border-radius:8px; object-fit:cover; }
.cover-placeholder-sm {
  width:100px; height:100px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#EEF2F7,#F7F9FC); font-size:32px; color:#9CA3AF;
}
.meta-btns { display:flex; gap:10px; padding-top:8px; }
.meta-empty { padding:20px; }

/* ── 设置 ───────────────────── */
.settings-content { display:flex; flex-direction:column; gap:16px; }
.settings-row { display:flex; flex-direction:column; gap:6px;
  label { font-size:13px; font-weight:500; color:#374151; }
}
</style>
