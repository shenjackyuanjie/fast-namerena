# md5.js 可达性与死代码清单

- 源文件：`D:\githubs\namer\fast-namerena\branch\latest\md5.js`
- SHA-256：`4c1db781a64886ffed136f04cd2f1423a85337d89293b37485b0e6db824b3a86`
- 命名空间成员：897，不可达 17，可自动删除 0
- lazy 注册：44，无引用 0，可内联为字面量 0
- 被枚举的命名空间：无

## 可删除的命名空间成员（不可达 + 非类 + 无字符串引用）

| 行 | 成员 | 类型 |
| --- | --- | --- |

## 不可达但被保护（类/prototype 或字符串引用）

| 行 | 成员 | 类型 | prototype | 字符串 |
| --- | --- | --- | --- | --- |
| 1717 | `H.defineProperty` | method |  | 是 |
| 2034 | `H.on` | method |  | 是 |
| 4667 | `T.ty` | method |  | 是 |
| 4693 | `T.tA` | method |  | 是 |
| 4785 | `T.tC` | method |  | 是 |
| 4825 | `T.tD` | method |  | 是 |
| 4854 | `T.tE` | method |  | 是 |
| 4867 | `T.tF` | method |  | 是 |
| 4893 | `T.tI` | method |  | 是 |
| 5716 | `T.tB` | method |  | 是 |
| 5751 | `T.tG` | method |  | 是 |
| 6207 | `T.tx` | method |  | 是 |
| 6208 | `T.tz` | method |  | 是 |
| 7894 | `W.tT` | method |  | 是 |
| 7897 | `W.tU` | method |  | 是 |
| 8138 | `X.k` | method |  | 是 |

## 无引用的 lazy 注册

| 行 | slot | getter | 初始化 | 字面量 |
| --- | --- | --- | --- | --- |

## 可内联的 lazy 字面量（有调用点，无写入，getter 无引用）

| 行 | slot | 字面量 | slot 引用 |
| --- | --- | --- | --- |

