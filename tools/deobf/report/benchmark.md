# 性能基线（md5.js 0.5.3，清理前）

- 运行时：Bun 1.4.0，Windows x64
- 样本：5 次独立进程，取中位数
- 源文件 SHA-256 见 `golden/v0.5.3/meta.json`

| 项目 | 中位数 |
| --- | --- |
| wall（进程启动到退出） | 5003.2 ms |
| load（require 到可用） | 26.9 ms |
| fight ×200（3 人） | 214.9 ms |
| win_rate(1000) | 323.0 ms |
| score(10000) | 4339.6 ms |
| 子进程内合计 | 4917.6 ms |

清理验收标准：任一项目退化不超过 3%（噪声容忍）；有提升则记录。

原始数据：`benchmark-baseline.json`。
