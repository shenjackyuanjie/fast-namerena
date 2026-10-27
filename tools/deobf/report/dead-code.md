# md5.js 可达性与死代码清单

- 源文件：`D:\githubs\namer\fast-namerena\branch\latest\md5.js`
- SHA-256：`7c0edbd83f0590554cb4a210d2919d9c2743400fa2c89dbcc81965ec0987dd31`
- 命名空间成员：898，不可达 18，可自动删除 1
- lazy 注册：44，无引用 0，可内联为字面量 0
- 被枚举的命名空间：无

## 可删除的命名空间成员（不可达 + 非类 + 无字符串引用）

| 行 | 成员 | 类型 |
| --- | --- | --- |
| 3588-3593 | `LangData.j` | method |

## 不可达但被保护（类/prototype 或字符串引用）

| 行 | 成员 | 类型 | prototype | 字符串 |
| --- | --- | --- | --- | --- |
| 1717 | `H.defineProperty` | method |  | 是 |
| 2034 | `H.on` | method |  | 是 |
| 4673 | `T.ty` | method |  | 是 |
| 4699 | `T.tA` | method |  | 是 |
| 4791 | `T.tC` | method |  | 是 |
| 4831 | `T.tD` | method |  | 是 |
| 4860 | `T.tE` | method |  | 是 |
| 4873 | `T.tF` | method |  | 是 |
| 4899 | `T.tI` | method |  | 是 |
| 5722 | `T.tB` | method |  | 是 |
| 5757 | `T.tG` | method |  | 是 |
| 6213 | `T.tx` | method |  | 是 |
| 6214 | `T.tz` | method |  | 是 |
| 7900 | `W.tT` | method |  | 是 |
| 7903 | `W.tU` | method |  | 是 |
| 8144 | `X.k` | method |  | 是 |

## 无引用的 lazy 注册

| 行 | slot | getter | 初始化 | 字面量 |
| --- | --- | --- | --- | --- |

## 可内联的 lazy 字面量（有调用点，无写入，getter 无引用）

| 行 | slot | 字面量 | slot 引用 |
| --- | --- | --- | --- |

