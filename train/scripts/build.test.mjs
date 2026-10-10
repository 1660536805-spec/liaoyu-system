import { test } from 'node:test'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dist = path.join(root, 'dist')

test('production build contains the app and every offline engine asset', async () => {
  const required = [
    'index.html',
    'models/pose_landmarker_lite.task',
    'wasm/vision_wasm_internal.wasm',
    'art/landscape.jpg',
    ...Array.from({ length: 7 }, (_, i) => `guqin/${i + 1}-${['xiang-C2', 'xiang-D2', 'xiang-F2', 'xiang-G2', 'xiang-A2', 'xiang-C3', 'xiang-D3'][i]}.ogg`),
  ]
  await Promise.all(required.map((item) => access(path.join(dist, item))))
  const html = await readFile(path.join(dist, 'index.html'), 'utf8')
  assert.match(html, /id="app"/)
  assert.doesNotMatch(html, /\/app\.js/)
})
