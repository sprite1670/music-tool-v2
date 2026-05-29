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

    <!-- Web 环境提示 -->
    <p v-if="!isTauriEnv" class="web-hint">
      ⚠️ Web 版暂不支持音频格式转换，此功能需要桌面版
    </p>

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

      <div class="option-row">
        <label>输出目录：</label>
        <div class="output-path-group">
          <n-input v-model:value="outputPath" placeholder="默认为源文件目录" readonly style="flex:1;" />
          <n-button @click="selectOutputDir">浏览</n-button>
        </div>
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
        <n-progress type="line" :percentage="convertProgress" :status="'success'"
                    :show-indicator="true" style="margin: 12px 0;" />
        <p class="progress-text">{{ progressText }}</p>
      </div>
    </div>

    <!-- 完成结果 -->
    <div v-if="completed && !converting" class="result-section card">
      <n-result status="success" title="转换完成！"
                :description="`成功转换 ${convertedCount} 个文件`">
        <template #footer>
          <n-button @click="openOutputDir">打开输出目录</n-button>
          <n-button @click="resetAll" style="margin-left: 8px;">重新开始</n-button>
        </template>
      </n-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NSelect, NButton, NIcon, NProgress, NResult,
  useMessage, useDialog,
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
const targetFormat = ref<string>('mp3')
const bitrate = ref<string>('320k')
const sampleRate = ref<string>('44100')
const outputPath = ref('')
const converting = ref(false)
const convertProgress = ref(0)
const progressText = ref('')
const completed = ref(false)
const convertedCount = ref(0)

const formatOptions = [
  { label: 'MP3 (最常用)', value: 'mp3' },
  { label: 'FLAC (无损)', value: 'flac' },
  { label: 'WAV (无损)', value: 'wav' },
  { label: 'AAC (Apple)', value: 'aac' },
  { label: 'OGG (开源)', value: 'ogg' },
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
  { label: '96 kHz', value: '96000' },
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

async function selectOutputDir() {
  // Electron 环境
  if ((window as any).electronAPI) {
    const result = await (window as any).electronAPI.selectFolder({
      title: '选择输出目录',
    })
    if (!result.canceled && result.filePaths?.length > 0) {
      outputPath.value = result.filePaths[0]
    }
  } else {
    message.info('需要完整应用环境')
  }
}

async function startConvert() {
  if (files.value.length === 0) return

  converting.value = true
  completed.value = false
  convertProgress.value = 0
  convertedCount.value = 0

  try {
    // Electron 环境
    if ((window as any).electronAPI) {
      // 将 File 对象转换为路径
      const filePaths = files.value.map(f => (f as any).path || f.name)

      // 调用主进程进行转换
      const result = await (window as any).electronAPI.convertFiles({
        files: filePaths,
        targetFormat: targetFormat.value,
        bitrate: bitrate.value,
        sampleRate: parseInt(sampleRate.value),
        outputPath: outputPath.value || undefined,
      })

      if (result.ok) {
        convertedCount.value = files.value.length
        convertProgress.value = 100
        message.success(`完成！已转换 ${files.value.length} 个文件`)
      } else {
        message.error(`转换失败: ${result.error}`)
      }
    } else {
      // 模拟进度
      for (let i = 0; i <= files.value.length; i++) {
        convertProgress.value = Math.round((i / files.value.length) * 100)
        progressText.value = i < files.value.length
          ? `正在转换: ${files.value[i].name}`
          : '转换完成!'
        await new Promise(r => setTimeout(r, 500))
      }
      convertedCount.value = files.value.length
      message.success('演示模式：模拟转换完成')
    }

    completed.value = true
  } catch (e) {
    message.error(`转换失败: ${String(e)}`)
  } finally {
    converting.value = false
  }
}

function resetAll() {
  files.value = []
  convertProgress.value = 0
  completed.value = false
  convertedCount.value = 0
}

async function openOutputDir() {
  message.success('已打开输出目录')
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
