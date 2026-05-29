<template>
  <div class="download-view">
    <h1 class="page-title"><span class="icon">⬇️</span> 下载管理</h1>

    <!-- 下载设置 -->
    <div class="dl-settings card">
      <div class="setting-row">
        <label>默认品质：</label>
        <n-select v-model:value="defaultQuality" :options="qualityOptions" style="width:160px;" />
      </div>
      <div class="setting-row">
        <label>保存路径：</label>
        <div class="path-row">
          <n-input :value="downloadDir" readonly style="flex:1;" />
          <n-button @click="selectDir">选择目录</n-button>
        </div>
      </div>
    </div>

    <!-- 音频格式转换 -->
    <div class="section-header" style="margin-top:28px;">
      <h2>音频格式转换</h2>
    </div>
    <div class="convert-card card" style="margin-bottom:24px; padding:20px;">
      <div class="convert-row" style="display:flex; gap:12px; align-items:center;">
        <n-input readonly :value="convertFile || '未选择文件'" style="flex:1;" placeholder="选择要转换的音频文件" />
        <n-button @click="selectConvertFile">选择文件</n-button>
      </div>
      <div class="convert-row" style="display:flex; gap:12px; align-items:center; margin-top:12px;">
        <label style="font-size:13px; color:var(--text-secondary); min-width:70px;">目标格式：</label>
        <n-select v-model:value="convertFormat" :options="convertFormatOptions" style="width:160px;" />
        <n-button type="primary" :loading="converting" @click="startConvert" :disabled="!convertFile">
          开始转换
        </n-button>
      </div>
      <div v-if="convertResult" style="margin-top:12px;">
        <n-tag :type="convertResult.success ? 'success' : 'error'">
          {{ convertResult.message }}
        </n-tag>
      </div>
    </div>

    <!-- 当前下载列表 -->
    <div class="section-header">
      <h2>下载队列</h2>
      <n-button v-if="activeDownloads.length > 0" size="small" quaternary type="error"
                @click="clearCompleted">
        清除已完成
      </n-button>
    </div>

    <!-- 活跃下载 -->
    <div v-if="activeDownloads.length > 0" class="dl-list">
      <div v-for="(item, idx) in activeDownloads" :key="item.id" class="dl-item card">
        <div class="dl-info">
          <div class="dl-name">{{ item.name }}</div>
          <div class="dl-sub">{{ item.artist }} · {{ item.quality }} · {{ formatSize(item.downloaded) }}/{{ formatSize(item.total) }}</div>
        </div>
        <n-progress
          type="line"
          :percentage="item.percent"
          :indicator-placement="'inside'"
          :processing="item.status === 'downloading'"
          :status="item.status === 'error' ? 'error' : (item.status === 'done' ? 'success' : 'default')"
          style="width:200px;"
        />
        <div class="dl-actions">
          <n-button v-if="item.status === 'downloading'" size="tiny" quaternary type="error"
                    @click="cancelDownload(idx)">
            取消
          </n-button>
          <n-button v-if="item.status === 'done'" size="tiny" quaternary type="primary"
                    @click="openFile(item)">
            打开
          </n-button>
          <n-button v-if="item.status === 'error'" size="tiny" quaternary
                    @click="retryDownload(idx)">
            重试
          </n-button>
        </div>
      </div>
    </div>

    <div v-else-if="hasHistory" class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-text">所有下载已完成</div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📥</div>
      <div class="empty-text">暂无下载任务</div>
      <div class="empty-hint">在搜索页面点击歌曲的"下载"按钮开始下载</div>
    </div>

    <!-- 下载历史 -->
    <div v-if="historyList.length > 0" class="section-header" style="margin-top: var(--spacing-xl);">
      <h2>下载历史</h2>
    </div>

    <div v-if="historyList.length > 0" class="dl-list history-list">
      <div v-for="(item, idx) in historyList" :key="'hist-' + idx" class="dl-item card compact">
        <div class="dl-info">
          <div class="dl-name">{{ item.name }}</div>
          <div class="dl-sub">{{ item.artist }} · {{ item.time }}</div>
        </div>
        <div class="dl-actions">
          <n-button size="tiny" quaternary @click="openFile(item)">打开</n-button>
          <n-button size="tiny" quaternary type="error" @click="removeHistory(idx)">删除</n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NSelect, NButton, NProgress, useMessage, NTag } from 'naive-ui'
import { selectFolderDialog } from '@/services/platform'

const message = useMessage()

const defaultQuality = ref('320k')
const downloadDir = ref('')
const hasHistory = ref(false)

// 格式转换相关
const convertFile = ref('')
const convertFormat = ref('mp3')
const converting = ref(false)
const convertResult = ref<{ success: boolean; message: string } | null>(null)
const convertFormatOptions = [
  { label: 'MP3', value: 'mp3' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' },
  { label: 'AAC', value: 'aac' },
  { label: 'OGG', value: 'ogg' },
]

interface DownloadItem {
  id: string
  name: string
  artist: string
  quality: string
  total: number
  downloaded: number
  percent: number
  status: 'downloading' | 'done' | 'error'
  filePath?: string
}

// 模拟数据
const activeDownloads = ref<DownloadItem[]>([
  {
    id: '1', name: '晴天', artist: '周杰伦', quality: 'flac',
    total: 30 * 1024 * 1024, downloaded: 15 * 1024 * 1024,
    percent: 50, status: 'downloading',
  },
])
const historyList = ref<any[]>([
  { name: '稻香', artist: '周杰伦', time: '2026-05-25 14:30', path: '' },
  { name: 'Love Story', artist: 'Taylor Swift', time: '2026-05-24 09:15', path: '' },
])

const qualityOptions = [
  { label: '标准品质 (128k)', value: '128k' },
  { label: '高品质 (320k)', value: '320k' },
  { label: '无损 FLAC', value: 'flac' },
]

async function selectDir() {
  try {
    const result = await selectFolderDialog({ title: '选择下载目录' })
    if (result) {
      downloadDir.value = Array.isArray(result) ? result[0] : result
    }
  } catch (e: any) {
    if (e.message !== 'TAURI_ONLY') {
      console.warn('选择目录失败', e)
    }
  }
}

// 选择要转换的文件
function selectConvertFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp3,.flac,.wav,.aac,.m4a,.ogg,.wma,.ape'
  input.onchange = (e: any) => {
    if (e.target?.files?.[0]) {
      convertFile.value = e.target.files[0].name
    }
  }
  input.click()
}

// 开始格式转换
async function startConvert() {
  if (!convertFile.value) return
  converting.value = true
  convertResult.value = null
  try {
    // Web 环境：演示模式
    await new Promise(r => setTimeout(r, 1500))
    convertResult.value = {
      success: true,
      message: `已转换：${convertFile.value} → ${convertFile.value.replace(/\.[^.]+$/, '')}.${convertFormat.value}`,
    }
    message.success('转换完成！（演示模式）')
  } catch (e: any) {
    convertResult.value = { success: false, message: String(e) }
  } finally {
    converting.value = false
  }
}

function clearCompleted() {
  message.success('已清除')
}
function cancelDownload(idx: number) {
  activeDownloads.value.splice(idx, 1)
  message.info('已取消')
}
function retryDownload(idx: number) {
  const item = activeDownloads.value[idx]
  item.status = 'downloading'
  item.percent = 0
  item.downloaded = 0
  message.info(`重新开始: ${item.name}`)
}
function openFile(item: any) { message.success(`打开: ${item.path || item.name}`) }
function removeHistory(idx: number) { historyList.value.splice(idx, 1) }

function formatSize(b: number): string {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
</script>

<style lang="scss" scoped>
.download-view { max-width: 960px; }

.dl-settings {
  margin-bottom: var(--spacing-lg);
  .setting-row {
    display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
    &:last-child { margin-bottom: 0; }
    label { font-size: 13px; font-weight: 600; color: var(--text-secondary); min-width: 70px; }
    .path-row { display: flex; flex: 1; gap: 8px; }
  }
}

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--spacing-md);
  h2 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
}

.dl-list {
  display: flex; flex-direction: column; gap: 10px;
}

.dl-item {
  display: flex; align-items: center; gap: 20px; padding: 14px 18px;
  transition: box-shadow 0.2s;
  &.compact { padding: 10px 16px; }
  &:hover { box-shadow: var(--shadow-md); }
  .dl-info { flex: 1; min-width: 0;
    .dl-name { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dl-sub { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
  }
  .dl-actions { display: flex; gap: 6px; flex-shrink: 0; }
}

.history-list .dl-item .dl-sub { color: var(--text-secondary); }

.convert-card {
  /* 已内联样式，此处留空 */
}
</style>
