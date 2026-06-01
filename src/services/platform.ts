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

// ── 统一 HTTP fetch（桌面版用 tauri-plugin-http 绕过 CORS）──
async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  if (isTauri) {
    const { fetch: tauriFetch } = await import(/* @vite-ignore */ '@tauri-apps/plugin-http')
    return tauriFetch(url, options)
  }
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

// ── 音乐搜索 ──────────────────────────
export async function searchMusic(keyword: string, _source: string): Promise<any[]> {
  if (isTauri) {
    return await desktopSearchMusic(keyword, _source)
  }
  return await webSearchMusic(keyword, _source)
}

// ── 桌面环境：直接访问第三方 API（绕过 CORS）──
async function desktopSearchMusic(keyword: string, source: string): Promise<any[]> {
  const results: any[] = []

  if (source === 'netease' || source === 'all') {
    try {
      const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=20&offset=0`
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://music.163.com/' } })
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
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(data)}`
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' } })
      const body = await resp.json()
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
      const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20&platform=WebFilter`
      const resp = await apiFetch(url)
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
      console.warn('[Desktop] 酷狗搜索失败', e)
    }
  }

  if (results.length === 0) {
    return mockSearch(keyword)
  }

  return results
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
    return await desktopGetLyrics(songId, _source, songName, albumId)
  }
  // Web 环境：调用多源聚合接口
  return await webGetLyrics(songId, _source, songName, albumId)
}

// ── 桌面环境：多源歌词聚合 ─────────────
async function desktopGetLyrics(
  songId: string,
  source: string,
  songName?: string,
  _albumId?: string,
): Promise<{ lyric: string; translated?: string; from?: string }> {
  const results: any[] = []

  if (source === 'netease' || source === 'all') {
    try {
      const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=-1&tv=-1`
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://music.163.com/' } })
      const body = await resp.json()
      if (body?.lrc?.lyric) {
        results.push({ source: '网易云', lyric: body.lrc.lyric, translated: body?.tlyric?.lyric || '' })
      }
    } catch (e) { console.warn('[Desktop] 网易云歌词失败', e) }
  }

  if (source === 'qq' || source === 'all') {
    try {
      const searchData = JSON.stringify({
        req_1: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { remoteplace: 'txt.mqq.all', searchid: '1', query: songName || '', page_num: 1, num_per_page: 1 } }
      })
      const searchUrl = `https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(searchData)}`
      const searchResp = await apiFetch(searchUrl, { headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' } })
      const searchBody = await searchResp.json()
      const qqSong = searchBody?.req_1?.data?.body?.song?.list?.[0]
      if (qqSong?.mid) {
        const lyricUrl = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${qqSong.mid}&g_tk=5381&format=json&nobase64=1`
        const lyricResp = await apiFetch(lyricUrl, { headers: { 'Referer': 'https://c.y.qq.com/', 'User-Agent': 'Mozilla/5.0' } })
        const lyricBody = await lyricResp.json()
        if (lyricBody?.data?.lyric) {
          results.push({ source: 'QQ音乐', lyric: lyricBody.data.lyric, translated: lyricBody.data.trans || '' })
        }
      }
    } catch (e) { console.warn('[Desktop] QQ音乐歌词失败', e) }
  }

  if ((source === 'kugou' || source === 'all') && songName) {
    try {
      const searchUrl = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(songName)}&page=1&pagesize=3&platform=WebFilter`
      const searchResp = await apiFetch(searchUrl)
      const searchBody = await searchResp.json()
      const kgSong = searchBody?.data?.lists?.[0]
      if (kgSong) {
        const lyricSearchUrl = `https://lyrics.kugou.com/search?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&_=${Date.now()}`
        const lyricSearchResp = await apiFetch(lyricSearchUrl, { headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' } })
        const lyricSearchBody = await lyricSearchResp.json()
        const kc = lyricSearchBody?.candidates?.[0]
        if (kc) {
          const dlUrl = `https://lyrics.kugou.com/download?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&id=${kc.id}&accesskey=${kc.accesskey}&encode=utf8&fmt=lrc`
          const dlResp = await apiFetch(dlUrl, { headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' } })
          const dlBody = await dlResp.json()
          if (dlBody?.content) {
            const lyric = atob(dlBody.content)
            results.push({ source: '酷狗', lyric, translated: '' })
          }
        }
      }
    } catch (e) { console.warn('[Desktop] 酷狗歌词失败', e) }
  }

  const best = results[0] || { lyric: '', translated: '', from: '' }
  return { lyric: best.lyric, translated: best.translated || '', from: best.source }
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

// ── 下载歌曲 ──────────────────────────
// 注意：用户要求下载歌曲时不自动下载歌词，歌词需手动点击下载
export async function downloadSong(
  song: any,
): Promise<{ ok: boolean; songUrl: string }> {
  if (isTauri) {
    return await desktopDownloadSong(song)
  }
  return await webDownloadSong(song)
}

// ── 桌面环境：直接下载 ─────────────────
async function desktopDownloadSong(song: any): Promise<{ ok: boolean; songUrl: string }> {
  const source = song.source || 'netease'
  const songId = song.songmid || song.id || ''
  let songUrl = ''

  try {
    if (source === 'netease') {
      const url = `https://music.163.com/api/song/enhance/player/url?id=${songId}&quality=320`
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://music.163.com/' } })
      const data = await resp.json()
      songUrl = data?.data?.[0]?.url || ''
    } else if (source === 'qq') {
      const data = JSON.stringify({
        req_1: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: { guid: '1234567890', songmid: [songId], songtype: [0], uin: '0', loginflag: 1, platform: '20' }
        }
      })
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(data)}`
      const resp = await apiFetch(url, { headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' } })
      const body = await resp.json()
      const purl = body?.req_1?.data?.midurlinfo?.[0]?.purl || ''
      if (purl) {
        const domain = body?.req_1?.data?.sip?.[0] || 'https://isure.stream.qqmusic.qq.com/'
        songUrl = domain + purl
      }
    }
  } catch (e) { console.warn('[Desktop] 获取歌曲链接失败', e) }

  if (!songUrl) {
    return { ok: false, songUrl: '' }
  }

  try {
    const resp = await apiFetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(songUrl).origin,
        'Accept': '*/*',
      }
    })
    if (!resp.ok) throw new Error(`下载失败 ${resp.status}`)
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    const ext = songUrl.includes('.flac') ? 'flac' : 'mp3'
    a.download = `${song.name} - ${(song.artists || []).join(', ')}.${ext}`
    a.click()
    URL.revokeObjectURL(objUrl)
  } catch (e) { console.warn('[Desktop] 下载失败', e) }

  return { ok: true, songUrl }
}

// ── Web 环境：下载歌曲 ─────────────────
async function webDownloadSong(song: any): Promise<{ ok: boolean; songUrl: string }> {
  const source = song.source || 'netease'
  const songId = song.songmid || song.id || ''
  let songUrl = ''

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
