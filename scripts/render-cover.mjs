import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { outputDir, readFavorites, startServer } from './xhs-cover-server.mjs';

const execFileAsync = promisify(execFile);

function parseCliArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      result[key] = 'true';
      continue;
    }
    result[key] = nextValue;
    index += 1;
  }
  return result;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].filter(Boolean);

  return candidates[0];
}

async function pollAutomationResult(serverUrl, timeout = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${serverUrl}/api/automation-result`);
      const data = await response.json();
      if (data && data.status !== 'pending') {
        return data;
      }
    } catch (_) {
      // Server not ready yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('自动化渲染超时');
}

const args = parseCliArgs(process.argv.slice(2));
const mode = args.mode || 'draw';
const title = args.title || '';

if (!title.trim()) {
  throw new Error('请通过 --title 提供主标题');
}

if (mode === 'favorites') {
  const favorites = await readFavorites();
  if (!favorites.length) {
    throw new Error('当前没有可用收藏，请先创建收藏配置。');
  }

  if (args.favoriteId) {
    if (!favorites.some((favorite) => favorite.id === args.favoriteId)) {
      throw new Error(`未找到收藏：${args.favoriteId}`);
    }
  } else if (favorites.length > 1) {
    throw new Error('存在多个收藏，请通过 --favoriteId 指定要使用的收藏。');
  } else {
    args.favoriteId = favorites[0].id;
  }
}

const chromeBinary = findChromeBinary();
if (!chromeBinary) {
  throw new Error('未找到可用的 Chrome 浏览器，可通过 CHROME_BIN 指定。');
}

const server = await startServer({
  host: args.host || '127.0.0.1',
  port: args.port || '0'
});

try {
  await fs.mkdir(outputDir, { recursive: true });

  const payload = encodePayload({
    mode,
    title,
    subtitle: args.subtitle || '',
    intent: args.intent || 'all',
    favoriteId: args.favoriteId || '',
    filenameHint: `${mode}-${title}`
  });

  const automationUrl = `${server.url}/index.html?automation=1&payload=${payload}`;

  // Launch Chrome headless — page will render via Canvas API and POST result to server
  const chromeProcess = execFileAsync(chromeBinary, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--virtual-time-budget=60000',
    '--force-device-scale-factor=1',
    '--window-size=1280,1024',
    automationUrl
  ], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 90000
  });

  // Poll server for the automation result (rendered by page Canvas + uploaded via API)
  const result = await pollAutomationResult(server.url);

  if (!result.ok) {
    throw new Error(result.error || '自动化渲染失败');
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  // Wait for Chrome to finish (or let it timeout naturally)
  chromeProcess.catch(() => {});
} finally {
  await server.close();
}
