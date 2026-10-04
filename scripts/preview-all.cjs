/**
 * 弦养 · 全量预览服务（零依赖）
 * 目的：一个端口里同时看到「产品应用 dist/」和「各种候选产物 outputs/」，
 *      避免再出现「点错入口 / 找不到新做的东西」。
 *
 * 查找顺序：先 dist/，再仓库根目录。所以
 *   /                     → dist/index.html        （主壳）
 *   /s4/#/train           → dist/s4/index.html     （真跟练页，含新教练）
 *   /outputs/xxx.html     → outputs/xxx.html       （候选产物 / 启动台）
 *
 * 用法：node scripts/preview-all.cjs [端口]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const DIST = path.join(REPO, 'dist')
const PORT = Number(process.argv[2]) || 5400

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
}

/** 把 URL 路径安全地解析到某个根目录下，越界返回 null */
function resolveIn(root, rel) {
  const full = path.resolve(root, rel.replace(/^[/\\]+/, ''))
  const r = path.relative(root, full)
  if (r === '..' || r.startsWith('..' + path.sep) || path.isAbsolute(r)) return null
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null
  return full
}

function pick(p) {
  let rel = p === '/' ? '/index.html' : p
  if (rel.endsWith('/')) rel += 'index.html'
  // 先 dist（产品应用），再仓库根（outputs 等辅助产物）
  return resolveIn(DIST, rel) || resolveIn(REPO, rel)
}

http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0])
    const full = pick(p)
    if (full) {
      const ext = path.extname(full).toLowerCase()
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      return fs.createReadStream(full).pipe(res)
    }
    // 无扩展名 → 兜底回主壳（hash 路由）
    if (!path.extname(p)) {
      const idx = path.join(DIST, 'index.html')
      if (fs.existsSync(idx)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })
        return fs.createReadStream(idx).pipe(res)
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    const esc = p.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    res.end('<meta charset="utf-8"><body style="font:16px system-ui;padding:40px"><h3>404 找不到：' + esc + '</h3><p><a href="/outputs/preview/">← 回预览启动台</a></p></body>')
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('500 ' + e.message)
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`  弦养 · 全量预览已启动：http://127.0.0.1:${PORT}/outputs/preview/`)
  console.log('  仅允许本机访问')
})
