# tswn_wasm Examples

本目录提供 `tswn_wasm` 的浏览器示例页面。

## 示例一览

### `demo.html` — 快速功能验证

- 提供输入区、战斗控制区和胜率控制区。
- 调用 `fight()` / `fight_summary()` / `win_rate_sync()` 等顶层导出接口。
- 适合快速测试 wasm 是否正确构建、核心战斗逻辑是否正常。

### `index.html` — 完整对局动画展示

- 全功能对战回放播放器，支持逐帧动画、分段推进。
- 包含多文件模块：
  - `show-wasm.js` — WASM 模块加载与 runtime normalized replay 适配入口
  - `show-utils.js` — DOM 渲染工具函数（头像、状态标签、`replayDisplayName()` 等）
  - `show-render.js` — 玩家状态 / 头像 / 状态标签渲染，seed 行展示
  - `show-replay.js` — 回放介绍、播放速度控制、逐段推进逻辑
  - `show-routing.js` — URL 输入与分享链接参数处理
- 支持 normal / fast / turbo 三种播放速度。
- 支持从原始输入中提取 `seed:` 行并显示在玩家列表顶部。
- 支持通过 URL 参数直接传入对局输入并自动播放：`index.html?input=<url-safe-base64>`。参数值按 UTF-8 解码，Base64 使用 URL-safe 字符集（`+`→`-`、`/`→`_`，可省略末尾 `=`）。`replay` 和 `data` 可作为输入参数兼容别名；参数为空、Base64 非法或 UTF-8 解码失败时会停留在输入面板并显示错误。
- 页面只使用 runtime normalized replay adapter；历史 `engine` / `runtime` 参数会从分享链接中清理，不再提供 `FightSession` fallback。
- 支持在右下角控制栏复制当前对局的分享链接，链接会使用同一套 `input` 参数格式。
- 召唤单位（clone / summon / shadow / zombie）会按类型显示对应的中文名；分身名字里的编号使用底层 `display_index`，左侧仍单独保留 `#playerId`。
- 只消费 `RoundFrame.rows[].clips[]` 结构化 replay view，由 WASM 提供延迟、文本片段、血条变化、死亡特效和侧栏快照信息；战斗正文不再从 `message_template` / `message_rendered` / `hp_delta` 反推展示语义。
- normal 播放模式下，对战结束后等待 `1500ms` 再显示底部结算表；fast / turbo / 单步跳转保持即时显示。左侧玩家 HP 条变化使用较慢动画，方便观察血量变化。
- `show-wasm.js` 暴露 `buildMainNormalizedReplay()`，把 `default_custom_runtime_normalized_run()` 的 rounds/actions/frames 适配成当前 show-compatible replay shape；`index.html` 只调用这条路径。
- `show-wasm.test.mjs` 覆盖 `buildMainReplayFromNormalizedRun()` 的纯 adapter 输出和 `buildFrameRows()` HTML chunk 渲染；`show-routing.test.mjs` 覆盖 URL-safe input、旧 runtime 参数清理和分享链接行为。

生成参数示例：

```js
const rawInput = "云剑狄卡敢\n白胡子\n\n史莱姆\n田一人";
const bytes = new TextEncoder().encode(rawInput);
const base64 = btoa(String.fromCharCode(...bytes));
const input = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const url = `index.html?input=${input}`;
```

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
- `http://127.0.0.1:8000/examples/`

## 说明

- JS 文件会优先尝试从打包结果目录的 `../pkg/tswn_wasm.js` 加载 wasm glue。
- 若直接在源码目录下调试，也会回退尝试 `../dist/wasm/pkg/tswn_wasm.js`。
- 由于浏览器的 ES module / wasm 加载要求，示例需要通过 HTTP 服务访问，不能直接双击本地文件运行。
