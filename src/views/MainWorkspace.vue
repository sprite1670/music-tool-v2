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

      <!-- 右栏：歌曲详情 + 功能面板 -->
      <section class="right-panel">
        <!-- 歌曲详情卡片 -->
        <div v-if="currentSong" class="detail-card">
          <div class="detail-cover">
            <img v-if="currentSong.cover_url" :src="currentSong.cover_url" class="cover-img"/>
            <div v-else class="cover-placeholder">♪</div>
          </div>
          <div class="detail-info">
            <h3>{{ currentSong.name }}</h3>
            <p class="artist">{{ currentSong.artists?.join(', ') }}</p>
            <p class="album">{{ currentSong.album || '-' }}</p>
          </div>
        </div>
        <div v-else class="detail-placeholder">
          <n-empty description="选择歌曲查看详情"/>
        </div>

        <!-- 功能按钮区：格式转换 / 歌词管理 / 元数据编辑 -->
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

        <!-- 可折叠功能面板 -->
        <div class="function-panels">
          <!-- 格式转换面板 -->
          <div v-show="activePanel === 'convert'" class="func-panel">
            <div class="panel-header">
              <span class="panel-title">🔄 格式转换</span>
              <span class="panel-subtitle">使用左侧歌曲库中已选中的歌曲</span>
            </div>
            <div class="panel-body">
              <div v-if="selectedSongs.length === 0" class="convert-empty">
                <n-empty description="请在左侧选择要转换的歌曲"/>
              </div>
              <div v-else class="convert-config">
                <div v-if="ffmpegLoadError" class="ffmpeg-error">
                  <div class="error-box">⚠️ FFmpeg 加载失败：{{ ffmpegLoadError }}</div>
                </div>
                <div class="format-picker">
                  <span>目标格式：</span>
                  <n-radio-group v-model:value="convertTargetFormat" size="small">
                    <n-radio-button value="mp3">MP3</n-radio-button>
                    <n-radio-button value="wav">WAV</n-radio-button>
                    <n-radio-button value="ogg">OGG</n-radio-button>
                  </n-radio-group>
                </div>
                <div class="convert-actions-top">
                  <n-button size="small" :loading="ffmpegLoading" :disabled="convertingAny" @click="startConvertAll">全部转换</n-button>
                  <n-button size="small" secondary :disabled="!convertingAny" @click="stopAllConvert">全部停止</n-button>
                </div>
                <div class="file-rows">
                  <div v-for="song in selectedSongs" :key="song.id" class="file-row">
                    <span class="fname">{{ song.name }}</span>
                    <div class="fprogress">
                      <n-progress v-if="convertStates[song.id]?.status === 'converting'"
                                  type="line" :percentage="convertStates[song.id]?.progress || 0"
                                  :show-indicator="false" :height="4" style="width:80px;"/>
                      <span v-else :class="['fstatus',
                        convertStates[song.id]?.status === 'done' ? 'done' :
                        convertStates[song.id]?.status === 'error' ? 'fail' : '']">
                        {{ convertStates[song.id]?.status === 'done' ? '完成' :
                           convertStates[song.id]?.status === 'error' ? '失败' : '等待中' }}
                      </span>
                    </div>
                    <div class="factions">
                      <n-button v-if="convertStates[song.id]?.status === 'converting'"
                                size="tiny" quaternary type="error" @click="stopConvert(song.id)">停止</n-button>
                      <n-button v-else-if="convertStates[song.id]?.status !== 'converting'"
                                size="tiny" quaternary :disabled="convertingAny"
                                @click="startConvertOne(song)">转换</n-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 歌词管理面板 -->
          <div v-show="activePanel === 'lyrics'" class="func-panel">
            <div class="panel-header">
              <span class="panel-title">📝 歌词管理</span>
              <div class="panel-header-actions">
                <n-button size="tiny" secondary @click="batchDownloadLyrics" :disabled="selectedIds.size === 0">批量下载</n-button>
              </div>
            </div>
            <div class="panel-body">
              <!-- 当前歌曲歌词 -->
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
              <!-- 批量歌词歌曲列表 -->
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

    <!-- 歌词预览弹窗（从歌曲列表点击预览时使用） -->
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
import { ref, computed, onMounted, toRaw } from 'vue'
import {
  NInput, NButton, NIcon, NEmpty, NTag, NModal,
  NForm, NFormItem, NRadioGroup, NRadioButton,
  NTabs, NTabPane, useMessage, NSelect, NProgress,
} from 'naive-ui'
import {
  SearchOutline, FolderOpenOutline, SettingsOutline,
  SyncOutline, DocumentTextOutline, DiscOutline, PencilOutline,
} from '@vicons/ionicons5'
import {
  searchMusic, getLyrics, saveFileDialog,
  selectFolderDialog, isTauri, loadLyricsForLocal,
} from '@/services/platform'
import { addRecent } from '@/services/recent'

const message = useMessage()

// ── 搜索 ─────────────────────────
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
  if (isTauri) {
    const result = await selectFolderDialog({ title: '选择音乐文件夹' })
    if (!result) return
    const folderPath = Array.isArray(result) ? result[0] : result
    message.info('正在扫描...')
    const { readDir, readFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
    const { parseBlob } = await import('music-metadata-browser')
    const audioExts = ['.mp3','.flac','.wav','.m4a','.ogg','.wma','.aac','.ape']
    async function walk(dir: string): Promise<{path:string,name:string}[]> {
      const out: {path:string,name:string}[] = []
      try {
        const entries = await readDir(dir)
        for (const e of entries) {
          const p = `${dir}/${e.name}`
          if (e.isDirectory) { const r = await walk(p); out.push(...r) }
          else if (e.isFile && audioExts.some(x => e.name.toLowerCase().endsWith(x))) out.push({ path: p, name: e.name })
        }
      } catch {}
      return out
    }
    const files = await walk(folderPath)
    const parsed: any[] = []
    for (const f of files) {
      try {
        const data = await readFile(f.path)
        const blob = new Blob([data])
        const m = await parseBlob(blob)
        parsed.push({
          id: f.name + Date.now(), name: m.common?.title || f.name.replace(/\.[^.]+$/,''),
          artists: m.common?.artist ? [m.common.artist] : ['本地文件'],
          album: m.common?.album || '本地音乐', duration: Math.round(m.format?.duration||0),
          source: 'local', cover_url: '', file: blob,
          lyricist: m.common?.lyricist || '', composer: m.common?.composer || '',
        })
      } catch {}
    }
    songs.value = parsed
    if (parsed.length) selectSong(parsed[0])
    message.success(`已扫描 ${parsed.length} 首`)
    return
  }
  // Web 版
  const input = document.createElement('input')
  input.type = 'file'; input.multiple = true; input.accept = 'audio/*'
  input.onchange = async (e: any) => {
    const files: File[] = Array.from(e.target.files)
    const parsed: any[] = []
    for (const f of files) {
      let m: any = {}
      try { m = await (await import('music-metadata-browser')).parseBlob(f) } catch {}
      parsed.push({
        id: f.name + Date.now(), name: m.common?.title || f.name.replace(/\.[^.]+$/,''),
        artists: m.common?.artist ? [m.common.artist] : ['本地文件'],
        album: m.common?.album || '本地音乐', duration: Math.round(m.format?.duration||0),
        source: 'local', cover_url: '', file: f,
        lyricist: m.common?.lyricist || '', composer: m.common?.composer || '',
      })
    }
    songs.value = parsed
    if (parsed.length) selectSong(parsed[0])
    message.success(`已加载 ${parsed.length} 首`)
  }
  input.click()
}

// ── 歌词 ─────────────────────────
const showLyricModal = ref(false)
const lyricTab = ref<'original'|'translated'>('original')
const lyricData = ref<{lyric:string, translated?:string}>({ lyric: '' })
const editForm = ref({ title:'', artist:'', album:'', lyricist:'', composer:'', lyrics:'' })
const showLyricPanel = ref(false)

async function fetchLyricsForCurrent() {
  if (!currentSong.value) return
  try {
    const r = await getLyrics(currentSong.value.id, currentSong.value.source, currentSong.value.name)
    lyricData.value = r
    editForm.value.lyrics = r.lyric || ''
    if (showLyricPanel.value) showLyricPanel.value = true
  } catch {}
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
  downloadBlob(t, `${currentSong.value.name} - ${currentSong.value.artists?.[0]||'未知'}.lrc`)
  message.success('歌词已下载')
}

// ── 批量下载歌词 ─────────────────
async function batchDownloadLyrics() {
  const sel = songs.value.filter(s => selectedIds.value.has(s.id+'|'+s.source))
  if (!sel.length) return
  message.info(`正在下载 ${sel.length} 首歌词...`)
  let ok = 0
  for (const s of sel) {
    try {
      const r = await getLyrics(s.id, s.source, s.name)
      if (r.lyric) { downloadBlob(r.lyric, `${s.name} - ${s.artists?.[0]||'未知'}.lrc`); ok++ }
    } catch {}
    await new Promise(r => setTimeout(r, 600))
  }
  message.success(`已完成 ${ok}/${sel.length} 首`)
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

// ── 格式转换（FFmpeg WASM）───────
const convertTargetFormat = ref<'mp3' | 'wav' | 'ogg'>('mp3')
const convertStates = ref<Record<string, {
  status: 'waiting' | 'converting' | 'done' | 'error'
  progress: number
  error?: string
}>>({})
const ffmpegLoading = ref(false)
const ffmpegLoadError = ref('')
let ffmpegInstance: any = null
let abortCtrls = new Map<string, AbortController>()

const selectedSongs = computed(() =>
  songs.value.filter(s => selectedIds.value.has(s.id + '|' + s.source))
)
const convertingAny = computed(() =>
  Object.values(convertStates.value).some(s => s.status === 'converting')
)

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance
  if (ffmpegLoading.value) {
    // 等待其他调用者完成加载
    while (ffmpegLoading.value) {
      await new Promise(r => setTimeout(r, 200))
    }
    if (ffmpegInstance) return ffmpegInstance
    throw new Error(ffmpegLoadError.value || 'FFmpeg 加载失败')
  }

  ffmpegLoading.value = true
  ffmpegLoadError.value = ''
  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    const ffmpeg = new FFmpeg()

    ffmpeg.on('log', ({ message: msg }) => {
      console.log('[FFmpeg]', msg)
    })

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

    const timeoutMs = 60000
    const loadPromise = ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`加载超时（${timeoutMs / 1000}秒），请检查网络`)), timeoutMs)
    )

    await Promise.race([loadPromise, timeoutPromise])
    ffmpegInstance = ffmpeg
    message.success('FFmpeg 加载成功')
    return ffmpeg
  } catch (e: any) {
    const errMsg = e?.message || String(e)
    ffmpegLoadError.value = errMsg
    message.error(`FFmpeg 加载失败：${errMsg}`)
    console.error('[FFmpeg] 加载失败:', e)
    throw e
  } finally {
    ffmpegLoading.value = false
  }
}

async function convertOneSong(song: any, outputExt: string): Promise<void> {
  const sid = song.id
  const abortCtrl = new AbortController()
  abortCtrls.set(sid, abortCtrl)

  convertStates.value[sid] = { status: 'converting', progress: 0 }

  try {
    // 解包 Vue Proxy，避免污染原生对象
    const rawSong = toRaw(song)
    const inputFile: File | Blob | undefined = rawSong.file
    if (!inputFile) {
      throw new Error('文件数据缺失，请重新扫描本地歌曲')
    }
    if ((inputFile as any).size === 0) {
      throw new Error('文件大小为 0')
    }

    const ffmpeg = await getFfmpeg()
    if (abortCtrl.signal.aborted) throw new Error('已取消')

    const { fetchFile } = await import('@ffmpeg/util')
    const inputExt = inputFile instanceof File
      ? inputFile.name.split('.').pop() || 'bin'
      : 'bin'
    const inputName = `in_${sid}.${inputExt}`
    const outputName = `out_${sid}.${outputExt}`

    convertStates.value[sid].progress = 5
    await ffmpeg.writeFile(inputName, await fetchFile(inputFile))
    if (abortCtrl.signal.aborted) throw new Error('已取消')

    convertStates.value[sid].progress = 20
    const args = ['-i', inputName, '-vn']
    if (outputExt === 'mp3') {
      args.push('-codec:a', 'libmp3lame', '-b:a', '320k')
    } else if (outputExt === 'ogg') {
      args.push('-codec:a', 'libvorbis', '-q:a', '4')
    } else if (outputExt === 'wav') {
      args.push('-codec:a', 'pcm_s16le')
    }
    args.push('-y', outputName)

    const execPromise = ffmpeg.exec(args)
    const execTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('转换超时（60秒）')), 60000)
    )
    await Promise.race([execPromise, execTimeout])
    if (abortCtrl.signal.aborted) throw new Error('已取消')

    convertStates.value[sid].progress = 80
    const data = await ffmpeg.readFile(outputName)
    if (abortCtrl.signal.aborted) throw new Error('已取消')

    const uint8Data = data as Uint8Array
    if (!uint8Data || uint8Data.length === 0) {
      throw new Error('转换输出为空，可能是输入格式不支持')
    }

    const blob = new Blob([uint8Data.buffer as ArrayBuffer], { type: `audio/${outputExt}` })
    const newName = `${song.name}.${outputExt}`
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u; a.download = newName; a.click()
    URL.revokeObjectURL(u)

    // 清理虚拟文件系统
    try { await ffmpeg.deleteFile(inputName) } catch { }
    try { await ffmpeg.deleteFile(outputName) } catch { }

    convertStates.value[sid] = { status: 'done', progress: 100 }
    message.success(`${song.name} 转换完成`)
  } catch (e: any) {
    if (e.message === '已取消' || abortCtrl.signal.aborted) {
      convertStates.value[sid] = { status: 'waiting', progress: 0 }
    } else {
      const errMsg = e?.message || String(e)
      convertStates.value[sid] = { status: 'error', progress: 0, error: errMsg.slice(0, 120) }
      console.error('[convert]', e)
      message.error(`${song.name} 转换失败：${errMsg.slice(0, 80)}`)
    }
  } finally {
    abortCtrls.delete(sid)
  }
}

async function startConvertOne(song: any) {
  if (ffmpegLoading.value) { message.warning('FFmpeg 加载中，请稍候'); return }
  await convertOneSong(song, convertTargetFormat.value)
}

async function startConvertAll() {
  if (selectedSongs.value.length === 0) { message.warning('请先选择歌曲'); return }
  if (ffmpegLoading.value) { message.warning('FFmpeg 加载中，请稍候'); return }
  for (const song of selectedSongs.value) {
    if (convertStates.value[song.id]?.status === 'converting') continue
    await convertOneSong(song, convertTargetFormat.value)
  }
}

function stopConvert(songId: string) {
  const ctrl = abortCtrls.get(songId)
  if (ctrl) { ctrl.abort(); abortCtrls.delete(songId) }
}

function stopAllConvert() {
  for (const [sid, ctrl] of abortCtrls) { ctrl.abort() }
  abortCtrls.clear()
}

// ── 元数据编辑 ───────────────────
const saving = ref(false)
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

async function saveMetadata() {
  if (!currentSong.value) return
  saving.value = true
  try {
    if (currentSong.value.source === 'local' && isTauri) {
      const { invoke } = await import('@tauri-apps/api/core')
      const tags: any = {}
      if (editForm.value.title) tags.title = editForm.value.title
      if (editForm.value.artist) tags.artist = editForm.value.artist
      if (editForm.value.album) tags.album = editForm.value.album
      if (editForm.value.lyricist) tags.lyricist = editForm.value.lyricist
      if (editForm.value.composer) tags.composer = editForm.value.composer
      if (editForm.value.lyrics) tags.unsynchronisedLyrics = [{ language: 'chi', text: editForm.value.lyrics }]
      await invoke('write_meta_tags', { filePath: currentSong.value.file, tags })
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

/* 歌曲详情卡片 */
.detail-card {
  display:flex; align-items:center; gap:16px;
  background:#FFF; border-radius:12px; padding:16px 20px;
  border:1px solid #E1E8ED; flex-shrink:0;
}
.detail-cover { flex-shrink:0; }
.cover-img { width:64px; height:64px; border-radius:8px; object-fit:cover; }
.cover-placeholder {
  width:64px; height:64px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#EEF2F7,#F7F9FC); font-size:24px; color:#9CA3AF;
}
.detail-info { flex:1; min-width:0; }
.detail-info h3 { font-size:15px; font-weight:700; color:#1A1A2E; margin:0 0 4px; }
.detail-info .artist { font-size:13px; color:#6B7280; margin:0 0 2px; }
.detail-info .album { font-size:12px; color:#9CA3AF; margin:0; }
.detail-actions { display:flex; gap:8px; flex-shrink:0; }

.detail-placeholder { flex-shrink:0; padding:20px; }

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
.panel-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 16px; border-bottom:1px solid #F0F3F6;
}
.panel-header-actions { display:flex; gap:6px; }
.panel-body { padding:16px; }

/* 格式转换 */
.upload-zone {
  border:2px dashed #D1D5DB; border-radius:12px; padding:32px;
  text-align:center; cursor:pointer; transition:all 0.2s;
  &:hover { border-color:#4ECDC4; background:rgba(78,205,196,0.03); }
  p { margin-top:8px; color:#6B7280; font-size:14px; }
  .hint { font-size:12px; color:#9CA3AF; }
  .upload-icon { color:#4ECDC4; }
}
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
.convert-actions-top { display:flex; gap:8px; margin-bottom:12px; }
.fprogress { display:flex; align-items:center; min-width:80px; justify-content:flex-end; }
.factions { display:flex; gap:4px; min-width:50px; justify-content:flex-end; }
.ffmpeg-error { margin-bottom:12px; }
.error-box {
  background:#FEF2F2; border:1px solid #FECACA; border-radius:8px;
  padding:10px 14px; font-size:13px; color:#B91C1C; line-height:1.5;
}

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
