/**
 * 最近操作记录 —— localStorage 封装
 * 供各视图调用，首页读取展示
 */

const STORAGE_KEY = 'music-tool-recent'
const MAX_RECENT = 20

export interface RecentItem {
  name: string
  artists: string[]
  cover?: string
  action: string   // '搜索' | '编辑元数据' | '格式转换' | '下载歌词'
  time: number  // Date.now()
}

export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addRecent(item: Omit<RecentItem, 'time'>) {
  const list = getRecent()
  // 去重（同 name + action）
  const idx = list.findIndex(
    (x) => x.name === item.name && x.action === item.action
  )
  if (idx !== -1) list.splice(idx, 1)

  list.unshift({ ...item, time: Date.now() })
  if (list.length > MAX_RECENT) list.length = MAX_RECENT

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {}
}

export function clearRecent() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
