import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// S4 联调手机摄像头时再启用 https：
// import basicSsl from '@vitejs/plugin-basic-ssl'  然后 plugins: [vue(), basicSsl()]
export default defineConfig({
  plugins: [vue()],
  server: { host: true, port: 5173 },
})
