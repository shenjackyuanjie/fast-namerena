# deobf 工具

用于清理 `branch/latest/md5.js` 的可重复管线。当前只做**死代码清理 + lazy 常量内联**，不改标识符、不改战斗语义。

## 当前状态（md5 0.5.3 第一轮）

已落地的清理：

| 项目 | 变化 |
| --- | --- |
| 不可达命名空间成员 | 删除 25 个 |
| 无引用的 lazy 初始化器 | 删除 185 个 |
| 字面量 lazy 常量 | 内联 46 个，移除 46 条注册 |
| 其他 | 删除 `class NewRc4`、未使用的命名空间数组、`lazy` 包装与调试残留 |
| 行数 | 22,729 → 21,539 |
| 归一化（LF）体积 | 694,550 → 659,792 字节 |
| 保留的 lazy 注册 | 277 → 44 |

行为门槛全部通过：golden 全语料逐字节一致、`bun test.ts` 通过、无头 Edge 跑完一场真实战斗（胜者 `m@fAIgFUL`）。

## 环境

- Bun 1.4.0：`D:/apps/bun/bin/bun`
- Node 22+：仅浏览器烟雾测试用（依赖全局 `WebSocket`）
- 依赖：`@babel/parser`、`@babel/traverse`、`@babel/types`、`magic-string`

```bash
cd tools/deobf
D:/apps/bun/bin/bun install
```

## Gate（每批改动后都要跑）

```bash
# 1. 行为快照：在全新进程里按固定顺序跑完整语料
D:/apps/bun/bin/bun run verify -- \
  --candidate ../../branch/latest/md5.stageN.js \
  --golden golden/v0.5.3

# 2. 项目自带用例（候选提升为 md5.js 之后）
cd ../../branch/latest && D:/apps/bun/bin/bun test.ts

# 3. 浏览器路径
cd ../../tools/deobf && node src/harness/browser-smoke.cjs

# 4. 性能（5 次独立进程取中位数）
D:/apps/bun/bin/bun run bench -- \
  --candidate ../../branch/latest/md5.js \
  --runs 5 --label final \
  --report report/benchmark-final.json
```

候选文件必须放在 `branch/latest/` 下（`md5.js` 通过 `__dirname` 读取 `assets/`），或由脚本复制到该目录。中间产物统一命名为 `md5.stageN.js`，已被 `.gitignore` 忽略。

## 清理流程

```bash
# 1. 盘点与可达性（只读，输出 report/inventory.json、reachability.json、dead-code.md）
D:/apps/bun/bin/bun run inventory -- --candidate ../../branch/latest/md5.js
D:/apps/bun/bin/bun run reachability -- --candidate ../../branch/latest/md5.js

# 2. 删除不可达成员（--members 0 可跳过）
D:/apps/bun/bin/bun run delete-dead -- \
  --candidate ../../branch/latest/md5.stage1.js \
  --out ../../branch/latest/md5.stage2.js \
  --members 100 --lazy 100

# 3. 内联可静态化的 lazy 字面量
D:/apps/bun/bin/bun run inline-lazy -- \
  --candidate ../../branch/latest/md5.stage2.js \
  --out ../../branch/latest/md5.stage3.js
```

`delete-dead` 的 `--lazy N` 默认是 0（不删 lazy），要删必须显式给出上限；`--members-limit N` 可限制单批成员数。pass 的选取结果写入 `report/last-delete.json`、`report/last-inline.json`。

## 禁止项

- 只删除同时满足以下条件的命名空间成员：不可达、没有 prototype、没有字符串引用、不是普通数据属性
- 不删除 `aliases` / `installTearOffs` / `inheritance` / `staticFields` / 类型表中出现的名字、被 `.name` 访问的函数/类、所有 lazy 定义（除非其 getter 已完全内联）
- 不内联对象、构造器、RegExp、Map/Set、依赖运行时状态或会被修改的值
- 不改变公开 API、事件名、输出文本、随机数消费顺序
- 不用 `@babel/generator` 重排整个文件；只用 `magic-string` 按源码偏移修改
- 不重排 `src/harness/corpus.ts` 的用例顺序
- 浏览器与 Node/Bun 双端兼容是硬约束，拿不准就保留

## 语料与顺序

`src/harness/corpus.ts` 固定了调用顺序。前 5 项与 `branch/latest/test.ts` 一致：

1. `golden-fight-1` / `golden-fight-2`
2. `golden-win-rate`（10000 轮）
3. `golden-score-1` / `golden-score-2`（各 10000 轮）

之后是日志、分身、seed、强单队伍、DIY、武器用例。`why_ns` 是模块级计数器，结果依赖调用顺序，因此**不要在快照序列中插入或重排用例**；要加用例就追加在末尾并重新生成 golden。

已知不能放进固定序列的输入：

- `seed:seed@!`：进入无限种子模式，Promise 不 resolve
- `name+属性修改器`：在当前 0.5.3 产物里会抛错并破坏后续模块状态
- `name+BossName!`：单独跑可以，但排在长序列末尾会不结束

这些问题属于 md5.js 自身行为，清理阶段不修。

## 浏览器烟雾测试

`src/harness/browser-smoke.cjs` 做四件事：

1. 起一个本地静态服务，把 `branch/latest` 作为站点根目录
2. 启动无头 Edge（`EDGE_PATH` 可覆盖路径），用 CDP 打开 `index.html`
3. 在输入框填入 `m@fAIgFUL\n1 1 @Ehlt s` 并点击开始
4. 等待 iframe 发出 `done_fight`，校验胜者与页面无未捕获异常

本地 `index.html` 缺少部署时由广告脚本注入的 `.ad_v`，脚本只在 HTTP 响应里补占位，不改仓库文件。

## 验证口径

- 每个用例在**独立 Bun 进程**中执行，避免 module cache 与 `why_ns` 污染
- 比较完整返回值（包括 `fight_log.updates`）、版本号、用例内的 console 输出
- 单个操作默认 30s 超时
- `test.ts` 只作为辅助检查；注意它历史上从未真正执行（`md5-api.ts` 被 import 时会直接跑 CLI），现已修复为 `import.meta.main` 才启动 CLI

## 性能

见 `report/benchmark.md`。Phase 0 基线在 `report/benchmark-baseline.json`；最终同机背靠背对比的两份原始数据是 `report/benchmark-baseline-recheck.json`（清理前）与 `report/benchmark-final.json`（清理后）。

## 行号映射

`report/line-map.json` 记录清理前（`md5.stage0.js`）到清理后的行号映射：`map[旧行号-1] = 新行号`，`null` 表示该行已删除。改动块内按行位置对齐，仅供定位参考；锚点行见同一文件的 `anchors`。

## 目录

```
src/lib/        参数、路径、JSON 工具
src/harness/    语料、快照、验证、基准、浏览器烟雾测试
src/passes/     AST 分析与清理 pass
golden/         行为基线
report/         死代码清单、性能报告、行号映射
legacy/         归档的旧 regex 脚本（capture_lazy/apply_lazy/get_obs/replaces）
```
