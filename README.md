# Midjourney Batch Automation Skill

[English](./README.md) | [简体中文](./README.zh-CN.md)

Batch-generate Midjourney/Niji Journey images through an agent workflow.

## 1. Install (Most Important)

This repository is a local skill folder. Install it into your agent's `skills` directory.

### Option A: Codex CLI

Windows (PowerShell):

```powershell
$skillHome = "$env:USERPROFILE\.codex\skills\midjourney-batch"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex\skills" | Out-Null
Copy-Item -Recurse -Force "<this-repo-path>" $skillHome
```

macOS/Linux:

```bash
mkdir -p ~/.codex/skills
cp -R <this-repo-path> ~/.codex/skills/midjourney-batch
```

### Option B: Claude Code

Windows (PowerShell):

```powershell
$skillHome = "$env:USERPROFILE\.claude\skills\midjourney-batch"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "<this-repo-path>" $skillHome
```

macOS/Linux:

```bash
mkdir -p ~/.claude/skills
cp -R <this-repo-path> ~/.claude/skills/midjourney-batch
```

After copying, restart your CLI session.

## 2. Fastest Usage (Talk to Agent Naturally)

In chat, just describe what you want. The agent should automatically use this skill.

Examples:

- `帮我去 niji 上生成 10 组元宵节边框图。`
- `读取 D:\notes\xxx.md 里的提示词，帮我批量生成。`
- `先帮我预览提示词，再提交。`
- `先检查 MJ/Niji 登录和页面状态。`

Expected flow:

1. Agent prepares or reads prompt file.
2. Agent runs preview first.
3. Agent asks/gets confirmation.
4. Agent launches browser automation and submits prompts.
5. Agent reports summary from `_report.json`.

## 3. Command-line Entry (Advanced)

If you want to run directly:

```bash
node scripts/run-mj.js --help
```

Main commands:

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>"
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>" --submit
node scripts/run-mj.js --diagnose --output "<output_dir>"
node scripts/run-mj.js --set-default-output "<output_dir>"
node scripts/run-mj.js --download-only --experimental-download --output "<output_dir>"
```

## 4. Requirements

- Bun runtime or Node.js 22+
- Chrome or Chromium
- Valid Midjourney/Niji Journey web login

## 5. Runtime Behavior

- Recommended entrypoint: `node scripts/run-mj.js ...`
- Launcher prefers `bun` if available
- If `bun` is unavailable, launcher falls back to `node --experimental-strip-types`

## 6. Repository Layout

- `SKILL.md`: agent-facing skill instructions
- `references/workflow.md`: troubleshooting notes
- `scripts/run-mj.js`: runtime launcher (auto bun/node)
- `scripts/mj-browser.ts`: CLI logic
- `scripts/mj-selectors.ts`: selector discovery
- `scripts/cdp.ts`: CDP and Chrome orchestration

## 7. Notes

- Stable default flow does not auto-download images.
- Download is experimental and opt-in via `--experimental-download`.
- Browser window is kept open after task completion.

## 8. Output

- Images: `001_a.png`, `001_b.png`, ...
- Report: `_report.json`

## Disclaimer

Use this project in compliance with Midjourney/Niji Journey terms and local laws.
UI automation may break when the website changes.
