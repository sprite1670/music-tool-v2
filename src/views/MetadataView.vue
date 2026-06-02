<template>
  <div class="metadata-view">
    <h1 class="page-title"><span class="icon">✏️</span> 元数据编辑</h1>

    <div class="meta-layout">
      <!-- 文件选择区 -->
      <div class="file-section">
        <div class="drop-zone" :class="{ active: isDragging }"
             @dragover.prevent="isDragging = true"
             @dragleave.prevent="isDragging = false"
             @drop.prevent="handleDrop"
             @click="selectFile">
          <template v-if="!currentFile">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#B0BEC5">
              <path d="M9 13h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#B0BEC5"
                    stroke-width="2" fill="none"/>
            </svg>
            <p>拖拽音频文件或点击选择</p>
            <span>支持 MP3 / FLAC / WAV / M4A 等格式</span>
          </template>
          <template v-else>
            <n-icon :component="MusicalNotesOutline" size="28" color="#4ECDC4" />
            <strong>{{ currentFileName }}</strong>
          </template>
        </div>

        <div v-if="currentFile" class="file-actions">
          <n-button size="small" secondary @click="selectFile">更换文件</n-button>
          <n-button size="small" secondary type="primary" @click="saveMetadata"
                    :loading="saving">保存修改</n-button>
        </div>
        <p v-if="!isTauriEnv" class="web-hint">⚠️ Web 版仅支持读取和编辑元数据，保存将生成新文件下载</p>
      </div>

      <!-- 编辑区域 -->
      <div class="editor-section card" v-if="loaded">
        <!-- 封面预览 -->
        <div class="cover-area">
          <div class="cover-preview">
            <img v-if="metadata.cover" :src="metadata.cover" alt="封面" />
            <div v-else class="no-cover">暂无封面</div>
          </div>
          <n-button size="small" dashed @click="changeCover">更换封面</n-button>
        </div>

        <!-- 标签表单 -->
        <n-form label-placement="left" label-width="70px" :show-feedback="false"
                 style="margin-top: 20px;">
          <n-form-item label="歌曲名">
            <n-input v-model:value="metadata.title" placeholder="输入歌曲名称" />
          </n-form-item>
          <n-form-item label="演唱者">
            <n-input v-model:value="metadata.artist" placeholder="输入歌手名称，多人用 / 分隔" />
          </n-form-item>
          <n-form-item label="专辑">
            <n-input v-model:value="metadata.album" placeholder="输入专辑名称" />
          </n-form-item>
          <n-form-item-row :label="'年份'">
            <n-input-number v-model:value="metadata.year" :min="1900" :max="2100"
                            placeholder="年份" style="width: 100%;" />
          </n-form-item-row>
          <n-form-item label="流派">
            <n-input v-model:value="metadata.genre" placeholder="如 Pop, Rock, R&B" />
          </n-form-item>
          <n-form-item label="音轨号">
            <n-input-number v-model:value="metadata.trackNumber" :min="1"
                            placeholder="音轨号" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="碟片号">
            <n-input-number v-model:value="metadata.discNumber" :min="1"
                            placeholder="碟片号" style="width: 100%;" />
          </n-form-item>
        </n-form>

        <!-- 原始信息（只读） -->
        <n-divider>原始文件信息</n-divider>
        <div class="raw-info">
          <info-row label="文件格式">{{ fileFormat }}</info-row>
          <info-row label="文件大小">{{ formatSize(fileSize) }}</info-row>
          <info-row label="时长">{{ formatDuration(duration) }}</info-row>
          <info-row label="采样率">{{ sampleRate }} Hz</info-row>
          <info-row label="比特率">{{ bitrate }} kbps</info-row>
        </div>
      </div>

      <!-- 未加载状态 -->
      <div v-if="currentFile && !loaded" class="card loading-card">
        <n-spin /> 正在读取文件信息...
      </div>
    </div>

    <!-- 封面上传隐藏 input -->
    <input ref="coverInputRef" type="file" accept="image/*" style="display: none;"
           @change="onCoverSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NInput, NButton, NIcon, NForm, NFormItem, NInputNumber,
  NSpin, NDivider, useMessage, NTag,
} from 'naive-ui'
import { MusicalNotesOutline } from '@vicons/ionicons5'
import { invoke } from '@/services/platform'
import { addRecent } from '@/services/recent'

const message = useMessage()

const currentFile = ref<File | null>(null)
const currentFileName = ref('')
const loaded = ref(false)
const saving = ref(false)
const isDragging = ref(false)
const isTauriEnv = ref(false)

// 元数据
interface MetaData {
  title: string
  artist: string
  album: string
  year: number | null
  genre: string
  trackNumber: number | null
  discNumber: number | null
  cover: string | null // blob URL
}

const metadata = ref<MetaData>({
  title: '', artist: '', album: '', year: null,
  genre: '', trackNumber: null, discNumber: null, cover: null,
})

// 文件信息（只读）
const fileFormat = ref('-')
const fileSize = ref(0)
const duration = ref(0)
const sampleRate = ref(0)
const bitrate = ref(0)
const coverInputRef = ref<HTMLInputElement | null>(null)

const coverPreviewUrl = computed(() => {
  return metadata.value.cover || ''
})

onMounted(() => {
  // 检测是否 Tauri 环境
  isTauriEnv.value = (typeof window !== 'undefined') &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
})

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) loadFile(files[0])
}

function selectFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp3,.flac,.wav,.aac,.m4a,.ogg,.wma,.ape'
  input.onchange = (e: any) => { if (e.target?.files?.[0]) loadFile(e.target.files[0]) }
  input.click()
}

async function loadFile(file: File) {
  currentFile.value = file
  currentFileName.value = file.name
  loaded.value = false
  fileSize.value = file.size

  try {
    // 动态导入 music-metadata-browser（减少首屏体积）
    const mm = await import('music-metadata-browser')
    const meta = await mm.parseBlob(file)
    const common = meta.common
    const fmt = meta.format

    metadata.value = {
      title: common.title || file.name.replace(/\.[^.]+$/, ''),
      artist: common.artist || '',
      album: common.album || '',
      year: common.year || null,
      genre: common.genre?.[0] || '',
      trackNumber: common.track?.no || null,
      discNumber: common.disk?.no || null,
      cover: null,
    }

    // 提取封面
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      const blob = new Blob([new Uint8Array(pic.data as any)], { type: pic.format || 'image/jpeg' })
      metadata.value.cover = URL.createObjectURL(blob)
    }

    fileFormat.value = (fmt.container || file.name.split('.').pop() || '?').toUpperCase()
    duration.value = fmt.duration ? Math.round(fmt.duration) : 0
    sampleRate.value = fmt.sampleRate || 0
    bitrate.value = fmt.bitrate ? Math.round(fmt.bitrate / 1000) : 0
  } catch (e: any) {
    console.warn('[Metadata] 读取失败，使用文件名填充', e)
    metadata.value = {
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: '',
      album: '',
      year: null,
      genre: '',
      trackNumber: null,
      discNumber: null,
      cover: null,
    }
    fileFormat.value = (file.name.split('.').pop() || '?').toUpperCase()
    message.warning('无法读取完整元数据，已用文件名填充')
  } finally {
    loaded.value = true
  }
}

function changeCover() {
  coverInputRef.value?.click()
}

function onCoverSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    metadata.value.cover = reader.result as string
  }
  reader.readAsDataURL(file)
}

async function saveMetadata() {
  if (!currentFile.value) return

  saving.value = true
  try {
    if (isTauriEnv.value) {
      // Tauri 环境：调用后端写入元数据
      const filePath = (currentFile.value as any).path || currentFile.value.name
      await invoke('write_metadata', {
        file_path: filePath,
        metadata: {
          title: metadata.value.title || null,
          artist: metadata.value.artist || null,
          album: metadata.value.album || null,
          year: metadata.value.year,
          genre: metadata.value.genre || null,
          track_number: metadata.value.trackNumber,
          disc_number: metadata.value.discNumber,
        },
      })
      message.success('元数据保存成功！')
      addRecent({
        name: metadata.value.title || currentFileName.value,
        artists: metadata.value.artist ? [metadata.value.artist] : [],
        cover: '',
        action: '编辑元数据',
      })
    } else {
      // Web 环境：生成 README 风格的信息文件并下载（浏览器无法写入原音频文件）
      const info = [
        `文件名: ${currentFile.value.name}`,
        `歌曲名: ${metadata.value.title}`,
        `艺术家: ${metadata.value.artist}`,
        `专辑: ${metadata.value.album}`,
        metadata.value.year ? `年份: ${metadata.value.year}` : '',
        metadata.value.genre ? `流派: ${metadata.value.genre}` : '',
        metadata.value.trackNumber ? `音轨: ${metadata.value.trackNumber}` : '',
      ].filter(Boolean).join('\n')

      const blob = new Blob([info], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${metadata.value.title || 'metadata'}.txt`
      a.click()
      URL.revokeObjectURL(url)
      message.success('元数据已导出为文本文件（浏览器限制：无法写入原音频文件）')
      addRecent({
        name: metadata.value.title || currentFileName.value,
        artists: metadata.value.artist ? [metadata.value.artist] : [],
        cover: '',
        action: '编辑元数据',
      })
    }
  } catch (e: any) {
    message.error(`保存失败: ${String(e)}`)
  } finally {
    saving.value = false
  }
}

function formatSize(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
function formatDuration(sec: number): string {
  if (!sec) return '--:--'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style lang="scss" scoped>
.metadata-view { max-width: 860px; }

.meta-layout {
  display: flex;
  gap: 20px;
  @media (max-width: 700px) { flex-direction: column; }
}

.file-section {
  width: 260px;
  flex-shrink: 0;
  .drop-zone {
    border: 2px dashed var(--border-color, #E1E8ED);
    border-radius: 12px;
    padding: 28px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.25s;
    &:hover, &.active { border-color: #4ECDC4; background: rgba(78,205,196,0.05); }
    p { font-size: 14px; margin: 10px 0 6px; color: #2C3E50; }
    span { font-size: 12px; color: #90A4AE; }
    strong { font-size: 13px; word-break: break-all; }
  }
  .file-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: center; }
  .web-hint { font-size: 11px; color: #F39C12; margin-top: 8px; text-align: center; }
}

.editor-section { flex: 1; min-width: 0; }

.cover-area {
  display: flex; align-items: center; gap: 16px;
  .cover-preview {
    width: 100px; height: 100px; border-radius: 8px; overflow: hidden;
    background: #F1F5F9; display: flex; align-items: center; justify-content: center;
    img { width: 100%; height: 100%; object-fit: cover; }
    .no-cover { font-size: 12px; color: #90A4AE; }
  }
}

.raw-info {
  display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 13px;
}

.loading-card { text-align: center; padding: 40px; }
</style>
