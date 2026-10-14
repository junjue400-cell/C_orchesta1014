import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import vm from 'node:vm';
import { generateOutline, validateOutline } from './outline.mjs';
import { createHandler } from './server.mjs';
import { runOutlineWorkflow } from './src/orchestrator.mjs';
import { createDeepSeekClient, DeepSeekError } from './src/deepseek-client.mjs';

const curriculum = JSON.parse(await readFile(new URL('./curriculum-ch02.json', import.meta.url), 'utf8'));
const handleRequest = createHandler(null);
const sample = generateOutline({
  theme: '校园活动', audience: '活动参与者',
  need: '活动时间和地点经常变化，希望信息卡更容易更新。',
  fields: '活动日期、地点、人数', limit: '',
}, curriculum);
assert.equal(sample.validation.passed, true);
assert.equal(sample.stages.length, 3);
assert.equal(sample.alignment.length, 4);
assert.ok(sample.alignment.every((row) => row.activityIds.length && row.evidencePlan.length && row.criteria.length));
assert.ok(sample.project.drivingQuestion.includes('活动参与者'));
const workflow = await runOutlineWorkflow(sample.request, curriculum);
assert.deepEqual(workflow.workflow.trace.map((step) => step.component), ['input-normalizer', 'project-agent', 'alignment-validator']);
assert.deepEqual(workflow.workflow.trace.map((step) => step.kind), ['tool', 'agent', 'tool']);
assert.ok(workflow.workflow.trace.every((step) => step.status === 'completed'));
assert.equal(workflow.validation.passed, true);

const modelCalls = [];
const fakeModel = {
  provider: 'deepseek', model: 'test-model',
  async completeJson(input) {
    modelCalls.push(input);
    return { data: {
      title: '校园活动：可更新的信息卡',
      drivingQuestion: '怎样让参与者及时看到准确的活动信息？',
      fieldSuggestion: '日期、地点、人数',
      stageActions: { 'A2.1': '与受众确认字段与单位，提交字段草稿。', 'A2.2': '使用变量构建信息卡并记录赋值更新与 sizeof 观察。', 'A2.3': '展示信息卡，收集反馈并修改赋值后再次验证。' },
    }, usage: { total_tokens: 60 } };
  },
};
const modeled = await runOutlineWorkflow(sample.request, curriculum, { model: fakeModel });
assert.equal(modelCalls.length, 1);
assert.equal(modeled.workflow.mode, 'deepseek');
assert.equal(modeled.validation.passed, true);
assert.equal(modeled.project.title, '校园活动：可更新的信息卡');
assert.equal(modeled.alignment.length, 4);
modelCalls.length = 0;
const outOfScopeModel = {
  async completeJson(input) {
    const response = await fakeModel.completeJson(input);
    if (response.data.stageActions) response.data.stageActions['A2.2'] = '使用 scanf() 从键盘读取活动信息。';
    return response;
  },
};
await assert.rejects(() => runOutlineWorkflow(sample.request, curriculum, { model: outOfScopeModel }), /超出第二章范围/);

const requests = [];
const client = createDeepSeekClient({ apiKey: 'test-only', fetchImpl: async (url, options) => {
  requests.push({ url, options });
  return new Response(JSON.stringify({ model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }), { status: 200 });
} });
assert.deepEqual((await client.completeJson({ system: 'JSON', user: 'JSON', maxTokens: 100 })).data, { ok: true });
assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
assert.equal(JSON.parse(requests[0].options.body).response_format.type, 'json_object');
assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only');
const badClient = createDeepSeekClient({ apiKey: 'test-only', fetchImpl: async () => new Response('', { status: 429 }) });
await assert.rejects(() => badClient.completeJson({ system: 'JSON', user: 'JSON' }), DeepSeekError);

const another = generateOutline({
  theme: '社团招新', audience: '新生', need: '招新地点常变，需要更新信息卡。',
  fields: '地点、名额', limit: '希望加入键盘输入',
}, curriculum);
assert.ok(another.project.title.includes('社团招新'));
assert.ok(another.stages[0].studentAction.includes('新生'));
assert.ok(another.warnings.some((warning) => warning.includes('第4章')));
assert.equal(another.validation.passed, true);

another.alignment[0].evidencePlan = [];
assert.equal(validateOutline(another, curriculum).passed, false);
another.alignment[0].evidencePlan = ['个人解释'];
another.stages[0].studentAction = '';
assert.equal(validateOutline(another, curriculum).passed, false);
assert.throws(() => generateOutline({ theme: '校园活动' }, curriculum));

async function call(method, url, body) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  const response = {
    status: null, headers: null, content: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(content) { this.content = content; },
  };
  await handleRequest(request, response);
  return response;
}

const page = await call('GET', '/');
assert.equal(page.status, 200);
assert.ok(page.content.includes('项目式学习大纲生成'));
const api = await call('POST', '/api/generate', sample.request);
assert.equal(api.status, 200);
assert.equal(JSON.parse(api.content).alignment.length, 4);
assert.equal(JSON.parse(api.content).workflow.trace.length, 3);
const edited = JSON.parse(api.content);
edited.alignment[0].criteria = [];
const checked = await call('POST', '/api/validate', { outline: edited });
assert.equal(JSON.parse(checked.content).passed, false);
const standalone = await readFile(new URL('./第二章大纲生成器.html', import.meta.url), 'utf8');
assert.ok(standalone.includes('window.OUTLINE_API'));
assert.ok(standalone.includes('runOutlineWorkflow(request, STATIC_CURRICULUM)'));
assert.ok(!standalone.includes('src="/app.js"'));
const script = standalone.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new vm.Script(script);
console.log('离线流程、模拟 DeepSeek 项目编排 Agent 调用、输出约束、API 适配、页面返回及单文件检查均通过。');
