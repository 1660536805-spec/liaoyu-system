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
  '.crt': 'application/x-x509-ca-cert',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/') p = '/index.html'
    // 防目录穿越
    const full = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''))
    if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('403') }

    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      // SPA 回退：项目用 hash 路由（#/train），理论上不需要，
      // 但队友若手动输 /guide 这类路径，兜底回 index.html 避免白屏。
      const idx = path.join(ROOT, 'index.html')
      if (fs.existsSync(idx) && !path.extname(p)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })
        return fs.createReadStream(idx).pipe(res)
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<meta charset="utf-8"><h3>404 找不到：' + p + '</h3>')
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
    res.writeHead(500); res.end(String(e))
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`  弦养已启动：http://localhost:${PORT}`)
  console.log(`  同一 WiFi 的手机可访问：http://<本机IP>:${PORT}`)
  console.log('  关闭此窗口即停止服务')
})
