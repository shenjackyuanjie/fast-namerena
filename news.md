# 更新日志?

## md5 0.5.3

第一轮反混淆清理（不改变战斗语义，浏览器与 Node/Bun 双端可用）：

- 删除 25 个不可达命名空间成员、185 个无引用的 lazy 初始化器
- 内联 46 个字面量 lazy 常量，lazy 注册从 277 降到 44
- 删除 `NewRc4`、未使用的命名空间数组与 `lazy` 包装
- 22,729 → 21,539 行，LF 体积 694,550 → 659,792 字节
- 固定语料快照逐字节一致，`test.ts` 与无头 Edge 实测通过，性能无退化

管线与验收命令见 `tools/deobf/README.md`，旧行号映射见 `tools/deobf/report/line-map.json`。

### 第二轮：方法名与参数还原

- 90 条原型方法映射：技能/状态共享接口与 Plr、Engine、RC4、MList、Weapon、Boss 等核心类改用 Dart 原名
- 203 个方法、483 个参数按 `namer-src` 的 Dart 签名还原；`var _ = this` 统一为 `var self = this`
- 继承链派发校验拦下 6 处会改变解析结果的候选名（子类构造体、RC4 构造体等保留原名）
- 行数保持 21,539；LF 体积 659,792 → 676,440 字节
- 固定语料逐字节一致，`test.ts` 与无头 Edge 实测通过；性能较第一轮基线约快 2.4%
- 符号映射见 `branch/latest/md5.symbols.json` 与 `md5.symbols.md`，未解析项见 `tools/deobf/report/rename-unresolved.md`

## md5 0.4.5

添加了 `run_env.fight_only`, 为 `true` 时只会战斗, 不会进行其他操作

## md5 0.4.4

处理 `_TimerImpl` 相关的东西 (简称: 删代码)

## md5-api 0.4.1~0.4.3

修复了各种逆天问题(包括小天才的 loader div没删, `\r` 变 `\r`)
