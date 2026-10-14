const form = document.getElementById('requestForm');
const result = document.getElementById('result');
const generateButton = document.getElementById('generateButton');
let outline = null;

async function requestGenerate(request) {
  if (window.OUTLINE_API) return window.OUTLINE_API.generate(request);
  const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '生成失败');
  return data;
}

async function requestValidate(data) {
  if (window.OUTLINE_API) return window.OUTLINE_API.validate(data);
  const response = await fetch('/api/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outline: data }) });
  const checked = await response.json();
  if (!response.ok) throw new Error(checked.error || '校验失败');
  return checked;
}

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};
const add = (parent, ...children) => children.forEach((child) => parent.append(child));
const list = (items) => {
  const ul = el('ul', null, 'list');
  items.forEach((item) => add(ul, el('li', item)));
  return ul;
};
const section = (title) => {
  const node = el('section');
  add(node, el('h3', title));
  return node;
};
function editable(parent, label, value, change, multi = false) {
  const wrap = el('div', null, 'editable');
  const control = el(multi ? 'textarea' : 'input');
  control.value = value;
  if (multi) control.rows = 3;
  control.addEventListener('input', () => { change(control.value); markDirty(); });
  add(wrap, el('label', label), control);
  add(parent, wrap);
}
function markDirty() {
  const state = document.getElementById('checkState');
  if (state) { state.textContent = '已修改，请重新校验'; state.className = 'status'; }
}
function download(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = el('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const mdCell = (value) => String(value).replaceAll('|', '｜').replaceAll('\n', ' ');
function asMarkdown(data) {
  const lines = [
    `# ${data.project.title}`, '',
    `章节：${data.chapter.name}`, `需求：${data.request.need}`, `使用者：${data.project.audience}`, '',
    `**驱动问题：**${data.project.drivingQuestion}`, '',
    '## 阶段任务', '',
  ];
  data.stages.forEach((stage) => lines.push(`### ${stage.id} ${stage.title}`, '', stage.studentAction, '', `阶段成果：${stage.artifacts.join('；')}`, `关联目标：${stage.goalIds.join('、')}`, ''));
  lines.push('## 目标—活动—证据对齐', '', '| 学习目标 | 活动 | 计划收集的证据 | 判断标准 |', '| --- | --- | --- | --- |');
  data.alignment.forEach((row) => lines.push(`| ${mdCell(`${row.goalId} ${row.goal}`)} | ${mdCell(row.activityIds.join('、'))} | ${mdCell(row.evidencePlan.join('；'))} | ${mdCell(row.criteria.join('；'))} |`));
  lines.push('', '## 本章边界', '', ...data.project.constraints.map((item) => `- ${item}`), '', `> ${data.note}`);
  if (data.warnings.length) lines.push('', '## 待后续章节处理', '', ...data.warnings.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}
function render() {
  result.replaceChildren(el('h2', '第二章项目大纲'));
  const meta = el('div', null, 'meta');
  add(meta, el('span', 'CH02 基本数据类型', 'chip'), el('span', outline.sourceStatus, 'chip'), el('span', outline.workflow?.mode === 'deepseek' ? 'DeepSeek 项目编排' : '离线流程样例', 'chip'));
  add(result, meta);
  if (outline.workflow?.trace) {
    const workflow = el('details');
    add(workflow, el('summary', '查看组件调用记录'));
    add(workflow, list(outline.workflow.trace.map((step) => `${step.name}（${step.kind === 'agent' ? 'Agent' : '工具'}）：${step.status}`)));
    add(workflow, el('p', outline.workflow.description, 'small'));
    add(result, workflow);
  }
  const top = section('项目概述');
  editable(top, '项目名称', outline.project.title, (value) => outline.project.title = value);
  editable(top, '驱动问题', outline.project.drivingQuestion, (value) => outline.project.drivingQuestion = value, true);
  add(top, el('p', `受众：${outline.project.audience}`), el('p', `建议字段：${outline.project.fieldSuggestion}`), el('p', `成果：${outline.project.deliverables.join('；')}`));
  add(result, top);

  const stages = section('项目活动与阶段成果');
  outline.stages.forEach((stage) => {
    const card = el('div', null, 'stage');
    add(card, el('strong', `${stage.id} ${stage.title}`));
    editable(card, '学生行动', stage.studentAction, (value) => stage.studentAction = value, true);
    add(card, el('p', `阶段成果：${stage.artifacts.join('；')}`), el('p', `关联目标：${stage.goalIds.join('、')}`, 'small'));
    add(stages, card);
  });
  add(result, stages);

  const alignment = section('目标—活动—证据');
  const wrap = el('div', null, 'table-wrap');
  const table = el('table');
  const head = el('tr');
  ['学习目标', '关联活动', '计划收集的证据', '判断标准'].forEach((name) => add(head, el('th', name)));
  const thead = el('thead'); add(thead, head); add(table, thead);
  const tbody = el('tbody');
  outline.alignment.forEach((row) => {
    const tr = el('tr');
    add(tr, el('td', `${row.goalId} ${row.goal}`), el('td', row.activityIds.join('、')));
    const evidence = el('td');
    editable(evidence, '证据形式（每行一项）', row.evidencePlan.join('\n'), (value) => row.evidencePlan = value.split('\n').map((v) => v.trim()).filter(Boolean), true);
    const criteria = el('td');
    editable(criteria, '判断标准（每行一项）', row.criteria.join('\n'), (value) => row.criteria = value.split('\n').map((v) => v.trim()).filter(Boolean), true);
    add(tr, evidence, criteria); add(tbody, tr);
  });
  add(table, tbody); add(wrap, table); add(alignment, wrap); add(result, alignment);

  const boundary = section('教学边界与检查');
  add(boundary, list(outline.project.constraints));
  if (outline.warnings.length) {
    const warning = el('div', null, 'callout warning');
    add(warning, el('strong', '需求中涉及后续章节内容'), list(outline.warnings));
    add(boundary, warning);
  }
  const check = el('p', outline.validation.passed ? '对齐检查通过：4个目标均有活动、证据及判断标准。' : `对齐检查未通过：${outline.validation.issues.join('；')}`, `status ${outline.validation.passed ? 'pass' : 'fail'}`);
  check.id = 'checkState'; add(boundary, check, el('p', outline.note, 'small'));
  const toolbar = el('div', null, 'toolbar');
  const verify = el('button', '重新校验', 'secondary'); verify.type = 'button';
  verify.addEventListener('click', async () => {
    try {
      const data = await requestValidate(outline);
      outline.validation = data;
      check.textContent = data.passed ? '对齐检查通过：4个目标均有活动、证据及判断标准。' : `对齐检查未通过：${data.issues.join('；')}`;
      check.className = `status ${data.passed ? 'pass' : 'fail'}`;
    } catch (error) { check.textContent = error.message; check.className = 'status fail'; }
  });
  const json = el('button', '保存 JSON', 'secondary'); json.type = 'button';
  json.addEventListener('click', () => download('C语言第二章项目大纲.json', `${JSON.stringify(outline, null, 2)}\n`, 'application/json;charset=utf-8'));
  const markdown = el('button', '导出 Markdown', 'secondary'); markdown.type = 'button';
  markdown.addEventListener('click', () => download('C语言第二章项目大纲.md', asMarkdown(outline), 'text/markdown;charset=utf-8'));
  add(toolbar, verify, json, markdown); add(boundary, toolbar); add(result, boundary);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  result.replaceChildren(el('p', '正在生成第二章项目大纲……'));
  try {
    const request = Object.fromEntries(new FormData(form));
    outline = await requestGenerate(request);
    render();
  } catch (error) { result.replaceChildren(el('p', error.message, 'fail')); }
  finally { generateButton.disabled = false; }
});
