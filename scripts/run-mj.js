#!/usr/bin/env node
/**
 * Runtime launcher for mj-browser.ts
 *
 * Priority:
 * 1) bun (if available)
 * 2) node --experimental-strip-types
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const mjScriptPath = path.join(__dirname, 'mj-browser.ts');
const passthroughArgs = process.argv.slice(2);

function commandExists(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore', shell: process.platform === 'win32' });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`[launcher] Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (commandExists('bun', ['--version'])) {
  run('bun', [mjScriptPath, ...passthroughArgs]);
}

if (commandExists('node', ['--version'])) {
  run('node', ['--experimental-strip-types', mjScriptPath, ...passthroughArgs]);
}

console.error(
  '[launcher] No supported runtime found. Install bun or node (v22+ recommended), then retry.',
);
process.exit(1);
