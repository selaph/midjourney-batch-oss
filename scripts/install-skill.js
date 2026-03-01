#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SKILL_DIR_NAME = 'midjourney-batch';

function usage() {
  console.log(`
Usage:
  midjourney-batch-oss install [--target codex|claude] [--dest <path>] [--force] [--dry-run]
  midjourney-batch-oss --help

Examples:
  npx midjourney-batch-oss@latest install --target codex
  npx midjourney-batch-oss@latest install --target claude
  npx midjourney-batch-oss@latest install --dest "D:\\custom\\skills\\midjourney-batch" --force
`);
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function getOption(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return '';
  if (idx + 1 >= args.length) return '';
  return args[idx + 1];
}

function resolveTargetHome(target) {
  const home = os.homedir();
  if (target === 'codex') return path.join(home, '.codex', 'skills', SKILL_DIR_NAME);
  if (target === 'claude') return path.join(home, '.claude', 'skills', SKILL_DIR_NAME);
  return '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copySkill(fromDir, toDir) {
  fs.cpSync(fromDir, toDir, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(fromDir, src);
      if (!rel) return true;
      if (rel === '.git') return false;
      if (rel.startsWith(`${'.git'}${path.sep}`)) return false;
      if (rel === 'node_modules') return false;
      if (rel.startsWith(`node_modules${path.sep}`)) return false;
      if (rel === 'runs') return false;
      if (rel.startsWith(`runs${path.sep}`)) return false;
      if (rel === '.selector-cache.json') return false;
      if (rel === '.mj-browser-config.json') return false;
      if (rel === '.cdp-port') return false;
      return true;
    },
  });
}

function runInstall(args) {
  const target = (getOption(args, '--target') || 'codex').toLowerCase();
  const explicitDest = getOption(args, '--dest');
  const force = hasFlag(args, '--force');
  const dryRun = hasFlag(args, '--dry-run');

  const dest = explicitDest || resolveTargetHome(target);
  if (!dest) {
    console.error('[install] Invalid target. Use --target codex or --target claude, or pass --dest <path>.');
    process.exit(1);
  }

  const sourceAbs = path.resolve(PROJECT_ROOT);
  const destAbs = path.resolve(dest);
  if (destAbs === sourceAbs || destAbs.startsWith(`${sourceAbs}${path.sep}`)) {
    console.error(`[install] Invalid destination: ${dest}`);
    console.error('[install] Destination cannot be inside the current repository path.');
    process.exit(1);
  }

  const parent = path.dirname(dest);
  if (!dryRun) ensureDir(parent);

  if (fs.existsSync(dest)) {
    if (!force) {
      console.error(`[install] Destination already exists: ${dest}`);
      console.error('[install] Re-run with --force to overwrite.');
      process.exit(1);
    }
    if (!dryRun) fs.rmSync(dest, { recursive: true, force: true });
  }

  if (!dryRun) {
    copySkill(PROJECT_ROOT, dest);
  }

  console.log(`[install] ${dryRun ? 'Would install' : 'Installed'} skill to: ${dest}`);
  console.log('[install] Restart your CLI session to load the new skill.');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const help = hasFlag(args, '--help') || hasFlag(args, '-h');

  if (help || args.length === 0) {
    usage();
    process.exit(0);
  }

  if (command === 'install') {
    runInstall(args);
    process.exit(0);
  }

  console.error(`[install] Unknown command: ${command}`);
  usage();
  process.exit(1);
}

main();
