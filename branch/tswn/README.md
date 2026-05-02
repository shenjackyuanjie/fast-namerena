# tswn_wasm Examples

本目录提供 `tswn_wasm` 的浏览器示例页面。

## 示例一览

### `demo.html` — 快速功能验证

- 提供输入区、战斗控制区和胜率控制区。
- 调用 `fight()` / `fight_summary()` / `win_rate_sync()` 等顶层导出接口。
- 适合快速测试 wasm 是否正确构建、核心战斗逻辑是否正常。

### `show.html` — 完整对局动画展示

- 全功能对战回放播放器，支持逐帧动画、分段推进。
- 包含多文件模块：
  - `show-wasm.js` — WASM 模块加载与 `buildReplay()` 入口
  - `show-utils.js` — DOM 渲染工具函数（头像、状态标签、`replayDisplayName()` 等）
  - `show-render.js` — 玩家状态 / 头像 / 状态标签渲染，seed 行展示
  - `show-replay.js` — 回放介绍、播放速度控制、逐段推进逻辑
- 支持 normal / fast / turbo 三种播放速度。
- 支持从原始输入中提取 `seed:` 行并显示在玩家列表顶部。
- 召唤单位（clone / summon / shadow / zombie）会按类型显示对应的中文名并附带 `#playerId`。

## 运行方式

推荐先构建 wasm 分发目录：

```powershell
uv run scripts/build_wasm.py --release
```

默认会生成：

```text
crates/tswn_wasm/dist/wasm/
  pkg/
  raw/
  examples/
```

随后在输出目录下启动一个本地静态服务器，例如：

```powershell
cd crates/tswn_wasm/dist/wasm
python -m http.server 8000
```

然后在浏览器打开：

- `http://127.0.0.1:8000/examples/demo.html`
- `http://127.0.0.1:8000/examples/show.html`

## 说明

- JS 文件会优先尝试从打包结果目录的 `../pkg/tswn_wasm.js` 加载 wasm glue。
- 若直接在源码目录下调试，也会回退尝试 `../dist/wasm/pkg/tswn_wasm.js`。
- 由于浏览器的 ES module / wasm 加载要求，示例需要通过 HTTP 服务访问，不能直接双击本地文件运行。
