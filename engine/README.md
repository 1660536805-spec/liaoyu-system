# engine/ —— 技术甲的纯 JS 引擎（不进 Vue 依赖）

- `preview.html`：摄像头 + 33 点骨架（待技术甲写，任务一）
- 对外接口约定：`onHit(stringIndex)`，stringIndex 1–7；第 8 式 `chord` 触发七弦齐鸣
- 模型与 wasm 放 `public/models/`、`public/wasm/`，不走 CDN（场地可能断网）
