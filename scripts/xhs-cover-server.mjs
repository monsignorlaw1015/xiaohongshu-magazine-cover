import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, '..');
export const runtimeRoot = path.resolve(process.env.XHS_COVER_RUNTIME_HOME || process.cwd());
export const dataDir = path.join(runtimeRoot, 'data');
export const outputDir = path.join(runtimeRoot, 'outputs');
export const favoritesFilePath = path.join(dataDir, 'favorites.json');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

async function ensureProjectState() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  try {
    await fs.access(favoritesFilePath);
  } catch (error) {
    await fs.writeFile(favoritesFilePath, '[]\n', 'utf8');
  }
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > 25 * 1024 * 1024) {
      throw new Error('请求体过大');
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function sanitizeFavorites(favorites) {
  if (!Array.isArray(favorites)) {
    return [];
  }

  return favorites.filter((item) => item && typeof item === 'object' && item.id && item.config);
}

export async function readFavorites() {
  await ensureProjectState();

  try {
    const raw = await fs.readFile(favoritesFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeFavorites(parsed);
  } catch (error) {
    return [];
  }
}

export async function writeFavorites(favorites) {
  await ensureProjectState();
  const normalizedFavorites = sanitizeFavorites(favorites);
  await fs.writeFile(favoritesFilePath, `${JSON.stringify(normalizedFavorites, null, 2)}\n`, 'utf8');
  return normalizedFavorites;
}

function sanitizeFilePart(value = '') {
  const normalized = String(value)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'cover';
}

function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeRenderedImage({ imageDataUrl, filenameHint = '', metadata = {} }) {
  await ensureProjectState();

  const match = String(imageDataUrl || '').match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error('只支持 PNG data URL');
  }

  const fileName = `${createTimestamp()}-${sanitizeFilePart(filenameHint)}.png`;
  const absolutePath = path.join(outputDir, fileName);
  const imageBuffer = Buffer.from(match[1], 'base64');
  await fs.writeFile(absolutePath, imageBuffer);

  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length) {
    const metadataPath = absolutePath.replace(/\.png$/i, '.json');
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  }

  return {
    filePath: absolutePath,
    relativePath: path.relative(projectRoot, absolutePath)
  };
}

async function serveStaticFile(requestPath, response) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const candidatePath = path.resolve(projectRoot, `.${decodedPath}`);

  if (!candidatePath.startsWith(projectRoot)) {
    json(response, 403, { error: '禁止访问该路径' });
    return;
  }

  try {
    const fileBuffer = await fs.readFile(candidatePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(candidatePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(fileBuffer);
  } catch (error) {
    json(response, 404, { error: '文件不存在' });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api/health') {
    json(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/favorites') {
    if (request.method === 'GET') {
      json(response, 200, { favorites: await readFavorites() });
      return;
    }

    if (request.method === 'PUT') {
      try {
        const body = await readRequestBody(request);
        const payload = JSON.parse(body || '{}');
        const favorites = await writeFavorites(payload.favorites);
        json(response, 200, { favorites });
      } catch (error) {
        json(response, 400, { error: error.message || '收藏写入失败' });
      }
      return;
    }
  }

  if (url.pathname === '/api/render' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || '{}');
      const renderResult = await writeRenderedImage(payload);
      json(response, 200, renderResult);
    } catch (error) {
      json(response, 400, { error: error.message || '图片写入失败' });
    }
    return;
  }

  await serveStaticFile(url.pathname, response);
}

export async function startServer(options = {}) {
  await ensureProjectState();

  const host = options.host || '127.0.0.1';
  const port = Number(options.port || 4567);
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      json(response, 500, { error: error.message || '服务内部错误' });
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

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

if (process.argv[1] === __filename) {
  const args = parseCliArgs(process.argv.slice(2));
  const server = await startServer({
    host: args.host || process.env.XHS_COVER_HOST || '127.0.0.1',
    port: args.port || process.env.XHS_COVER_PORT || '4567'
  });

  console.log(`XHS cover server running at ${server.url}`);
}
