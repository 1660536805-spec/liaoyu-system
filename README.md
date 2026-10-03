# 弦养

`liaoyu0-1` 的可维护应用源码位于 `app/`。根目录 `dist/` 是构建产物，不再作为源码提交。应用把本地 MediaPipe 姿态识别、八段锦八式判定、古琴音效与练习记录放在同一个 Vue 应用中。

## 本机运行

需要 Node.js 20 或更新版本。

```bash
cd app
npm ci
npm run dev
```

电脑浏览器打开 `http://localhost:5173`。摄像头仅在进入跟练或姿态调试页时请求；浏览器拒绝授权时，可以在地址栏权限设置中重新允许。

## 构建与预览

```bash
cd app
npm run build
npm run test:build
npm run test:all
cd ..
node server.cjs 5173
```

构建输出位于根目录 `dist/`，包含本地 WASM、姿态模型、古琴音频和界面图像。`test:all` 不依赖真机采样文件；`verify:real`、`verify:cleaner`、`verify:pose` 需要现场采集数据，必须另行执行。手机摄像头需要 HTTPS 安全上下文，开发证书说明见 `app/SETUP.md`。

练习记录存储在当前浏览器的 `localStorage`，不会上传到服务器。清理浏览器网站数据会删除记录。
