# namerena-work

shenjack 的 namerena 镜像项目

## 项目简介

目前这里主要在进行 namerena 的反混淆+反编译工作

你可以在 [latest 分支](./branch/latest/) 看到最新的进展

你也可以在 [fight 分支](./branch/fight/) 看到纯战斗特化的分支

你可以在 [news](./news.md) 看到更新日志

## 项目目标

完全了解清楚 namerena 的运行机制

## 目前 可用/已经存在的 api

> md5.js

- `run_any`
  - 直接运行一个游戏，支持任意 api
  - 可以通过修改 report 部分的代码来获取战斗过程
  - 也支持

- 完全反混淆
  - 看到一个 `$.xx()` 不知道这是啥?
  - 打开 ctrl+f
  - 搜索 `"xx"`
  - 找到对应的 `lazy_old` 函数

## 项目进度

- [x] 反混淆
  - [x] md5.js
    - [x] 所有 Lazy 的函数 的反混淆
    - [x] 找到主循环
    - [x] 导出主循环
    - [x] 导出 api
