# Midjourney 批量自动化 Skill

[English](./README.md) | [简体中文](./README.zh-CN.md)

基于 Chrome CDP 的 Midjourney/Niji Journey 批量提示词自动化工具。

这个开源副本目标是可移植、可复用：
- 不依赖个人绝对路径
- 兼容跨平台 profile/cache 行为
- 统一输出 `_report.json` 报告
- 文档与实际脚本行为一致

## 功能特性

- 先预览再提交，降低误操作风险
- 批量提交提示词，支持超时与间隔控制
- 诊断登录状态与选择器可用性
- 支持持久化默认输出目录
- 图片下载为实验特性（默认关闭）
- 每次运行输出 JSON 报告

## 仓库结构

- `SKILL.md`: Agent 使用说明
- `references/workflow.md`: 工作流与故障排查
- `scripts/run-mj.js`: 统一启动入口（自动 bun/node）
- `scripts/mj-browser.ts`: CLI 主逻辑
- `scripts/mj-selectors.ts`: 选择器发现与页面探测
- `scripts/cdp.ts`: CDP 与 Chrome 启动管理

## 运行要求

- Bun 或 Node.js 22+
- Chrome 或 Chromium
- 可用的 Midjourney/Niji Journey 网页登录会话

## 快速开始

1. 预览提示词：

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>"
```

2. 正式提交：

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>" --submit
```

3. 诊断状态：

```bash
node scripts/run-mj.js --diagnose --output "<output_dir>"
```

4. 保存默认输出目录（可选）：

```bash
node scripts/run-mj.js --set-default-output "<output_dir>"
```

5. 实验模式下载最新图组（可选）：

```bash
node scripts/run-mj.js --download-only --experimental-download --output "<output_dir>"
```

## 提示词格式

推荐 markdown 代码块格式：

````markdown
## 1. Prompt title
```
cinematic portrait of a traveler in rainy neon street
```
````

简易逐行格式（fallback）：

```text
cinematic portrait of a traveler in rainy neon street
minimalist product shot, soft studio light, white background
```

## 环境变量

- `MJ_BROWSER_CHROME_PATH`: 自定义 Chrome 可执行文件路径
- `MJ_BROWSER_PROFILE_DIR`: 自定义本工具使用的 profile 目录
- `MJ_BROWSER_OUTPUT_DIR`: 当未保存默认输出目录时的兜底目录

## 稳定能力与实验能力

- 稳定默认：提示词提交 + 报告输出
- 实验能力：添加 `--experimental-download` 开启下载逻辑
- 未开启实验下载时，提交流程不会自动下载图片

## 运行时行为

- 推荐入口：`node scripts/run-mj.js ...`
- 启动器会优先使用 `bun`
- 如果 `bun` 不可用，会自动回退到 `node --experimental-strip-types`

## 输出内容

产物默认写入输出目录：
- 图片：`001_a.png`, `001_b.png`, ...
- 报告：`_report.json`

## 声明

请在符合 Midjourney/Niji Journey 服务条款和当地法律的前提下使用本项目。  
网页自动化可能会因页面更新而失效。
