<template>
  <div class="converter-view">
    <h1 class="page-title"><span class="icon">🔄</span> 格式转换</h1>

    <!-- 文件选择区 -->
    <div
      class="drop-zone"
      :class="{ active: isDragging, 'has-files': files.length > 0 }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="selectFiles"
    >
      <div v-if="files.length === 0" class="drop-hint">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="#B0BEC5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
          <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" stroke="white" stroke-width="1.5"/>
        </svg>
        <p>拖拽音频文件到此处，或点击选择文件</p>
        <span>支持 MP3 / FLAC / WAV / AAC / OGG 等格式</span>
      </div>

      <!-- 已选文件列表 -->
      <div v-else class="file-list">
        <div v-for="(file, idx) in files" :key="idx" class="file-item">
          <n-icon :component="MusicalNotesOutline" size="20" color="#4ECDC4" />
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <n-button quaternary circle size="tiny" @click.stop="removeFile(idx)">
            <template #icon><n-icon :component="CloseOutline" /></template>
          </n-button>
        </div>
        <div class="add-more" @click.stop="selectFiles">+ 继续添加文件</div>
      </div>
    </div>

    <!-- 转换选项 -->
    <div class="options-panel card">
      <div class="option-row">
        <label>输出格式：</label>
        <n-select v-model:value="targetFormat" :options="formatOptions"
                  style="width: 180px;" />
      </div>

      <div class="option-row" v-if="targetFormat === 'mp3' || targetFormat === 'aac' || targetFormat === 'ogg'">
        <label>码率：</label>
        <n-select v-model:value="bitrate" :options="bitrateOptions"
                  style="width: 140px;" />
      </div>

      <div class="option-row">
        <label>采样率：</label>
        <n-select v-model:value="sampleRate" :options="sampleRateOptions"
                  style="width: 140px;" />
      </div>
    </div>

    <!-- 转换按钮和进度 -->
    <div class="action-area">
      <n-button type="primary" size="large" :disabled="files.length === 0 || converting"
                :loading="converting" @click="startConvert"
                style="min-width: 160px;">
        {{ converting ? '转换中...' : `开始转换 (${files.length})` }}
      </n-button>

      <!-- 进度条 -->
      <div v-if="converting || convertProgress > 0" class="progress-section">
        <n-progress type="line" :percentage="convertProgress" :status="progressStatus"
                    :show-indicator="true" style="margin: 12px 0;" />
        <p class="progress-text">{{ progressText }}</p>
      </div>
    </div>

    <!-- 完成结果 -->
    <div v-if="completed && !converting" class="result-section card">
      <n-result :status="hasError ? 'warning' : 'success'"
                :title="hasError ? '转换完成（部分失败）' : '转换完成！'"
                :description="`成功 ${convertedCount} / ${files.length}`">
        <template #footer>
          <n-button @click="resetAll">重新开始</n-button>
        </template>
      </n-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NSelect, NButton, NIcon, NProgress, NResult,
  useMessage,
} from 'naive-ui'
import { MusicalNotesOutline, CloseOutline } from '@vicons/ionicons5'

const message = useMessage()

const isTauriEnv = ref(false)
onMounted(() => {
  isTauriEnv.value = (typeof window !== 'undefined') &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
})

const files = ref<File[]>([])
const isDragging = ref(false)
const targetFormat = ref<string>('wav')
const bitrate = ref<string>('320k')
const sampleRate = ref<string>('44100')
const converting = ref(false)
const convertProgress = ref(0)
const progressText = ref('')
const progressStatus = ref<'success' | 'warning' | 'error'>('success')
const completed = ref(false)
const convertedCount = ref(0)
const hasError = ref(false)

const formatOptions = [
  { label: 'WAV (无损)', value: 'wav' },
  { label: 'MP3 (最常用)', value: 'mp3' },
  { label: 'FLAC (无损)', value: 'flac' },
  { label: 'OGG (开源)', value: 'ogg' },
  { label: 'AAC (Apple)', value: 'aac' },
]

const bitrateOptions = [
  { label: '128 kbps', value: '128k' },
  { label: '192 kbps', value: '192k' },
  { label: '256 kbps', value: '256k' },
  { label: '320 kbps (最佳)', value: '320k' },
]

const sampleRateOptions = [
  { label: '44.1 kHz', value: '44100' },
  { label: '48 kHz', value: '48000' },
]

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const dropped = e.dataTransfer?.files
  if (dropped) addFiles(Array.from(dropped))
}

function selectFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.mp3,.flac,.wav,.aac,.ogg,.m4a,.wma,.ape'
  input.onchange = (e: any) => {
    if (e.target?.files) addFiles(Array.from(e.target.files))
  }
  input.click()
}

function addFiles(newFiles: File[]) {
  for (const f of newFiles) {
    if (!files.value.some(x => x.name === f.name && x.size === f.size)) {
      files.value.push(f)
    }
  }
}

function removeFile(idx: number) {
  files.value.splice(idx, 1)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── 音频 Buffer 转 WAV Blob ─────────────────
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

// ── 使用 FFmpeg WASM 转换 ───────────────────
async function convertWithFfmpeg(inputFile: File, outputExt: string, br: string, sr: string): Promise<Blob> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()

  // 加载 FFmpeg（带进度回调）
  progressText.value = '正在加载 FFmpeg（首次使用需下载 ~25MB）...'
  try {
    await ffmpeg.load()
  } catch (e) {
    throw new Error('FFmpeg 加载失败，请检查网络连接')
  }

  const inputName = 'input.' + inputFile.name.split('.').pop()
  const outputName = 'output.' + outputExt

  await ffmpeg.writeFile(inputName, await fetchFile(inputFile))

  const args = ['-i', inputName]
  if (sr) args.push('-ar', sr)
  if (outputExt === 'mp3') {
    args.push('-codec:a', 'libmp3lame', '-b:a', br)
  } else if (outputExt === 'ogg') {
    args.push('-codec:a', 'libvorbis', '-q:a', '4')
  } else if (outputExt === 'aac') {
    args.push('-codec:a', 'aac', '-b:a', br)
  } else if (outputExt === 'flac') {
    args.push('-codec:a', 'flac')
  } else {
    args.push('-codec:a', 'pcm_s16le')
  }
  args.push('-y', outputName)

  await ffmpeg.exec(args)
  const data = await ffmpeg.readFile(outputName)
  // @ts-ignore - FFmpeg FileData 兼容性
  const blob = new Blob([data as BlobPart], { type: `audio/${outputExt}` })

  // 清理
  try { await ffmpeg.deleteFile(inputName) } catch {}
  try { await ffmpeg.deleteFile(outputName) } catch {}

  return blob
}

// ── 开始转换 ────────────────────────────────
async function startConvert() {
  if (files.value.length === 0) return

  converting.value = true
  completed.value = false
  convertProgress.value = 0
  convertedCount.value = 0
  hasError.value = false
  progressStatus.value = 'success'

  const total = files.value.length
  const outputExt = targetFormat.value

  for (let i = 0; i < total; i++) {
    const file = files.value[i]
    progressText.value = `正在转换: ${file.name}`
    convertProgress.value = Math.round((i / total) * 100)

    try {
      let blob: Blob
      const ext = outputExt

      if (ext === 'wav') {
        // WAV：使用 Web Audio API（轻量快速）
        const arrayBuffer = await file.arrayBuffer()
        const audioContext = new AudioContext()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        blob = audioBufferToWav(audioBuffer)
      } else {
        // 其他格式：使用 FFmpeg WASM
        blob = await convertWithFfmpeg(file, ext, bitrate.value, sampleRate.value)
      }

      const newName = file.name.replace(/\.[^.]+$/, '') + '.' + ext
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = newName
      a.click()
      URL.revokeObjectURL(objUrl)

      convertedCount.value++
    } catch (e: any) {
      console.error('转换失败:', file.name, e)
      hasError.value = true
      progressStatus.value = 'warning'
      message.error(`${file.name} 转换失败: ${String(e).substring(0, 60)}`)
    }

    // 每文件间隔，避免浏览器拦截批量下载
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 600))
    }
  }

  convertProgress.value = 100
  converting.value = false
  completed.value = true
  progressText.value = `完成 ${convertedCount.value}/${total}`

  if (hasError.value) {
    message.warning(`转换完成，${convertedCount.value}/${total} 成功`)
  } else {
    message.success(`全部转换完成！${convertedCount.value} 个文件`)
  }
}

function resetAll() {
  files.value = []
  convertProgress.value = 0
  completed.value = false
  convertedCount.value = 0
  hasError.value = false
  progressStatus.value = 'success'
}
</script>

<style lang="scss" scoped>
.converter-view { max-width: 900px; }

.drop-zone {
  border: 2px dashed $border-color;
  border-radius: $radius-lg;
  padding: $spacing-xxl;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  margin-bottom: $spacing-lg;

  &:hover, &.active {
    border-color: $primary-color;
    background: $primary-bg;
  }

  &.has-files { padding: $spacing-md; text-align: left; border-style: solid; border-color: $border-color; }

  .drop-hint {
    svg { margin-bottom: 16px; }
    p { font-size: 16px; color: $text-primary; margin-bottom: 8px; }
    span { font-size: 13px; color: $text-muted; }
  }
}

.file-list {
  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid $border-light;
    &:last-child { border-bottom: none; }

    .file-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { font-size: 12px; color: $text-muted; min-width: 60px; }
  }

  .add-more {
    padding: 10px 0;
    color: $primary-color;
    font-size: 13px;
    cursor: pointer;
    text-align: center;

    &:hover { text-decoration: underline; }
  }
}

.options-panel {
  margin-bottom: $spacing-lg;

  .option-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;

    &:last-child { margin-bottom: 0; }

    label {
      font-size: 13px;
      font-weight: 600;
      color: $text-secondary;
      min-width: 70px;
    }
  }

  .output-path-group {
    display: flex;
    flex: 1;
    gap: 8px;
  }
}

.action-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: $spacing-xl;
}

.progress-section {
  width: 100%;
  max-width: 520px;

  .progress-text {
    text-align: center;
    font-size: 13px;
    color: $text-secondary;
    margin-top: 4px;
  }
}
</style>
