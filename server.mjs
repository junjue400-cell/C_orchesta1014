import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOutline } from './outline.mjs';
import { runOutlineWorkflow } from './src/orchestrator.mjs';
import { createDeepSeekClient, DeepSeekError } from './src/deepseek-client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const curriculum = JSON.parse(await readFile(path.join(here, 'curriculum-ch02.json'), 'utf8'));
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
const port = Number(process.env.PORT || 8765);

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

export function createHandler(model = null) {
return async function handleRequest(req, res) {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'POST' && (pathname === '/api/generate' || pathname === '/api/validate')) {
      const parts = [];
      let bytes = 0;
      for await (const part of req) {
        bytes += part.length;
        if (bytes > 20_000) { send(res, 413, { error: '输入过长' }); return; }
        parts.push(part);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch { send(res, 400, { error: '需求格式不正确' }); return; }
      try {
        send(res, 200, pathname === '/api/generate'
          ? await runOutlineWorkflow(input, curriculum, { model })
          : validateOutline(input.outline, curriculum));
      }
      catch (error) { send(res, error instanceof DeepSeekError ? 502 : 400, { error: error.message }); }
      return;
    }
    if (req.method === 'GET' && files.has(pathname)) {
      const [filename, type] = files.get(pathname);
      send(res, 200, await readFile(path.join(here, filename), 'utf8'), type);
      return;
    }
    send(res, 404, { error: '未找到页面' });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: '服务器处理失败' });
  }
};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const model = process.env.DEEPSEEK_API_KEY ? createDeepSeekClient() : null;
  http.createServer(createHandler(model)).listen(port, '127.0.0.1', () => console.log(`C_orchestra：http://127.0.0.1:${port}（${model ? 'DeepSeek API' : '离线模式'}）`));
}
