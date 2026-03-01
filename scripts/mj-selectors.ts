/**
 * MJ 网页元素查找策略
 * 应对 React SPA 选择器变化，使用多层策略查找页面元素
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { type ChromeSession, evaluate, sleep } from './cdp.ts';

const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.selector-cache.json');

interface SelectorCache {
  promptInput?: string;
  updatedAt?: string;
}

function loadCache(): SelectorCache {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveCache(cache: SelectorCache): void {
  try {
    cache.updatedAt = new Date().toISOString();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

/**
 * 在页面中执行 JS 查找元素，返回是否找到
 */
async function trySelector(session: ChromeSession, jsExpression: string): Promise<boolean> {
  const found = await evaluate<boolean>(session, `
    (function() {
      try {
        const el = ${jsExpression};
        return el !== null && el !== undefined;
      } catch { return false; }
    })()
  `);
  return found === true;
}

/**
 * 查找提示词输入框
 * 多层策略：语义选择器 → 属性匹配 → DOM 遍历
 */
export async function findPromptInput(session: ChromeSession): Promise<string | null> {
  const cache = loadCache();

  // 先尝试缓存的选择器
  if (cache.promptInput) {
    const works = await trySelector(session, cache.promptInput);
    if (works) {
      console.log('[selectors] Using cached prompt input selector');
      return cache.promptInput;
    }
    console.log('[selectors] Cached selector expired, re-discovering...');
  }

  // 策略列表：每个是一段 JS 表达式，返回元素或 null
  const strategies: Array<{ name: string; expression: string }> = [
    // 第一层：语义选择器
    {
      name: 'textarea',
      expression: `document.querySelector('textarea[placeholder]')`,
    },
    {
      name: 'textbox role',
      expression: `document.querySelector('[role="textbox"]')`,
    },
    {
      name: 'contenteditable',
      expression: `document.querySelector('[contenteditable="true"]')`,
    },
    // 第二层：属性匹配
    {
      name: 'placeholder contains imagine',
      expression: `document.querySelector('[placeholder*="imagine" i]') || document.querySelector('[placeholder*="Imagine" i]')`,
    },
    {
      name: 'placeholder contains prompt',
      expression: `document.querySelector('[placeholder*="prompt" i]')`,
    },
    {
      name: 'placeholder contains describe',
      expression: `document.querySelector('[placeholder*="describe" i]')`,
    },
    {
      name: 'class contains prompt',
      expression: `document.querySelector('[class*="prompt" i]')`,
    },
    // 第三层：DOM 遍历 — 在页面顶部区域查找可输入元素
    {
      name: 'top area input-like element',
      expression: `(function() {
        // 查找页面上部区域的 textarea 或 contenteditable 元素
        const candidates = [
          ...document.querySelectorAll('textarea'),
          ...document.querySelectorAll('[contenteditable="true"]'),
          ...document.querySelectorAll('input[type="text"]'),
        ];
        for (const el of candidates) {
          const rect = el.getBoundingClientRect();
          // 在视口上半部分、有合理宽度的输入元素
          if (rect.top < window.innerHeight * 0.5 && rect.width > 200) {
            return el;
          }
        }
        return null;
      })()`,
    },
  ];

  for (const strategy of strategies) {
    const found = await trySelector(session, strategy.expression);
    if (found) {
      console.log(`[selectors] Found prompt input via: ${strategy.name}`);
      cache.promptInput = strategy.expression;
      saveCache(cache);
      return strategy.expression;
    }
  }

  console.log('[selectors] Could not find prompt input with any strategy');
  return null;
}

/**
 * 点击找到的输入框并聚焦
 */
export async function focusPromptInput(session: ChromeSession, selectorExpr: string): Promise<void> {
  await evaluate(session, `
    (function() {
      const el = ${selectorExpr};
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.focus();
        el.click();
      }
    })()
  `);
  await sleep(300);
}

/**
 * 清空输入框内容
 */
export async function clearPromptInput(session: ChromeSession, selectorExpr: string): Promise<void> {
  const selectAllModifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  // 先 focus 输入框
  await evaluate(session, `
    (function() {
      const el = ${selectorExpr};
      if (el) { el.focus(); el.click(); }
    })()
  `);
  await sleep(100);

  // 用 SelectAll + Backspace 删除，兼容 React 组件
  await sendKey(session, 'a', [selectAllModifier]);
  await sleep(50);
  await sendKey(session, 'Backspace', []);
  await sleep(100);

  // 再确认一次，防止残留
  await sendKey(session, 'a', [selectAllModifier]);
  await sleep(50);
  await sendKey(session, 'Backspace', []);
  await sleep(100);
}

/**
 * 检测是否已登录
 * 通过检查页面上是否有登录相关按钮/链接来判断
 */
export async function isLoggedIn(session: ChromeSession): Promise<boolean> {
  const result = await evaluate<boolean>(session, `
    (function() {
      // 如果页面有"Sign In"或"Log In"按钮，说明未登录
      const signInButtons = document.querySelectorAll('a, button');
      for (const btn of signInButtons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text === 'sign in' || text === 'log in' || text === 'login' || text === 'sign up') {
          return false;
        }
      }
      // 如果能找到输入框或生成相关的 UI，说明已登录
      const hasInput = document.querySelector('textarea') ||
                       document.querySelector('[contenteditable="true"]') ||
                       document.querySelector('[role="textbox"]');
      return hasInput !== null;
    })()
  `);
  return result === true;
}

/**
 * 获取当前页面上最新生成的图片组的数量（用于跟踪新生成）
 */
export async function getImageGroupCount(session: ChromeSession): Promise<number> {
  const count = await evaluate<number>(session, `
    (function() {
      // MJ 页面中的图片网格/任务数量
      // 查找包含生成图片的容器
      const jobs = document.querySelectorAll('[class*="jobContainer"], [class*="job-container"], [class*="imageGrid"], [class*="image-grid"]');
      if (jobs.length > 0) return jobs.length;
      // 备用：计算页面上较大的图片数量（排除 UI 图标）
      const imgs = document.querySelectorAll('img');
      let count = 0;
      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        if (rect.width > 150 && rect.height > 150) count++;
      }
      return Math.floor(count / 4); // 每组4张
    })()
  `);
  return count ?? 0;
}

/**
 * 获取生成状态文字
 * 在页面中搜索 niji/MJ 实际显示的状态文字：
 *   "submitting" — 已提交但还没开始
 *   "starting" — 开始生成
 *   "XX% complete" — 生成进度
 *   null — 没有在生成
 */
export async function getGenerationStatus(session: ChromeSession): Promise<string | null> {
  const status = await evaluate<string | null>(session, `
    (function() {
      // 获取页面所有文本，搜索关键状态词
      // 遍历叶子节点找状态文字（更精确）
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const statusPatterns = [
        /submitting/i,
        /starting/i,
        /\\d{1,3}%\\s*complete/i,
        /queued/i,
        /waiting/i,
      ];
      let node;
      while (node = walker.nextNode()) {
        const text = (node.textContent || '').trim();
        if (!text) continue;
        for (const pattern of statusPatterns) {
          const match = text.match(pattern);
          if (match) return match[0].toLowerCase();
        }
      }
      return null;
    })()
  `);
  return status;
}

/**
 * 检测是否正在生成中
 * 基于页面上的实际状态文字判断
 */
export async function isGenerating(session: ChromeSession): Promise<boolean> {
  const status = await getGenerationStatus(session);
  return status !== null;
}

/**
 * 获取最新生成的图片 URL
 * 查找页面中最新一组（通常4张）图片的 CDN URL
 */
export async function getImageUrls(session: ChromeSession): Promise<string[]> {
  const urls = await evaluate<string[]>(session, `
    (function() {
      const urls = [];
      const imgs = document.querySelectorAll('img');
      const candidates = [];

      for (const img of imgs) {
        const src = img.src || img.getAttribute('src') || '';
        const rect = img.getBoundingClientRect();

        // 只要较大的图片（排除头像、图标等）
        if (rect.width > 100 && rect.height > 100 && src.startsWith('http')) {
          candidates.push({
            src,
            top: rect.top + window.scrollY,
            el: img
          });
        }
      }

      // 按页面位置排序，取最底部的一组（最新生成的）
      candidates.sort((a, b) => b.top - a.top);

      // 取最新的4张（一组）
      const latest = candidates.slice(0, 4);
      for (const c of latest) {
        // 尝试获取最高分辨率的 URL
        let url = c.src;
        // 如果是缩略图 URL，尝试替换为原图 URL
        url = url.replace(/_\\d+x\\d+\\./, '.').replace(/\\?width=\\d+/, '');
        urls.push(url);
      }

      return urls;
    })()
  `);
  return urls ?? [];
}

/**
 * 获取特定任务/job 的图片 URL（通过在页面中查找）
 */
export async function getLatestJobImageUrls(session: ChromeSession): Promise<string[]> {
  const urls = await evaluate<string[]>(session, `
    (function() {
      const urls = [];

      // 策略1：查找 job 容器内的图片
      const jobContainers = document.querySelectorAll('[class*="job"], [class*="Job"], [class*="task"], [class*="Task"]');
      if (jobContainers.length > 0) {
        const lastJob = jobContainers[jobContainers.length - 1];
        const imgs = lastJob.querySelectorAll('img');
        for (const img of imgs) {
          const src = img.src || '';
          if (src.startsWith('http') && img.getBoundingClientRect().width > 50) {
            urls.push(src);
          }
        }
        if (urls.length > 0) return urls;
      }

      // 策略2：查找页面底部区域的大图片
      const allImgs = [...document.querySelectorAll('img')];
      const largeImgs = allImgs.filter(img => {
        const rect = img.getBoundingClientRect();
        const src = img.src || '';
        return rect.width > 100 && rect.height > 100 && src.startsWith('http');
      });

      // 按 DOM 顺序，取最后一组
      const lastGroup = largeImgs.slice(-4);
      for (const img of lastGroup) {
        urls.push(img.src);
      }

      return urls;
    })()
  `);
  return urls ?? [];
}

const KEY_CODES: Record<string, { code: string; keyCode: number }> = {
  'a': { code: 'KeyA', keyCode: 65 },
  'Backspace': { code: 'Backspace', keyCode: 8 },
  'Enter': { code: 'Enter', keyCode: 13 },
};

async function sendKey(session: ChromeSession, key: string, modifiers: string[]): Promise<void> {
  const info = KEY_CODES[key] ?? { code: key, keyCode: 0 };
  let mod = 0;
  if (modifiers.includes('Alt')) mod |= 1;
  if (modifiers.includes('Control')) mod |= 2;
  if (modifiers.includes('Meta')) mod |= 4;
  if (modifiers.includes('Shift')) mod |= 8;
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key, code: info.code, windowsVirtualKeyCode: info.keyCode, modifiers: mod,
  }, { sessionId: session.sessionId });
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key, code: info.code, windowsVirtualKeyCode: info.keyCode, modifiers: mod,
  }, { sessionId: session.sessionId });
}

/**
 * 提交提示词（按回车键）
 */
export async function submitPrompt(session: ChromeSession): Promise<void> {
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
  }, { sessionId: session.sessionId });
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
  }, { sessionId: session.sessionId });
}

/**
 * 诊断模式：检查各项状态
 */
export async function diagnose(session: ChromeSession): Promise<{
  loggedIn: boolean;
  promptInputFound: boolean;
  promptInputStrategy: string | null;
  imageCount: number;
  isGenerating: boolean;
  pageTitle: string;
  pageUrl: string;
}> {
  const pageTitle = await evaluate<string>(session, 'document.title') ?? '';
  const pageUrl = await evaluate<string>(session, 'window.location.href') ?? '';
  const loggedIn = await isLoggedIn(session);
  const inputExpr = await findPromptInput(session);
  const imgCount = await getImageGroupCount(session);
  const generating = await isGenerating(session);

  return {
    loggedIn,
    promptInputFound: inputExpr !== null,
    promptInputStrategy: inputExpr,
    imageCount: imgCount,
    isGenerating: generating,
    pageTitle,
    pageUrl,
  };
}
