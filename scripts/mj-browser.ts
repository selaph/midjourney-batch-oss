#!/usr/bin/env bun
/**
 * Midjourney / Niji Journey batch automation script.
 *
 * Stable defaults:
 * - Preview prompts by default
 * - Submit prompts only with --submit
 * - Download is experimental and disabled by default
 * - Writes _report.json to output directory
 */

import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { launchChrome, getPageSession, sleep, typeText, evaluate, type ChromeSession } from './cdp.ts';
import {
  findPromptInput,
  focusPromptInput,
  clearPromptInput,
  isLoggedIn,
  getGenerationStatus,
  getLatestJobImageUrls,
  submitPrompt,
  diagnose,
} from './mj-selectors.ts';

interface CliOptions {
  promptsFile: string;
  outputArg: string;
  outputDir: string;
  submit: boolean;
  timeoutMs: number;
  delayMs: number;
  downloadOnly: boolean;
  diagnoseMode: boolean;
  experimentalDownload: boolean;
  setDefaultOutput: string;
  resetDefaultOutput: boolean;
  help: boolean;
}

interface ToolConfig {
  defaultOutputDir?: string;
  updatedAt?: string;
}

interface PromptResult {
  index: number;
  prompt: string;
  success: boolean;
  images: string[];
  error?: string;
}

interface RunReport {
  mode: 'preview' | 'submit' | 'download-only' | 'diagnose';
  startedAt: string;
  finishedAt: string;
  promptsTotal: number;
  successCount: number;
  failedCount: number;
  totalImagesDownloaded: number;
  outputDir: string;
  experimentalDownload: boolean;
  results: PromptResult[];
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function configFilePath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.mj-browser-config.json');
}

function loadConfig(): ToolConfig {
  try {
    const file = configFilePath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as ToolConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveConfig(config: ToolConfig): void {
  const next: ToolConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configFilePath(), `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
}

function deleteConfig(): void {
  const file = configFilePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function resolveOutputDir(outputArg: string, config: ToolConfig): string {
  if (outputArg) return outputArg;
  if (config.defaultOutputDir && config.defaultOutputDir.trim()) return config.defaultOutputDir.trim();

  const envDir = process.env.MJ_BROWSER_OUTPUT_DIR?.trim();
  if (envDir) return envDir;

  return path.join(process.cwd(), 'output', todayYmd());
}

function printUsage(): void {
  console.log(`
Usage:
  node scripts/run-mj.js --prompts <path> [--output <dir>] [--submit] [--timeout <ms>] [--delay <ms>]
  node scripts/run-mj.js --diagnose [--output <dir>]
  node scripts/run-mj.js --download-only --experimental-download [--output <dir>]

Config commands:
  node scripts/run-mj.js --set-default-output <dir>
  node scripts/run-mj.js --reset-default-output

Options:
  --prompts <path>            Prompt markdown file path.
  --output <dir>              Output directory for this run only.
  --set-default-output <dir>  Persist default output directory for future runs.
  --reset-default-output      Remove saved default output directory.
  --submit                    Actually submit prompts (without this flag, preview only).
  --timeout <ms>              Timeout per prompt generation. Default: 120000.
  --delay <ms>                Delay between prompts. Default: 3000.
  --diagnose                  Check login status and selector discovery.
  --download-only             Download latest available image group from page.
  --experimental-download     Enable experimental download behavior.
  -h, --help                  Show this help.
`);
}

function parseIntOption(raw: string | undefined, fallback: number, min: number, name: string): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`Invalid ${name}: ${raw}. Expected integer >= ${min}.`);
  }
  return value;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : '';
  };
  const has = (flag: string): boolean => args.includes(flag);

  const config = loadConfig();
  const outputArg = get('--output').trim();

  return {
    promptsFile: get('--prompts').trim(),
    outputArg,
    outputDir: resolveOutputDir(outputArg, config),
    submit: has('--submit'),
    timeoutMs: parseIntOption(get('--timeout') || undefined, 120_000, 1_000, '--timeout'),
    delayMs: parseIntOption(get('--delay') || undefined, 3_000, 0, '--delay'),
    downloadOnly: has('--download-only'),
    diagnoseMode: has('--diagnose'),
    experimentalDownload: has('--experimental-download'),
    setDefaultOutput: get('--set-default-output').trim(),
    resetDefaultOutput: has('--reset-default-output'),
    help: has('--help') || has('-h'),
  };
}

function parsePrompts(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const prompts: string[] = [];

  const codeBlockRegex = /```(?:[^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.length > 0) prompts.push(text);
  }

  if (prompts.length === 0) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        prompts.push(trimmed);
      }
    }
  }

  return prompts;
}

async function ensureOutputDir(outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
}

async function downloadImage(url: string, savePath: string, session?: ChromeSession): Promise<boolean> {
  try {
    if (session) {
      const base64 = await evaluate<string>(session, `
        (async function() {
          try {
            const res = await fetch(${JSON.stringify(url)});
            if (!res.ok) return 'ERR:' + res.status;
            const blob = await res.blob();
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const value = typeof reader.result === 'string' ? reader.result : '';
                resolve(value ? value.split(',')[1] : '');
              };
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return 'ERR:' + String(e);
          }
        })()
      `, 30_000);

      if (base64 && !base64.startsWith('ERR:')) {
        const buffer = Buffer.from(base64, 'base64');
        await writeFile(savePath, buffer);
        console.log(`[download] Saved: ${savePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
        return true;
      }

      console.error(`[download] Browser fetch failed for ${url}: ${base64}`);
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[download] Failed to fetch ${url}: ${res.status}`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(savePath, buffer);
    console.log(`[download] Saved: ${savePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`[download] Error downloading ${url}:`, err);
    return false;
  }
}

function getImageExtension(url: string): string {
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return ext;
  } catch {
    // Ignore and fallback.
  }
  return '.png';
}

async function waitForGeneration(session: ChromeSession, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  let sawActivity = false;
  let lastStatus = '';

  while (Date.now() - start < timeoutMs) {
    const status = await getGenerationStatus(session);
    const elapsed = Math.round((Date.now() - start) / 1000);

    if (status) {
      sawActivity = true;
      if (status !== lastStatus) {
        console.log(`[wait] ${elapsed}s - status: ${status}`);
        lastStatus = status;
      }
    } else if (sawActivity) {
      console.log(`[wait] ${elapsed}s - generation complete`);
      return true;
    } else if (elapsed > 0 && elapsed % 10 === 0) {
      console.log(`[wait] ${elapsed}s - waiting for generation to start...`);
    }

    await sleep(3000);
  }

  if (sawActivity) console.error(`[wait] Timeout after ${timeoutMs / 1000}s (generation was in progress)`);
  else console.error(`[wait] Timeout after ${timeoutMs / 1000}s (generation never started)`);
  return false;
}

async function waitForNewJobImages(
  session: ChromeSession,
  baselineUrls: Set<string>,
  timeoutMs: number,
): Promise<string[]> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const urls = await getLatestJobImageUrls(session);
    const newUrls = urls.filter((url) => !baselineUrls.has(url));
    if (newUrls.length > 0) return newUrls;
    await sleep(2000);
  }

  return [];
}

async function downloadLatestImages(
  session: ChromeSession,
  outputDir: string,
  prefix: string,
  baselineUrls?: Set<string>,
): Promise<string[]> {
  const urls = baselineUrls
    ? await waitForNewJobImages(session, baselineUrls, 20_000)
    : await getLatestJobImageUrls(session);

  const uniqueUrls = Array.from(new Set(urls));
  if (uniqueUrls.length === 0) {
    console.log('[download] No image URLs found on page.');
    return [];
  }

  const imageUrls = uniqueUrls.slice(0, 4);
  const letters = ['a', 'b', 'c', 'd'];
  const savedFiles: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const fileName = `${prefix}_${letters[i] ?? String(i + 1)}${getImageExtension(url)}`;
    const savePath = path.join(outputDir, fileName);
    const ok = await downloadImage(url, savePath, session);
    if (ok) savedFiles.push(fileName);
  }

  return savedFiles;
}

async function writeReport(outputDir: string, report: RunReport): Promise<string> {
  const reportPath = path.join(outputDir, '_report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  return reportPath;
}

function makeReport(
  mode: RunReport['mode'],
  startedAt: string,
  outputDir: string,
  experimentalDownload: boolean,
  results: PromptResult[],
): RunReport {
  const successCount = results.filter((item) => item.success).length;
  const totalImagesDownloaded = results.reduce((sum, item) => sum + item.images.length, 0);

  return {
    mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    promptsTotal: results.length,
    successCount,
    failedCount: results.length - successCount,
    totalImagesDownloaded,
    outputDir,
    experimentalDownload,
    results,
  };
}

async function runDiagnose(session: ChromeSession): Promise<void> {
  console.log('\n=== Midjourney diagnose mode ===\n');
  const result = await diagnose(session);
  console.log(`Page title: ${result.pageTitle}`);
  console.log(`Page URL: ${result.pageUrl}`);
  console.log(`Login status: ${result.loggedIn ? 'logged in' : 'not logged in'}`);
  console.log(`Prompt input found: ${result.promptInputFound ? 'yes' : 'no'}`);
  if (result.promptInputStrategy) {
    console.log(`Selector strategy: ${result.promptInputStrategy.substring(0, 80)}...`);
  }
  console.log(`Image groups: ${result.imageCount}`);
  console.log(`Generating now: ${result.isGenerating ? 'yes' : 'no'}`);
  console.log('\n=== Diagnose complete ===\n');
}

function handleConfigCommands(opts: CliOptions): boolean {
  if (opts.setDefaultOutput) {
    const next = loadConfig();
    next.defaultOutputDir = opts.setDefaultOutput;
    saveConfig(next);
    console.log(`[config] Saved default output directory: ${opts.setDefaultOutput}`);
    return true;
  }

  if (opts.resetDefaultOutput) {
    deleteConfig();
    console.log('[config] Reset default output directory config.');
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();

  let opts: CliOptions;
  try {
    opts = parseArgs();
  } catch (error) {
    console.error(String(error));
    printUsage();
    process.exit(1);
  }

  if (opts.help) {
    printUsage();
    return;
  }

  if (handleConfigCommands(opts)) {
    return;
  }

  if (opts.downloadOnly && !opts.experimentalDownload) {
    console.error('Error: --download-only is experimental. Add --experimental-download to run it.');
    process.exit(1);
  }

  if (!opts.diagnoseMode && !opts.downloadOnly) {
    if (!opts.promptsFile) {
      console.error('Error: --prompts <path> is required unless using --diagnose or --download-only.');
      process.exit(1);
    }

    if (!fs.existsSync(opts.promptsFile)) {
      console.error(`Error: File not found: ${opts.promptsFile}`);
      process.exit(1);
    }
  }

  let prompts: string[] = [];
  if (opts.promptsFile && fs.existsSync(opts.promptsFile)) {
    prompts = parsePrompts(opts.promptsFile);
    console.log(`[main] Parsed ${prompts.length} prompts from: ${opts.promptsFile}`);
    if (prompts.length === 0) {
      console.error('Error: No prompts found in file.');
      process.exit(1);
    }

    if (!opts.submit && !opts.downloadOnly && !opts.diagnoseMode) {
      console.log('\n=== Preview mode (no --submit; nothing will be sent) ===\n');
      prompts.forEach((prompt, i) => {
        console.log(`${String(i + 1).padStart(2, '0')}. ${prompt.substring(0, 120)}${prompt.length > 120 ? '...' : ''}`);
      });
      console.log(`\nOutput dir: ${opts.outputDir}`);
      console.log(`Timeout per prompt: ${opts.timeoutMs} ms`);
      console.log(`Delay between prompts: ${opts.delayMs} ms`);
      console.log(`Experimental download: ${opts.experimentalDownload ? 'enabled' : 'disabled'}`);
      return;
    }
  }

  await ensureOutputDir(opts.outputDir);

  console.log('[main] Launching Chrome...');
  const { cdp } = await launchChrome('https://nijijourney.com/imagine');

  const cleanup = (): void => {
    cdp.close();
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  try {
    await sleep(5000);

    let session: ChromeSession;
    try {
      session = await getPageSession(cdp, 'nijijourney.com');
    } catch (err) {
      console.error('[main] Failed to get page session. Is nijijourney.com loaded?');
      console.error(err);
      process.exit(1);
    }

    if (opts.diagnoseMode) {
      await runDiagnose(session);
      const report = makeReport('diagnose', startedAt, opts.outputDir, opts.experimentalDownload, []);
      const reportPath = await writeReport(opts.outputDir, report);
      console.log(`[main] Report written: ${reportPath}`);
      return;
    }

    console.log('[main] Checking login status...');
    let loggedIn = await isLoggedIn(session);

    if (!loggedIn) {
      console.log('[main] Not logged in. Please log in in the browser window.');
      console.log('[main] Waiting for login (every 5s, timeout 5min)...');

      const loginStart = Date.now();
      while (Date.now() - loginStart < 300_000) {
        await sleep(5000);
        try {
          session = await getPageSession(cdp, 'nijijourney.com');
        } catch {
          continue;
        }

        loggedIn = await isLoggedIn(session);
        if (loggedIn) break;
      }

      if (!loggedIn) {
        console.error('[main] Login timeout. Please run again after logging in.');
        process.exit(1);
      }
      console.log('[main] Login detected.');
    } else {
      console.log('[main] Already logged in.');
    }

    if (opts.downloadOnly) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const images = await downloadLatestImages(session, opts.outputDir, `download_${stamp}`);
      const result: PromptResult = {
        index: 1,
        prompt: 'download-only latest job',
        success: images.length > 0,
        images,
        error: images.length > 0 ? undefined : 'No images found on page',
      };
      const report = makeReport('download-only', startedAt, opts.outputDir, true, [result]);
      const reportPath = await writeReport(opts.outputDir, report);
      console.log(`[main] Downloaded ${images.length} image(s).`);
      console.log(`[main] Report written: ${reportPath}`);
      return;
    }

    const inputExpr = await findPromptInput(session);
    if (!inputExpr) {
      console.error('[main] Could not find prompt input. Try --diagnose to debug.');
      process.exit(1);
    }

    const results: PromptResult[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const prefix = String(i + 1).padStart(3, '0');

      console.log(`\n[main] Prompt ${i + 1}/${prompts.length}`);
      console.log(`[main] ${prompt.substring(0, 120)}${prompt.length > 120 ? '...' : ''}`);

      try {
        let baseline: Set<string> | undefined;
        if (opts.experimentalDownload) {
          baseline = new Set(await getLatestJobImageUrls(session));
        }

        await focusPromptInput(session, inputExpr);
        await clearPromptInput(session, inputExpr);
        await sleep(300);

        await typeText(session, prompt);
        await sleep(500);

        console.log('[main] Submitting prompt...');
        await submitPrompt(session);
        await sleep(2000);

        console.log('[main] Waiting for generation...');
        const completed = await waitForGeneration(session, opts.timeoutMs);

        if (!completed) {
          results.push({ index: i + 1, prompt, success: false, images: [], error: 'Timeout' });
          continue;
        }

        let images: string[] = [];
        if (opts.experimentalDownload && baseline) {
          images = await downloadLatestImages(session, opts.outputDir, prefix, baseline);
          if (images.length === 0) {
            console.log('[main] Generation completed, but no downloadable image URLs were found.');
          }
        }

        results.push({ index: i + 1, prompt, success: true, images });

        if (i < prompts.length - 1 && opts.delayMs > 0) {
          console.log(`[main] Waiting ${opts.delayMs} ms before next prompt...`);
          await sleep(opts.delayMs);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[main] Error on prompt ${i + 1}: ${errorMessage}`);
        results.push({ index: i + 1, prompt, success: false, images: [], error: errorMessage });
      }
    }

    const report = makeReport('submit', startedAt, opts.outputDir, opts.experimentalDownload, results);
    const reportPath = await writeReport(opts.outputDir, report);

    console.log('\n=== Summary ===');
    console.log(`Prompts: ${report.promptsTotal}`);
    console.log(`Success: ${report.successCount}`);
    console.log(`Failed: ${report.failedCount}`);
    console.log(`Images downloaded: ${report.totalImagesDownloaded}`);
    console.log(`Experimental download: ${report.experimentalDownload ? 'enabled' : 'disabled'}`);
    console.log(`Report: ${reportPath}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
