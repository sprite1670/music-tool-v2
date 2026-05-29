/**
 * 平台适配层 —— 统一 Tauri / Web 环境差异
 */

// ── 环境检测（同步）──────────────────────
export const isTauri = (typeof window !== 'undefined') &&
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

// ── 统一 invoke（自动降级）────────────────
export async function invoke<T = any>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri) {
    const { invoke: inv } = await import(/* @vite-ignore */ '@tauri-apps/api/core')
    return inv(cmd, args) as Promise<T>
  }
  throw new Error('TAURI_ONLY')
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

// ── 音乐搜索 ──────────────────────────
export async function searchMusic(keyword: string, _source: string): Promise<any[]> {
  if (isTauri) {
    return await invoke<any[]>('search_music', { keyword, source: _source })
  }
  return await webSearchMusic(keyword, _source)
}

// ── Web 环境：多源搜索 ────────────────
async function webSearchMusic(keyword: string, source: string): Promise<any[]> {
  const results: any[] = []

  // 网易云音乐
  if (source === 'netease' || source === 'all') {
    try {
      const resp = await fetch(
        `/api/netease/search?s=${encodeURIComponent(keyword)}&limit=20&offset=0&type=1`
      )
      const data = await resp.json()
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
      console.warn('[Web] 网易云搜索失败', e)
    }
  }

  // QQ 音乐
  if (source === 'qq' || source === 'all') {
    try {
      const resp = await fetch(
        `/api/qq/search?w=${encodeURIComponent(keyword)}&n=20&p=1`
      )
      const data = await resp.json()
      const songs = data?.req_1?.data?.body?.song?.list || []
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
      console.warn('[Web] QQ音乐搜索失败', e)
    }
  }

  // 酷狗音乐
  if (source === 'kugou' || source === 'all') {
    try {
      const resp = await fetch(
        `/api/kugou/search?keyword=${encodeURIComponent(keyword)}&pagesize=20&page=1`
      )
      const data = await resp.json()
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
      console.warn('[Web] 酷狗搜索失败', e)
    }
  }

  if (results.length === 0) {
    console.warn('[Web] 所有来源均无结果，使用 Mock 数据')
    return mockSearch(keyword)
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
  if (isTauri) {
    return await invoke<{ lyric: string; translated?: string; from?: string }>(
      'get_lyrics',
      { songId, source: _source, songName, albumId }
    )
  }
  // Web 环境：调用多源聚合接口
  return await webGetLyrics(songId, _source, songName, albumId)
}

// ── Web 环境：多源歌词聚合 ─────────────
async function webGetLyrics(
  songId: string,
  source: string,
  songName?: string,
  albumId?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  try {
    const params = new URLSearchParams()
    if (source === 'netease' && songId) params.set('id', songId)
    if (source === 'qq' && songId) params.set('songmid', songId)
    if (songName) params.set('keyword', songName)
    if (albumId) params.set('album_id', albumId)

    // 优先调用聚合接口（并行查网易云+QQ+酷狗）
    const resp = await fetch(`/api/lyric/aggregate?${params.toString()}`)
    const data = await resp.json()
    if (data?.lyric) {
      return {
        lyric: data.lyric,
        translated: data.translated || '',
        from: data.from || 'unknown',
      }
    }

    // 降级：单独查网易云
    if (source === 'netease' && songId) {
      const r = await fetch(`/api/netease/lyric?id=${encodeURIComponent(songId)}`)
      const d = await r.json()
      if (d?.lrc?.lyric) {
        return {
          lyric: d.lrc.lyric,
          translated: d.tlyric?.lyric || '',
          from: 'netease',
        }
      }
    }

    // 降级：单独查QQ音乐
    if (songId) {
      const r = await fetch(`/api/qq/lyric?songmid=${encodeURIComponent(songId)}`)
      const d = await r.json()
      if (d?.lyric) {
        return {
          lyric: d.lyric,
          translated: d.trans || '',
          from: 'qq',
        }
      }
    }

    return { lyric: '', translated: '', from: '' }
  } catch (e) {
    console.warn('[Web] 歌词获取失败', e)
    return { lyric: '', translated: '', from: '' }
  }
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

// ── 下载歌曲（Web 环境）────────────────
// 注意：用户要求下载歌曲时不自动下载歌词，歌词需手动点击下载
export async function downloadSong(
  song: any,
): Promise<{ ok: boolean; songUrl: string }> {
  if (isTauri) {
    return await invoke<{ ok: boolean; songUrl: string }>('download_song', { song })
  }

  const source = song.source || 'netease'
  const songId = song.songmid || song.id || ''
  let songUrl = ''

  // 1. 获取歌曲播放链接
  try {
    if (source === 'netease') {
      const resp = await fetch(`/api/netease/song/url?id=${encodeURIComponent(songId)}`)
      const data = await resp.json()
      songUrl = data?.data?.[0]?.url || ''
    } else if (source === 'qq') {
      const resp = await fetch(`/api/qq/song/url?songmid=${encodeURIComponent(songId)}`)
      const data = await resp.json()
      songUrl = data?.url || ''
    }
  } catch (e) { console.warn('[downloadSong] 获取链接失败', e) }

  if (!songUrl) {
    return { ok: false, songUrl: '' }
  }

  // 2. 通过代理下载（绕过 CORS + 跟随 302 重定向）
  try {
    const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(songUrl)}`
    const resp = await fetch(proxyUrl)
    if (!resp.ok) throw new Error(`代理下载失败 ${resp.status}`)
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    const ext = songUrl.includes('.flac') ? 'flac' : 'mp3'
    a.download = `${song.name} - ${(song.artists || []).join(', ')}.${ext}`
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(objUrl)
  } catch (e) { console.warn('[downloadSong] 下载失败', e) }

  return { ok: true, songUrl }
}

// ── 为本地歌曲加载歌词 ────────────────
export async function loadLyricsForLocal(
  songName: string,
  artist?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  const keyword = artist ? `${songName} ${artist}` : songName
  return await getLyrics('', 'all', keyword)
}

// ── Mock 数据（降级用）────────────────
function mockSearch(keyword: string): any[] {
  return [
    { id: '001', name: `${keyword} - 一路向北`, artists: ['周杰伦'], album: '十一月的萧邦', duration: 234, source: 'netease', cover_url: '' },
    { id: '002', name: `${keyword} - 晴天`, artists: ['周杰伦'], album: '叶惠美', duration: 269, source: 'netease', cover_url: '' },
    { id: '003', name: `${keyword} - 七里香`, artists: ['周杰伦'], album: '七里香', duration: 296, source: 'qq', cover_url: '', songmid: '003' },
    { id: '004', name: `${keyword} - 稻香`, artists: ['周杰伦'], album: '魔杰座', duration: 234, source: 'qq', cover_url: '', songmid: '004' },
  ]
}
