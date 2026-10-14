import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(path.join(here, name), 'utf8');
const [html, css, app, outlineSource, curriculumText, projectSource, orchestrationSource] = await Promise.all([
  read('index.html'), read('styles.css'), read('app.js'), read('outline.mjs'), read('curriculum-ch02.json'),
  read('src/agents/project-agent.mjs'), read('src/orchestrator.mjs'),
]);
const curriculum = JSON.parse(curriculumText);
const stripModule = (source) => source
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('export function ', 'function ')
  .replaceAll('export async function ', 'async function ')
  .replaceAll('export const ', 'const ');
const generator = [outlineSource, projectSource, orchestrationSource].map(stripModule).join('\n');
const staticAdapter = `\nconst STATIC_CURRICULUM = ${JSON.stringify(curriculum)};\nwindow.OUTLINE_API = {\n  generate: (request) => runOutlineWorkflow(request, STATIC_CURRICULUM),\n  validate: (data) => validateOutline(data, STATIC_CURRICULUM),\n};\n`;
const standalone = html
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="/app.js" defer></script>', '')
  .replace('</body>', `<script>\n${generator}\n${staticAdapter}\n${app}\n</script>\n</body>`);
await writeFile(path.join(here, '第二章大纲生成器.html'), standalone, 'utf8');
console.log('已生成可直接双击打开的第二章大纲生成器.html。');
