import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

// 摄像头在浏览器里只在「安全上下文」可用：
//   localhost / 127.0.0.1  → http 就行
//   局域网 IP（手机访问）  → 必须 https
// 故用环境变量切换：npm run dev（电脑调试） / npm run dev:https（手机演示）
const useHttps = process.env.XIANYANG_HTTPS === '1'

export default defineConfig({
  plugins: [vue(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true,          // 0.0.0.0，局域网手机可达
    port: 5173,
    // 自签名证书：首次在手机上打开会提示「不安全」，选择「继续访问」即可。
    // 摄像头一旦页面是 https 就可用，故这是现场手机演示的推荐方式。
    https: useHttps,
  },
})
