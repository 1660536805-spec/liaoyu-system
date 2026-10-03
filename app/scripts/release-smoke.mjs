import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.dirname(appDir)
const distDir = path.join(repoDir, 'dist')
const html = await readFile(path.join(distDir, 'index.html'), 'utf8')
assert.match(html, /\/assets\/index-[\w-]+\.js/)
assert.match(html, /\/assets\/index-[\w-]+\.css/)
assert.doesNotMatch(html, /(?:src|href)=["'][^"']*app\.js/)

const bundles = (await readdir(path.join(distDir, 'assets'))).filter((name) => /^index-[\w-]+\.js$/.test(name))
const code = (await Promise.all(bundles.map((name) => readFile(path.join(distDir, 'assets', name), 'utf8')))).join('\n')
for (const text of ['今天想照顾哪里？', '开始练习', '练习总结', '手动练习', '摄像头未授权']) {
  assert(code.includes(text), `production bundle is missing flow content: ${text}`)
}

const port = Number(process.env.RELEASE_SMOKE_PORT) || 5191
const server = spawn(process.execPath, [path.join(repoDir, 'server.cjs'), String(port)], { stdio: 'ignore' })
const base = `http://127.0.0.1:${port}`
async function get(pathname) {
  const response = await fetch(`${base}${pathname}`)
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`)
  return response
}

try {
  let ready = false
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    if (server.exitCode !== null) throw new Error(`preview server exited with ${server.exitCode}`)
    try { ready = (await fetch(base)).status === 200 } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
  assert(ready, 'preview server did not become ready')
  const index = await get('/')
  assert.match(index.headers.get('content-type') || '', /text\/html/)
  assert.match(await index.text(), /弦养/)
  for (const route of ['/questions', '/intro', '/train', '/finish', '/me', '/me/body-data', '/sound']) {
    const response = await get(route)
    assert.match(response.headers.get('content-type') || '', /text\/html/)
  }
  const assets = [
    ['/art/landscape.jpg', /image\/jpeg/],
    ['/audio/zuiyu.mp3', /audio\/mpeg/],
    ['/audio/meihua.mp3', /audio\/mpeg/],
    ['/assets/fallback.mp4', /video\/mp4/],
    ['/models/pose_landmarker_lite.task', /application\/octet-stream/],
    ['/wasm/vision_wasm_internal.wasm', /application\/wasm/],
  ]
  for (const [pathname, type] of assets) {
    const response = await get(pathname)
    assert.match(response.headers.get('content-type') || '', type, `${pathname} should have the expected MIME type`)
    await response.body?.cancel()
  }
  console.log(`release-smoke passed: ${8 + assets.length} routes/assets, local media/model/WASM, and one Vue bundle`)
} finally {
  server.kill('SIGTERM')
}
