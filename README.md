# Midjourney Batch Automation Skill

Chrome CDP based automation for Midjourney/Niji Journey batch prompt execution.

This fork is designed to be portable and open-source friendly:
- no user-specific absolute paths
- cross-platform profile/cache handling
- consistent report output (`_report.json`)
- docs aligned with actual script behavior

## Features

- Preview prompt files before submit
- Batch submit prompts with delay/timeout controls
- Diagnose login and selector health
- Persist default output directory setting
- Experimental image download mode (opt-in)
- Persist execution report in JSON

## Repository layout

- `SKILL.md`: agent-facing skill instructions
- `references/workflow.md`: troubleshooting and workflow notes
- `scripts/mj-browser.ts`: CLI entrypoint
- `scripts/run-mj.js`: runtime launcher (auto bun/node)
- `scripts/mj-browser.ts`: CLI logic
- `scripts/mj-selectors.ts`: selector discovery and page probing
- `scripts/cdp.ts`: CDP connection and Chrome launch

## Requirements

- Bun runtime or Node.js 22+
- Chrome or Chromium
- Valid Midjourney/Niji Journey web login

## Quick start

1. Preview prompts:

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>"
```

2. Submit prompts:

```bash
node scripts/run-mj.js --prompts "<path/to/prompts.md>" --output "<output_dir>" --submit
```

3. Diagnose:

```bash
node scripts/run-mj.js --diagnose --output "<output_dir>"
```

4. Save a default output directory (optional):

```bash
node scripts/run-mj.js --set-default-output "<output_dir>"
```

5. Experimental: download latest image group only:

```bash
node scripts/run-mj.js --download-only --experimental-download --output "<output_dir>"
```

## Prompt formats

Preferred markdown code-block format:

````markdown
## 1. Prompt title
```
cinematic portrait of a traveler in rainy neon street
```
````

Fallback simple line format:

```text
cinematic portrait of a traveler in rainy neon street
minimalist product shot, soft studio light, white background
```

## Environment variables

- `MJ_BROWSER_CHROME_PATH`: custom Chrome executable path
- `MJ_BROWSER_PROFILE_DIR`: custom Chrome profile directory for this tool
- `MJ_BROWSER_OUTPUT_DIR`: fallback output directory if no saved default exists

## Stable vs experimental

- Stable default: prompt submit + report output.
- Experimental: add `--experimental-download` to enable download logic.
- Without `--experimental-download`, submit runs do not download images.

## Runtime behavior

- `node scripts/run-mj.js ...` is the recommended entrypoint.
- Launcher prefers `bun` if available.
- If `bun` is unavailable, launcher falls back to `node --experimental-strip-types`.

## Output

Generated files are written to output directory:
- images: `001_a.png`, `001_b.png`, ...
- report: `_report.json`

## Disclaimer

Use this project in compliance with Midjourney/Niji Journey terms and local laws.
UI automation can break when the website changes.
