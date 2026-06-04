/**
 * 平台适配层 —— 统一 Tauri / Web 环境差异
 */

// ── 环境检测 ─────────────────────────────
export const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window || '__TAURI_METADATA__' in window)

const isDev = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV

// ── 统一 invoke（Tauri 环境才可用）──────────
export async function invoke<T = any>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri) {
    const { invoke: inv } = await import(/* @vite-ignore */ '@tauri-apps/api/core')
    return inv(cmd, args) as Promise<T>
  }
  throw new Error('TAURI_ONLY')
}

// ── API 请求统一入口 ────────────────────────
// 开发模式：走 Vite 代理
// 生产模式（Tauri）：用 Rust 后端 HTTP 代理绕过 CORS
async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // 开发模式：将完整 URL 转换为 Vite 代理路径
  if (isDev) {
    try {
      const u = new URL(url)
      const host = u.hostname
      let proxyPrefix = ''
      if (host.includes('music.163.com')) proxyPrefix = '/api/netease'
      else if (host.includes('u.y.qq.com')) proxyPrefix = '/api/qq'
      else if (host.includes('c.y.qq.com')) proxyPrefix = '/api/qq-lyric'
      else if (host.includes('songsearch.kugou.com')) proxyPrefix = '/api/kugou'
      else if (host.includes('lyrics.kugou.com')) proxyPrefix = '/api/lyrics'
      else if (host.includes('wwwapi.kugou.com')) proxyPrefix = '/api/kgwww'
      else if (host.includes('imjad.cn')) proxyPrefix = '/api/imjad'
      else if (host.includes('ytmusic')) proxyPrefix = '/api/ytmusic'

      if (proxyPrefix) {
        const proxyUrl = proxyPrefix + u.pathname + u.search
        return fetch(proxyUrl, options)
      }
    } catch {
      // URL 解析失败，降级为直接 fetch
    }
  }

  // Tauri 生产模式：用 Rust 后端 HTTP 代理绕过 CORS
  if (isTauri) {
    const hdrs: Record<string, string> = {}
    if (options?.headers) {
      const h = options.headers
      if (h instanceof Headers) {
        h.forEach((v, k) => { hdrs[k] = v })
      } else if (Array.isArray(h)) {
        h.forEach(([k, v]) => { hdrs[k] = v })
      } else {
        Object.entries(h).forEach(([k, v]) => { hdrs[k] = v })
      }
    }
    const resp = await invoke('http_request', {
      url,
      method: options?.method || 'GET',
      headers: hdrs,
      body: options?.body as string | undefined,
    })
    // 包装成 Response 对象
    return new Response(resp.body, { status: resp.status, headers: resp.headers })
  }

  // Web 环境：标准 fetch（可能受 CORS 限制）
  return fetch(url, options)
}

// ── 窗口控制 ──────────────────────────
export async function windowMinimize() {
  if (!isTauri) return
  try {
    const { getCurrentWindow } = await import(/* @vite-ignore */ '@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  } catch {}
}

export async function windowToggleMaximize() {
  if (!isTauri) return
  try {
    const { getCurrentWindow } = await import(/* @vite-ignore */ '@tauri-apps/api/window')
    await getCurrentWindow().toggleMaximize()
  } catch {}
}

export async function windowClose() {
  if (!isTauri) return
  try {
    const { getCurrentWindow } = await import(/* @vite-ignore */ '@tauri-apps/api/window')
    await getCurrentWindow().close()
  } catch {}
}

// ── 对话框 ──────────────────────────
export async function openFileDialog(_options: any = {}) {
  if (isTauri) {
    const { open } = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog')
    return await open(_options)
  }
  return null
}

export async function saveFileDialog(_options: any = {}) {
  if (isTauri) {
    const { save } = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog')
    return await save(_options)
  }
  return null
}

export async function selectFolderDialog(_options: any = {}) {
  if (isTauri) {
    const { open } = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog')
    return await open({ ..._options, directory: true })
  }
  return null
}

// ── API URL 构建 ─────────────────────────────
function apiUrl(
  type: 'netease' | 'qq' | 'qq-lyric' | 'kugou' | 'lyrics',
  path: string,
): string {
  if (isDev) {
    const proxy: Record<string, string> = {
      netease: '/api/netease',
      qq: '/api/qq',
      'qq-lyric': '/api/qq-lyric',
      kugou: '/api/kugou',
      lyrics: '/api/lyrics',
    }
    return proxy[type] + path
  }
  const base: Record<string, string> = {
    netease: 'https://music.163.com',
    qq: 'https://u.y.qq.com',
    'qq-lyric': 'https://c.y.qq.com',
    kugou: 'https://songsearch.kugou.com',
    lyrics: 'https://lyrics.kugou.com',
  }
  return base[type] + path
}

// ── 音乐搜索 ──────────────────────────
export async function searchMusic(keyword: string, _source: string): Promise<any[]> {
  return await desktopSearchMusic(keyword, _source)
}

// ── 桌面环境：访问第三方 API ────────────
async function desktopSearchMusic(keyword: string, source: string): Promise<any[]> {
  const results: any[] = []

  if (source === 'netease' || source === 'all') {
    try {
      const url = apiUrl('netease', `/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=20&offset=0`)
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://music.163.com/' } })
      const data = await safeJson(resp)
      const songs = data?.result?.songs || []
      results.push(...songs.map((s: any) => ({
        id: s.id.toString(),
        name: s.name,
        artists: s.artists?.map((a: any) => a.name) || ['未知艺术家'],
        album: s.album?.name || '未知专辑',
        duration: Math.round((s.duration || 0) / 1000),
        source: 'netease',
        cover_url: s.album?.picUrl || '',
        songmid: s.id.toString(),
      })))
    } catch (e) {
      console.warn('[Desktop] 网易云搜索失败', e)
    }
  }

  if (source === 'qq' || source === 'all') {
    try {
      const data = JSON.stringify({
        req_1: {
          method: 'DoSearchForQQMusicDesktop',
          module: 'music.search.SearchCgiService',
          param: {
            remoteplace: 'txt.mqq.all',
            searchid: '1',
            query: keyword,
            page_num: 1,
            num_per_page: 20,
          }
        }
      })
      const url = apiUrl('qq', `/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(data)}`)
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' } })
      const body = await safeJson(resp)
      const songs = body?.req_1?.data?.body?.song?.list || []
      results.push(...songs.map((s: any) => ({
        id: s.mid,
        name: s.name || s.title || '未知歌曲',
        artists: s.singer?.map((sg: any) => sg.name) || ['未知艺术家'],
        album: s.album?.name || '未知专辑',
        duration: s.interval || 0,
        source: 'qq',
        cover_url: s.album?.mid
          ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.album.mid}.jpg`
          : '',
        songmid: s.mid,
      })))
    } catch (e) {
      console.warn('[Desktop] QQ音乐搜索失败', e)
    }
  }

  if (source === 'kugou' || source === 'all') {
    try {
      const url = apiUrl('kugou', `/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20&platform=WebFilter`)
      const resp = await apiFetch(url)
      const data = await safeJson(resp)
      const songs = data?.data?.lists || []
      results.push(...songs.map((s: any) => ({
        id: s.FileHash,
        name: s.SongName || '未知歌曲',
        artists: [s.SingerName || '未知艺术家'],
        album: s.AlbumName || '未知专辑',
        duration: s.Duration || 0,
        source: 'kugou',
        cover_url: s.Image ? s.Image.replace('/{size}/', '/400/') : '',
        songmid: s.FileHash,
        albumId: s.AlbumID,
      })))
    } catch (e) {
      console.warn('[Desktop] 酷狗搜索失败', e)
    }
  }

  if (results.length === 0) {
    console.warn('[Desktop] 所有来源均无结果')
  }

  return results
}

// ── 获取歌词（多源聚合）────────────────
export async function getLyrics(
  songId: string,
  _source: string,
  songName?: string,
  albumId?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  return await desktopGetLyrics(songId, _source, songName, albumId)
}

// ── 桌面环境：多源歌词聚合 ────────────
async function desktopGetLyrics(
  songId: string,
  source: string,
  songName?: string,
  _albumId?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  const results: Array<{ lyric: string; translated: string; from: string }> = []

  // 网易云：需要有正确的 songId（数字 ID）
  if ((source === 'netease' || source === 'all') && songId && /^\d+$/.test(songId)) {
    try {
      const url = apiUrl('netease', `/api/song/lyric?id=${songId}&lv=-1&tv=-1`)
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://music.163.com/' } })
      const body = await safeJson(resp)
      if (body?.lrc?.lyric) {
        results.push({ from: '网易云', lyric: body.lrc.lyric, translated: body?.tlyric?.lyric || '' })
      }
    } catch (e) { console.warn('[Desktop] 网易云歌词失败', e) }
  }

  // QQ 音乐：按歌名搜索
  if ((source === 'qq' || source === 'all') && songName) {
    try {
      const searchData = JSON.stringify({
        req_1: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { remoteplace: 'txt.mqq.all', searchid: '1', query: songName, page_num: 1, num_per_page: 1 } }
      })
      const searchUrl = apiUrl('qq', `/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(searchData)}`)
      const searchResp = await apiFetch(searchUrl, { headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' } })
      const searchBody = await safeJson(searchResp)
      const qqSong = searchBody?.req_1?.data?.body?.song?.list?.[0]
      if (qqSong?.mid) {
        const lyricUrl = apiUrl('qq-lyric', `/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${qqSong.mid}&g_tk=5381&format=json&nobase64=1`)
        const lyricResp = await apiFetch(lyricUrl, { headers: { 'Referer': 'https://c.y.qq.com/', 'User-Agent': 'Mozilla/5.0' } })
        const lyricBody = await safeJson(lyricResp)
        if (lyricBody?.data?.lyric) {
          results.push({ from: 'QQ音乐', lyric: lyricBody.data.lyric, translated: lyricBody.data.trans || '' })
        }
      }
    } catch (e) { console.warn('[Desktop] QQ音乐歌词失败', e) }
  }

  // 酷狗：按歌名搜索
  if ((source === 'kugou' || source === 'all') && songName) {
    try {
      const searchUrl = apiUrl('kugou', `/song_search_v2?keyword=${encodeURIComponent(songName)}&page=1&pagesize=3&platform=WebFilter`)
      const searchResp = await apiFetch(searchUrl)
      const searchBody = await safeJson(searchResp)
      const kgSong = searchBody?.data?.lists?.[0]
      if (kgSong) {
        const lyricSearchUrl = apiUrl('lyrics', `/search?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&_=${Date.now()}`)
        const lyricSearchResp = await apiFetch(lyricSearchUrl, { headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' } })
        const lyricSearchBody = await safeJson(lyricSearchResp)
        const kc = lyricSearchBody?.candidates?.[0]
        if (kc) {
          const dlUrl = apiUrl('lyrics', `/download?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&id=${kc.id}&accesskey=${kc.accesskey}&encode=utf8&fmt=lrc`)
          const dlResp = await apiFetch(dlUrl, { headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' } })
          const dlBody = await safeJson(dlResp)
          if (dlBody?.content) {
            const lyric = base64ToUtf8(dlBody.content)
            results.push({ from: '酷狗', lyric, translated: '' })
          }
        }
      }
    } catch (e) { console.warn('[Desktop] 酷狗歌词失败', e) }
  }

  if (results.length > 0) {
    console.log('[lyrics] 结果来源:', results[0].from)
    return { lyric: results[0].lyric, translated: results[0].translated || '', from: results[0].from }
  }
  console.warn('[lyrics] 所有来源均无歌词结果')
  return { lyric: '', translated: '', from: '' }
}

// ── 写入文件（Tauri）或触发下载（Web）──
export async function writeFile(path: string, content: string): Promise<void> {
  if (isTauri) {
    return await invoke('write_file', { path, content })
  }
  downloadBlob(content, path.split('/').pop() || 'download.txt')
}

// ── 触发浏览器下载 ─────────────────────
export function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Base64 解码（支持 UTF-8 中文）────────────────
function base64ToUtf8(base64: string): string {
  const binStr = atob(base64)
  const bytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// ── 安全 JSON 解析 ────────────────────────
async function safeJson(resp: Response): Promise<any> {
  const text = await resp.text()
  try {
    return JSON.parse(text)
  } catch {
    console.warn('[safeJson] 响应不是 JSON:', text.substring(0, 200))
    return null
  }
}

// ── 为本地歌曲加载歌词 ────────────────
export async function loadLyricsForLocal(
  songName: string,
  artist?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  const keyword = artist ? `${songName} ${artist}` : songName
  // 本地歌曲没有有效 songId，只走 QQ 和酷狗（按歌名搜索）
  // 先尝试 netease（如果歌名能搜到）
  return await getLyrics('', 'all', keyword)
}
