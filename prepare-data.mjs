import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../图谱修订_第1至2章_v1.1/第1至2章_教学对齐图谱_v1.1.json');
const target = path.join(here, 'curriculum-ch02.json');
const graph = JSON.parse(await readFile(source, 'utf8'));
const chapter = graph.chapters.find((item) => item.id === 'CH02');
const project = graph.projects.find((item) => item.id === chapter.project_id);
const goals = graph.learning_goals.filter((item) => chapter.goal_ids.includes(item.id));
const activities = graph.activities.filter((item) => project.activity_ids.includes(item.id));
const evidence = graph.evidence_specs.filter((item) => goals.some((goal) => goal.evidence_id === item.id));

if (goals.length !== 4 || activities.length !== 3 || evidence.length !== 4) {
  throw new Error('第二章目标、活动或证据数据不完整');
}

const data = {
  source: path.basename(source),
  sourceStatus: graph.review_status,
  textbookAlignment: chapter.textbook_alignment,
  chapter: { id: chapter.id, name: chapter.name },
  project,
  goals,
  activities,
  evidence,
};
await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`已生成 ${target}`);
