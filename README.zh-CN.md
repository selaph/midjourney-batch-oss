# Midjourney 批量自动化 Skill

[English](./README.md) | [简体中文](./README.zh-CN.md)

用于通过 Agent 工作流批量生成 Midjourney/Niji Journey 图片。

## 1. 安装（最重要）

### 当前推荐：git clone 一行安装

安装到 Codex：

```bash
git clone https://github.com/selaph/midjourney-batch-oss.git ~/.codex/skills/midjourney-batch
```

安装到 Claude Code：

```bash
git clone https://github.com/selaph/midjourney-batch-oss.git ~/.claude/skills/midjourney-batch
```

安装后重启 CLI 会话。

## 2. 最简单用法（直接和 Agent 说话）

在聊天里直接描述需求，Agent 应该会自动调用这个 skill。

示例：

- `帮我去 niji 上生成 10 组元宵节边框图。`
- `读取 D:\notes\xxx.md 里的提示词，帮我批量生成。`
- `先帮我预览提示词，再提交。`
- `先检查 MJ/Niji 登录和页面状态。`

预期流程：

1. Agent 先生成或读取提示词文件。
2. 先做 preview（不提交）。
3. 确认后执行 submit。
4. 自动拉起浏览器并批量提交。
5. 从 `_report.json` 汇总结果。

## 3. 命令行入口（进阶）

如果你想直接命令运行：

```bash
node scripts/run-mj.js --help
```

常用命令：

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>"
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>" --submit
node scripts/run-mj.js --diagnose --output "<output_dir>"
node scripts/run-mj.js --set-default-output "<output_dir>"
node scripts/run-mj.js --download-only --experimental-download --output "<output_dir>"
```

## 4. 运行要求

- Bun 或 Node.js 22+
- Chrome 或 Chromium
- 可用的 Midjourney/Niji Journey 网页登录会话

## 5. 运行时行为

- 推荐入口：`node scripts/run-mj.js ...`
- 启动器优先使用 `bun`
- 若 `bun` 不可用，自动回退到 `node --experimental-strip-types`

## 6. 仓库结构

- `SKILL.md`: Agent 使用说明
- `references/workflow.md`: 工作流与故障排查
- `scripts/install-skill.js`: 可选安装入口
- `scripts/run-mj.js`: 统一启动入口（自动 bun/node）
- `scripts/mj-browser.ts`: CLI 主逻辑
- `scripts/mj-selectors.ts`: 选择器发现与页面探测
- `scripts/cdp.ts`: CDP 与 Chrome 启动管理

## 7. 说明

- 稳定默认流程不会自动下载图片。
- 下载是实验能力，需要显式加 `--experimental-download`。
- 任务完成后会保留浏览器窗口。

## 8. 输出内容

- 图片：`001_a.png`, `001_b.png`, ...
- 报告：`_report.json`

## 声明

请在符合 Midjourney/Niji Journey 服务条款和当地法律的前提下使用本项目。  
网页自动化可能会因页面更新而失效。
