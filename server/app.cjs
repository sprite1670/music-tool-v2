const express = require('express')
const path = require('path')
const axios = require('axios')
const { Buffer } = require('buffer')
const http = require('http')
const https = require('https')

const PORT = 8080
const app = express()
app.use(require('cors')())
app.use(express.json())

// ── 通用 GET 封装（axios）──────────────
function get(url, opts = {}) {
  return axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json,text/plain,*/*',
      ...opts.headers,
    },
    timeout: 10000,
    responseType: opts.responseType || 'json',
    maxRedirects: opts.maxRedirects !== undefined ? opts.maxRedirects : 5,
  })
}

// ── 网易云搜索 ─────────────────────
app.get('/api/netease/search', async (req, res) => {
  try {
    const keyword = req.query.s || req.query.keyword || ''
    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0
    const type = parseInt(req.query.type) || 1
    const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=${type}&limit=${limit}&offset=${offset}`
    const { data } = await get(url, { headers: { 'Referer': 'https://music.163.com/' } })
    res.json(data)
  } catch (e) {
    console.error('[netease/search]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── 网易云歌词 ─────────────────────
app.get('/api/netease/lyric', async (req, res) => {
  try {
    const id = req.query.id || ''
    const url = `https://music.163.com/api/song/lyric?id=${id}&lv=-1&tv=-1`
    const { data } = await get(url, { headers: { 'Referer': 'https://music.163.com/' } })
    res.json(data)
  } catch (e) {
    console.error('[netease/lyric]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── 网易云歌曲链接 ───────────────────
app.get('/api/netease/song/url', async (req, res) => {
  try {
    const id = req.query.id || ''
    if (!id) return res.json({ code: 400, message: '缺少 id 参数' })
    // 使用官方 API 获取真实播放链接
    const url = `https://music.163.com/api/song/enhance/player/url?id=${id}&quality=320`
    const { data } = await get(url, { headers: { 'Referer': 'https://music.163.com/' } })
    res.json(data)
  } catch (e) {
    console.error('[netease/song/url]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── 网易云歌曲详情 ───────────────────
app.get('/api/netease/song/detail', async (req, res) => {
  try {
    const ids = req.query.ids || ''
    const url = `https://music.163.com/api/v3/song/detail?id=${ids}&ids=${ids}`
    const { data } = await get(url, { headers: { 'Referer': 'https://music.163.com/' } })
    res.json(data)
  } catch (e) {
    console.error('[netease/detail]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── QQ音乐搜索 ──────────────────────
app.get('/api/qq/search', async (req, res) => {
  try {
    const query = req.query.w || req.query.keyword || ''
    const num = parseInt(req.query.n) || parseInt(req.query.limit) || 20
    const page = parseInt(req.query.p) || 1
    const data = JSON.stringify({
      req_1: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'music.search.SearchCgiService',
        param: {
          remoteplace: 'txt.mqq.all',
          searchid: String(page),
          query,
          page_num: page,
          num_per_page: num,
        }
      }
    })
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(data)}`
    const { data: body } = await get(url, {
      headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' }
    })
    res.json(body)
  } catch (e) {
    console.error('[qq/search]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── QQ音乐歌词 ──────────────────────
app.get('/api/qq/lyric', async (req, res) => {
  try {
    const songmid = req.query.songmid || req.query.id || ''
    if (!songmid) return res.json({ lyric: '', trans: '' })
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&format=json&nobase64=1`
    const { data: body } = await get(url, {
      headers: { 'Referer': 'https://c.y.qq.com/', 'User-Agent': 'Mozilla/5.0' }
    })
    const lyric = body?.data?.lyric || ''
    const trans = body?.data?.trans || ''
    res.json({ lyric, trans })
  } catch (e) {
    console.error('[qq/lyric]', e.message)
    res.json({ lyric: '', trans: '' })
  }
})

// ── QQ音乐歌曲链接 ───────────────────
app.get('/api/qq/song/url', async (req, res) => {
  try {
    const songmid = req.query.songmid || req.query.id || ''
    if (!songmid) return res.json({ url: '' })
    const data = JSON.stringify({
      req_1: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: { guid: '1234567890', songmid: [songmid], songtype: [0], uin: '0', loginflag: 1, platform: '20' }
      }
    })
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(data)}`
    const { data: body } = await get(url, {
      headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' }
    })
    const purl = body?.req_1?.data?.midurlinfo?.[0]?.purl || ''
    if (purl) {
      const domain = body?.req_1?.data?.sip?.[0] || 'https://isure.stream.qqmusic.qq.com/'
      res.json({ url: domain + purl })
    } else {
      res.json({ url: '' })
    }
  } catch (e) {
    console.error('[qq/song/url]', e.message)
    res.json({ url: '' })
  }
})

// ── 酷狗搜索 ────────────────────────
app.get('/api/kugou/search', async (req, res) => {
  try {
    const keyword = req.query.keyword || ''
    const pagesize = parseInt(req.query.pagesize) || 20
    const page = parseInt(req.query.page) || 1
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${pagesize}&platform=WebFilter`
    const { data } = await get(url)
    res.json(data)
  } catch (e) {
    console.error('[kugou/search]', e.message)
    res.status(500).json({ error: String(e) })
  }
})

// ── 酷狗歌词 ────────────────────────
app.get('/api/kugou/lyric', async (req, res) => {
  try {
    const keyword = req.query.keyword || ''
    if (!keyword) return res.json({ lyric: '' })
    // 1. 搜索歌曲获取 hash 和 album_id
    const searchUrl = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=3&platform=WebFilter`
    const { data: searchData } = await get(searchUrl)
    const songs = searchData?.data?.lists || []
    if (songs.length === 0) return res.json({ lyric: '' })
    const s = songs[0]
    const hash = s.FileHash, album_id = s.AlbumID || ''
    // 2. 获取歌词候选
    const lyricSearchUrl = `https://lyrics.kugou.com/search?ver=1&hash=${hash}&album_id=${album_id}&_=${Date.now()}`
    const { data: lyricSearch } = await get(lyricSearchUrl, {
      headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' }
    })
    const candidates = lyricSearch?.candidates || []
    if (candidates.length === 0) return res.json({ lyric: '' })
    const c = candidates[0]
    // 3. 下载歌词内容
    const dlUrl = `https://lyrics.kugou.com/download?ver=1&hash=${hash}&album_id=${album_id}&id=${c.id}&accesskey=${c.accesskey}&encode=utf8&fmt=lrc`
    const { data: lrcData } = await get(dlUrl, {
      headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' }
    })
    const lyric = lrcData?.content ? Buffer.from(lrcData.content, 'base64').toString('utf8') : ''
    res.json({ lyric })
  } catch (e) {
    console.error('[kugou/lyric]', e.message)
    res.json({ lyric: '' })
  }
})

// ── 多源歌词聚合 ────────────────────
app.get('/api/lyric/aggregate', async (req, res) => {
  const id = req.query.id || ''
  const source = req.query.source || 'netease'
  const keyword = req.query.keyword || ''
  let results = []
  try {
    // 1. 网易云
    if (source === 'netease' || source === 'all') {
      try {
        const { data: body } = await get(`https://music.163.com/api/song/lyric?id=${id}&lv=-1&tv=-1`, {
          headers: { 'Referer': 'https://music.163.com/' }
        })
        if (body?.lrc?.lyric) results.push({ source: '网易云', lyric: body.lrc.lyric, translated: body?.tlyric?.lyric || '' })
      } catch (e) { console.warn('[agg] 网易云歌词失败', e.message) }
    }
    // 2. QQ音乐
    if (source === 'qq' || source === 'all') {
      try {
        const qqSearchData = JSON.stringify({
          req_1: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { remoteplace: 'txt.mqq.all', searchid: '1', query: keyword, page_num: 1, num_per_page: 1 } }
        })
        const { data: qqSearch } = await get(`https://u.y.qq.com/cgi-bin/musicu.fcg?_=1&g_tk=5381&loginUin=0&hostUin=0&format=json&data=${encodeURIComponent(qqSearchData)}`, {
          headers: { 'Referer': 'https://y.qq.com/', 'Origin': 'https://y.qq.com/' }
        })
        const qqSong = qqSearch?.req_1?.data?.body?.song?.list?.[0]
        if (qqSong?.mid) {
          const { data: qqLyricBody } = await get(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${qqSong.mid}&g_tk=5381&format=json&nobase64=1`, {
            headers: { 'Referer': 'https://c.y.qq.com/', 'User-Agent': 'Mozilla/5.0' }
          })
          if (qqLyricBody?.data?.lyric) {
            results.push({ source: 'QQ音乐', lyric: qqLyricBody.data.lyric, translated: qqLyricBody.data.trans || '' })
          }
        }
      } catch (e) { console.warn('[agg] QQ音乐歌词失败', e.message) }
    }
    // 3. 酷狗
    if ((source === 'kugou' || source === 'all') && keyword) {
      try {
        const { data: kgSearch } = await get(`https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=3&platform=WebFilter`)
        const kgSong = kgSearch?.data?.lists?.[0]
        if (kgSong) {
          const kgLyricUrl = `https://lyrics.kugou.com/search?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&_=${Date.now()}`
          const { data: kgLyricData } = await get(kgLyricUrl, {
            headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' }
          })
          const kc = kgLyricData?.candidates?.[0]
          if (kc) {
            const dlUrl = `https://lyrics.kugou.com/download?ver=1&hash=${kgSong.FileHash}&album_id=${kgSong.AlbumID || ''}&id=${kc.id}&accesskey=${kc.accesskey}&encode=utf8&fmt=lrc`
            const { data: kgLrc } = await get(dlUrl, {
              headers: { 'Referer': 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0' }
            })
            if (kgLrc?.content) {
              results.push({ source: '酷狗', lyric: Buffer.from(kgLrc.content, 'base64').toString('utf8'), translated: '' })
            }
          }
        }
      } catch (e) { console.warn('[agg] 酷狗歌词失败', e.message) }
    }
    const best = results[0] || { lyric: '', translated: '', from: '' }
    res.json({ lyric: best.lyric, translated: best.translated || '', from: best.source, all: results })
  } catch (e) {
    console.error('[lyric/aggregate]', e.message)
    res.json({ lyric: '', translated: '', from: '', all: [] })
  }
})

// ── 音频代理（解决 CORS + 跟随重定向）──
app.get('/api/proxy-audio', async (req, res) => {
  const audioUrl = req.query.url || ''
  if (!audioUrl || !audioUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }
  try {
    const response = await axios.get(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(audioUrl).origin,
        'Accept': '*/*',
      },
      timeout: 15000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
    })
    // 转发 Content-Type 和 Content-Length
    const contentType = response.headers['content-type'] || 'audio/mpeg'
    res.setHeader('Content-Type', contentType)
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length'])
    }
    // 禁用缓存（音频流可能很大）
    res.setHeader('Cache-Control', 'no-cache')
    res.send(response.data)
  } catch (e) {
    console.error('[proxy-audio]', e.message)
    if (!res.headersSent) res.status(500).json({ error: String(e) })
  }
})

// ── Serve 静态文件（dist/）────────────
app.use(express.static(path.join(__dirname, '..', 'dist')))

// 404 兜底
app.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口未找到！' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] MusicTool 集成服务器运行在 http://localhost:${PORT}`)
})
