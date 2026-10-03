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

也可以用根目录预览服务检查生产构建：

```bash
cd ..
node server.cjs 5190
```

页面入口为 `/#/splash`、`/#/questions`、`/#/`、`/#/sound`、`/#/intro`、`/#/train`、`/#/finish`、`/#/me` 和 `/#/me/body-data`。无摄像头环境可在准备页选择手动练习；也可在摄像头错误页切换到手动模式。手动与预录兜底命中会在总结和记录中单独标注。

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

个人资料使用 `xianyang.profile.v1`，练习记录使用 `xianyang.records.v1`。音疗页只播放仓库已有的本地录音；无音源曲目不会伪装成可播放。离开音疗页会暂停并释放音频，离开训练页会停止摄像头并释放姿态引擎。`npm run release:smoke` 会临时启动根目录静态服务，检查主要路由回退、本地模型/音频/图片资源和生成的 Vue bundle。

验证记录：构建、离线资源、回归单测与 390 × 844 移动端主路径已通过；浏览器中手动完成八式后，刷新“我的”仍显示同一条记录。摄像头拒绝由会话测试覆盖。实体手机的 HTTPS 证书信任、真实摄像头授权与真人动作识别仍需在目标设备上复核，模拟或手动命中不代表人体识别准确率验证。
