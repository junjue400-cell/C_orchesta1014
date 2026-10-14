import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runOutlineWorkflow } from './src/orchestrator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const curriculum = JSON.parse(await readFile(path.join(here, 'curriculum-ch02.json'), 'utf8'));
const outline = await runOutlineWorkflow({
  theme: '校园活动',
  audience: '活动参与者',
  need: '活动时间和地点经常变化，希望信息卡更容易更新。',
  fields: '活动日期、地点、人数',
  limit: '',
}, curriculum);

const rows = outline.alignment.map((row) => `| ${row.goalId} ${row.goal} | ${row.activityIds.join('、')} | ${row.evidencePlan.join('；')} | ${row.criteria.join('；')} |`);
const md = [
  `# ${outline.project.title}`, '',
  `**章节：**${outline.chapter.name}`, `**学生需求：**${outline.request.need}`,
  `**使用者：**${outline.project.audience}`, `**驱动问题：**${outline.project.drivingQuestion}`, '',
  '## 阶段任务', '',
  ...outline.stages.flatMap((stage) => [
    `### ${stage.id} ${stage.title}`, '', stage.studentAction, '',
    `**阶段成果：**${stage.artifacts.join('；')}`, `**关联目标：**${stage.goalIds.join('、')}`, '',
  ]),
  '## 目标—活动—证据对齐', '',
  '| 学习目标 | 活动 | 计划收集的证据 | 判断标准 |',
  '| --- | --- | --- | --- |', ...rows, '',
  '## 教学边界', '', ...outline.project.constraints.map((item) => `- ${item}`), '',
  `> ${outline.note}`, '',
];
await writeFile(path.join(here, '第二章样例大纲.json'), `${JSON.stringify(outline, null, 2)}\n`, 'utf8');
await writeFile(path.join(here, '第二章样例大纲.md'), md.join('\n'), 'utf8');
console.log('已生成第二章样例大纲 JSON 和 Markdown。');
