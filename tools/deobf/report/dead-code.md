# md5.js 可达性与死代码清单

- 源文件：`D:\githubs\namer\fast-namerena\branch\latest\md5.stage3.js`
- SHA-256：`061cbc6447bcff1340478810184eed3493b6ac7ae91552b66641268a663397e6`
- 命名空间成员：898，不可达 17，可自动删除 0
- lazy 注册：46，无引用 0，可内联为字面量 0
- 被枚举的命名空间：无

## 可删除的命名空间成员（不可达 + 非类 + 无字符串引用）

| 行 | 成员 | 类型 |
| --- | --- | --- |

## 不可达但被保护（类/prototype 或字符串引用）

| 行 | 成员 | 类型 | prototype | 字符串 |
| --- | --- | --- | --- | --- |
| 1779 | `H.defineProperty` | method |  | 是 |
| 2096 | `H.on` | method |  | 是 |
| 4735 | `T.ty` | method |  | 是 |
| 4761 | `T.tA` | method |  | 是 |
| 4853 | `T.tC` | method |  | 是 |
| 4893 | `T.tD` | method |  | 是 |
| 4922 | `T.tE` | method |  | 是 |
| 4935 | `T.tF` | method |  | 是 |
| 4961 | `T.tI` | method |  | 是 |
| 5784 | `T.tB` | method |  | 是 |
| 5819 | `T.tG` | method |  | 是 |
| 6275 | `T.tx` | method |  | 是 |
| 6276 | `T.tz` | method |  | 是 |
| 7962 | `W.tT` | method |  | 是 |
| 7965 | `W.tU` | method |  | 是 |
| 8206 | `X.k` | method |  | 是 |

## 无引用的 lazy 注册

| 行 | slot | getter | 初始化 | 字面量 |
| --- | --- | --- | --- | --- |

## 可内联的 lazy 字面量（有调用点，无写入，getter 无引用）

| 行 | slot | 字面量 | slot 引用 |
| --- | --- | --- | --- |

