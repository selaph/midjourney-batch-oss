# Midjourney Batch Automation

Automate Midjourney/Niji Journey batch prompt submission through Chrome CDP.

## When To Use

Use this skill when the user asks to:
- batch run prompt files on Midjourney or Niji Journey
- generate prompts and submit them in bulk
- diagnose MJ page login or selector issues
- optionally test experimental image downloading

## Workflow

### 1. Prepare prompts

Input supports markdown files with fenced code blocks (preferred) or one prompt per line.

Prompt file example:

````markdown
## 1. Prompt name
```
a detailed visual description without MJ flags
```

## 2. Prompt name
```
another visual description without MJ flags
```
````

### 2. Preview first (required)

Run without `--submit` to parse and preview prompts:

```bash
node scripts/run-mj.js \
  --prompts "<prompts_file_path>" \
  --output "<output_dir>"
```

If user wants to persist default output path for future runs:

```bash
node scripts/run-mj.js --set-default-output "<output_dir>"
```

### 3. Execute with submit

After user confirms:

```bash
node scripts/run-mj.js \
  --prompts "<prompts_file_path>" \
  --output "<output_dir>" \
  --submit
```

### 4. Report

Read `<output_dir>/_report.json` and summarize:
- total prompts
- success/failed count
- downloaded images count
- failed prompt reasons

## Common commands

Batch run:

```bash
node scripts/run-mj.js --prompts "<path>" --output "<dir>" --submit
```

Diagnose page state:

```bash
node scripts/run-mj.js --diagnose --output "<dir>"
```

Download latest image group only:

```bash
node scripts/run-mj.js --download-only --experimental-download --output "<dir>"
```

## Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--prompts <path>` | Prompt file path (markdown) | Required for batch submit/preview |
| `--output <dir>` | Output directory | `./output/<YYYY-MM-DD>` |
| `--set-default-output <dir>` | Save default output directory for future runs | unset |
| `--reset-default-output` | Clear saved default output directory | false |
| `--submit` | Actually submit prompts | false |
| `--timeout <ms>` | Per-prompt generation timeout | 120000 |
| `--delay <ms>` | Delay between prompts | 3000 |
| `--download-only` | Download latest image group from current page | false |
| `--experimental-download` | Enable experimental download behavior | false |
| `--diagnose` | Check login and selector status | false |
| `-h, --help` | Show CLI help | false |

## Environment variables

- `MJ_BROWSER_CHROME_PATH`: custom Chrome executable path.
- `MJ_BROWSER_PROFILE_DIR`: custom profile directory used by this tool.
- `MJ_BROWSER_OUTPUT_DIR`: fallback output directory (used when no saved default is set).

## First-time setup

The script uses a dedicated Chrome profile (`midjourney-browser-profile`).

1. Run diagnose or submit command.
2. Chrome opens on Niji Journey page.
3. If not logged in, log in manually.
4. Session is reused in future runs.

## Notes

- If MJ/Niji updates UI, run `--diagnose` first.
- Download flow is experimental; default batch mode does not download images.
- Keep prompts as plain descriptions. Configure MJ parameters on page settings if needed.
