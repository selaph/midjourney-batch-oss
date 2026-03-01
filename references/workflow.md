# Midjourney Batch Workflow and Troubleshooting

## Workflow

1. Prepare prompt file (markdown code blocks recommended).
2. Run preview without `--submit`.
3. Confirm prompt parsing with the user.
4. Run with `--submit`.
5. Check `_report.json` in output directory.

Optional setup:
- Save default output directory once:
  `node scripts/run-mj.js --set-default-output "<dir>"`

## First run

1. Start with `--diagnose`.
2. Log in manually in the opened browser window.
3. Re-run submit command after login.

## Troubleshooting

### Prompt input not found

Symptom:
- `Could not find prompt input`

Actions:
1. Run `--diagnose`.
2. Delete `.selector-cache.json` in skill root and retry.
3. Update selector strategies in `scripts/mj-selectors.ts` if UI changed.

### Login timeout

Symptom:
- `Login timeout`

Actions:
1. Run again and complete login within timeout.
2. Make sure any SSO/Discord auth is already signed in.

### Generation timeout

Symptom:
- `Timeout after ...`

Actions:
1. Increase timeout (for example `--timeout 300000`).
2. Check account quota and network stability.

### No images downloaded

Symptom:
- generation completed but zero downloaded files

Actions:
1. Confirm you enabled `--experimental-download`.
2. Make sure latest job cards are visible on current page.
3. Try `node scripts/run-mj.js --download-only --experimental-download` after the job appears.
4. If still empty, inspect URL extraction logic in `getLatestJobImageUrls`.

### Chrome not found

Symptom:
- `Chrome not found`

Actions:
1. Set environment variable `MJ_BROWSER_CHROME_PATH`.
2. Example (PowerShell):
   `$env:MJ_BROWSER_CHROME_PATH='C:\Path\To\chrome.exe'`

### Debug port not ready / profile in use

Symptom:
- `Chrome exited before debug port was ready`

Actions:
1. Close Chrome windows using the same automation profile.
2. Retry the command.
3. If needed, switch profile directory:
   `$env:MJ_BROWSER_PROFILE_DIR='D:\tmp\mj-profile-alt'`

## Prompt file formats

Preferred markdown format:

````markdown
## 1. Card back idea
```
A delicate white flower pattern card back design
```

## 2. Card back idea
```
A mystical blue starry night card back design
```
````

Simple line format:

```text
A flower pattern card back
A starry night card back
A forest theme card back
```

## File naming

Downloaded files are named by prompt order:
- `001_a.png`, `001_b.png`, ...
- `002_a.png`, `002_b.png`, ...

Report file:
- `_report.json`
