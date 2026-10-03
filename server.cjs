/**
 * 弦养 · 零依赖静态服务
 * 只用 Node 内置模块，不需要 npm install、不需要联网。
 * 用法：node server.cjs [端口]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, 'dist')
const PORT = Number(process.argv[2]) || 5173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.crt': 'application/x-x509-ca-cert',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/') p = '/index.html'
    // 解析原始路径后按目录边界判断，同时拒绝越界符号链接。
    const full = path.resolve(ROOT, p.replace(/^([/\\])+/, ''))
    const relative = path.relative(ROOT, full)
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      res.writeHead(403); return res.end('403')
    }
    if (fs.existsSync(full)) {
      const realRelative = path.relative(fs.realpathSync(ROOT), fs.realpathSync(full))
      if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) {
        res.writeHead(403); return res.end('403')
      }
    }

    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      // SPA 回退：项目用 hash 路由（#/train），理论上不需要，
      // 但队友若手动输 /guide 这类路径，兜底回 index.html 避免白屏。
      const idx = path.join(ROOT, 'index.html')
      if (fs.existsSync(idx) && !path.extname(p)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })
        return fs.createReadStream(idx).pipe(res)
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      const escaped = p.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
      return res.end('<meta charset="utf-8"><h3>404 找不到：' + escaped + '</h3>')
    }
    const ext = path.extname(full).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // 摄像头不需要这些，但设上更接近真实环境
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(full).pipe(res)
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('500')
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`  弦养已启动：http://127.0.0.1:${PORT}`)
  console.log('  仅允许本机访问')
  console.log('  关闭此窗口即停止服务')
})
