import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const args = parseCliArgs(process.argv.slice(2));
const port = args.port || process.env.XHS_COVER_PORT || '4567';
const serverScriptPath = path.join(__dirname, 'xhs-cover-server.mjs');
const healthUrl = `http://127.0.0.1:${port}/api/health`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureServerReady() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // keep retrying until the timeout window is over
    }
    await wait(150);
  }

  throw new Error('本地封面服务启动失败');
}

async function isServerRunning() {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch (error) {
    return false;
  }
}

if (!(await isServerRunning())) {
  const serverProcess = spawn(process.execPath, [serverScriptPath, '--port', port], {
    detached: true,
    stdio: 'ignore'
  });
  serverProcess.unref();
  await ensureServerReady();
}

const url = new URL(`http://127.0.0.1:${port}/index.html`);
url.searchParams.set('mode', 'create');

if (args.title) {
  url.searchParams.set('title', args.title);
}

if (args.subtitle) {
  url.searchParams.set('subtitle', args.subtitle);
}

if (args['print-only'] === 'true') {
  process.stdout.write(`${url.toString()}\n`);
} else {
  await execFileAsync('open', [url.toString()]);
  process.stdout.write(`已打开创建页面：${url.toString()}\n`);
}

if (process.argv[1] === __filename) {
  // no-op: keeps the file executable as a script entrypoint
}
