import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const CERT = path.join(ROOT, 'certs', 'server.crt')
const KEY = path.join(ROOT, 'certs', 'server.key')
const hasLocalCert = fs.existsSync(CERT) && fs.existsSync(KEY)

// 摄像头在浏览器里只在「安全上下文」可用：
//   localhost / 127.0.0.1  → http 就行
//   局域网 IP（手机访问）  → 必须 https
// 优先级：本地自签 CA 证书（手机可信任）> basic-ssl 自签名（手机会拒绝）
const useHttps = process.env.XIANYANG_HTTPS === '1'
let httpsConfig = { basicSsl: true }
if (hasLocalCert) {
  httpsConfig = { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }
} else {
  console.warn('[vite] 未找到 certs/server.crt，退回 basic-ssl 自签名证书。')
  console.warn('[vite] 手机访问时 iOS Safari 会拒绝自签名证书，请先跑：bash scripts/gen-cert.sh')
}

// 端口：云部署平台会注入 PORT 环境变量；本地未注入时沿用原端口
const PORT = Number(process.env.PORT) || (useHttps ? 5174 : 5173)

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,          // 0.0.0.0，局域网手机可达
    port: PORT,
    https: useHttps ? httpsConfig : false,
    // 云端部署走反向代理域名，不设白名单会被 Vite 的 host 检查拦掉
    allowedHosts: true,
  },
  preview: { host: true, port: PORT, allowedHosts: true },
})
