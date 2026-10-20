# deobf 工具

用于清理 `branch/latest/md5.js` 的可重复管线。当前阶段只做**死代码清理 + lazy 常量内联**，不改标识符、不改战斗语义。

## 环境

- Bun 1.4.0：`D:/apps/bun/bin/bun`
- 依赖：`@babel/parser`、`@babel/traverse`、`@babel/types`

```bash
cd tools/deobf
D:/apps/bun/bin/bun install
```

## 基线

```bash
# 生成/更新 golden（会写入 golden/v0.5.3/sequence.json）
D:/apps/bun/bin/bun run src/harness/snapshot.ts \
  --candidate ../../branch/latest/md5.js \
  --golden golden/v0.5.3

# 校验任意候选文件
D:/apps/bun/bin/bun run src/harness/verify.ts \
  --candidate ../../branch/latest/md5.stage1.js \
  --golden golden/v0.5.3

# 性能基线/对比
D:/apps/bun/bin/bun run src/harness/bench.ts \
  --candidate ../../branch/latest/md5.js \
  --runs 5 --label baseline \
  --report report/benchmark-baseline.json
```

候选文件必须放在 `branch/latest/` 下（`md5.js` 通过 `__dirname` 读取 `assets/`），或由脚本复制到该目录。

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

## 验证口径

- 每个用例在**独立 Bun 进程**中执行，避免 module cache 与 `why_ns` 污染
- 比较完整返回值（包括 `fight_log.updates`）、版本号、用例内的 console 输出
- 单个操作默认 30s 超时
- `test.ts` 只作为辅助检查；注意它历史上从未真正执行（`md5-api.ts` 被 import 时会直接跑 CLI），现已修复为 `import.meta.main` 才启动 CLI

## 当前基线（0.5.3）

见 `report/benchmark-baseline.json`。参考中位数：

| 项目 | 中位数 |
| --- | --- |
| 进程启动 + 加载 | ~27 ms |
| fight ×200（3 人） | ~215 ms |
| win_rate(1000) | ~323 ms |
| score(10000) | ~4.34 s |

## 目录

```
src/lib/        参数、路径、JSON 工具
src/harness/    语料、快照、验证、基准
src/passes/     AST 分析与清理 pass（后续阶段）
golden/         行为基线
report/         死代码清单、性能报告、行号映射
legacy/         旧的 regex 脚本（capture_lazy/apply_lazy/get_obs/replaces）
```
