# 开箱用法

## 需求

你需要:

- 你的脑子
- 你的手
- 你的电脑
  - 安装好 nodejs(pnpm)/bun (bun 更好)
  - 安装好 python (如果你需要写点脚本)
  - 下载好这个仓库

## 步骤

准备好你的脑子，打开你的电脑，然后:

1. 打开终端
2. 进入到这个仓库的根目录
3. 安装 `ts-node` (如果你用的是 nodejs)
   1. `npm install --global ts-node typescript`

根据你的需求, 你可以:

- 根据 `md5-api.ts` 的文档 直接写一个自己的 开箱/测号 脚本
- 跟随下面的指引, 开箱指定的号

### 开箱指定文件

```powershell
# 如果是 nodejs
ts-node md5-api.ts <你的文件> pp/pd/qp/qd
# 如果是 bun
bun run md5-api.ts <你的文件> pp/pd/qp/qd
```
