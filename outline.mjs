export function cleanInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('需求格式不正确');
  const pick = (key, max) => typeof raw[key] === 'string' ? raw[key].trim().slice(0, max) : '';
  const input = {
    theme: pick('theme', 80),
    audience: pick('audience', 80),
    fields: pick('fields', 240),
    need: pick('need', 400),
    limit: pick('limit', 200),
  };
  if (!input.theme || !input.audience || !input.need) {
    throw new Error('请填写项目主题、使用者和需要解决的问题');
  }
  return input;
}

export function generateOutline(raw, curriculum) {
  const input = cleanInput(raw);
  if (curriculum.chapter.id !== 'CH02') throw new Error('当前原型仅支持第二章');
  const theme = input.theme;
  const audience = input.audience;
  const fieldText = input.fields || '活动日期、地点、人数等受众关心的信息';
  const activityTexts = [
    `围绕“${input.need}”与${audience}确认${theme}信息卡需要呈现的字段、单位和可能变化的数据；形成字段草稿，并区分固定说明与需要更新的值。`,
    `在已有欢迎程序上增加${theme}信息卡：为必要数据选择基本类型，声明并初始化变量，输出字段与单位；通过修改代码中的赋值更新信息，预测并核对结果；用 sizeof 做简短的存储空间观察。`,
    `向${audience}展示可运行的信息卡，记录实际反馈，修改代码中的值或呈现方式并复测；说明类型选择和赋值变化，必要时完成一个未直接示范的小型独立修改。`,
  ];
  const stages = curriculum.activities.map((activity, index) => ({
    id: activity.id,
    title: activity.name,
    studentAction: activityTexts[index],
    goalIds: activity.goal_ids,
    artifacts: activity.artifacts,
    choices: activity.learner_choices,
  }));
  const alignment = curriculum.goals.map((goal) => {
    const evidence = curriculum.evidence.find((item) => item.id === goal.evidence_id);
    return {
      goalId: goal.id,
      goal: goal.title,
      knowledgeIds: goal.knowledge_ids,
      capabilityIds: goal.capability_ids,
      activityIds: goal.activity_ids,
      evidenceId: evidence.id,
      evidencePlan: evidence.acceptable_forms,
      criteria: evidence.criteria,
      independentRequired: goal.independent_evidence_required,
      scopeNote: goal.scope_note,
    };
  });
  const warnings = [];
  if (/(scanf|键盘输入|运行时输入|从键盘|交互输入)/i.test(`${input.need} ${input.limit}`)) {
    warnings.push('需求涉及键盘输入（教材第4章）。第二章先通过修改代码中的赋值更新信息，交互输入可列为后续扩展。');
  }
  if (/(排序|查找|数组|字符串处理|文件保存|数据库)/i.test(`${input.need} ${input.limit}`)) {
    warnings.push('需求中含后续章节能力。当前大纲只覆盖第二章基本数据类型，相关功能暂列后续扩展。');
  }
  const outline = {
    schemaVersion: '0.1',
    sourceStatus: curriculum.sourceStatus,
    chapter: curriculum.chapter,
    request: input,
    project: {
      title: `${theme}：可更新的信息卡`,
      drivingQuestion: `怎样用 C 语言准确表示${audience}关心的${theme}信息，并在需求变化时可靠更新？`,
      audience,
      fieldSuggestion: fieldText,
      version: curriculum.project.artifact_version,
      deliverables: curriculum.project.deliverables,
      constraints: [...curriculum.project.constraints, ...(input.limit ? [`学生提出的限制：${input.limit}`] : [])],
      continuation: '可作为第一章欢迎程序的下一版本，也可从同等起点开始。',
    },
    stages,
    alignment,
    warnings,
    note: '这是预设的学习机会与证据获取计划，并非已经收集到的学生表现或掌握结论。',
  };
  outline.validation = validateOutline(outline, curriculum);
  return outline;
}

export function validateOutline(outline, curriculum) {
  const issues = [];
  if (!outline || typeof outline !== 'object' || !Array.isArray(outline.stages) || !Array.isArray(outline.alignment)) {
    return { passed: false, issues: ['大纲结构不正确'], checkedAt: new Date().toISOString() };
  }
  const goalIds = new Set(curriculum.goals.map((item) => item.id));
  const activityIds = new Set(outline.stages.map((item) => item.id));
  const evidenceIds = new Set(curriculum.evidence.map((item) => item.id));
  for (const goalId of goalIds) {
    const row = outline.alignment.find((item) => item.goalId === goalId);
    if (!row) { issues.push(`${goalId} 缺少对齐行`); continue; }
    if (!row.activityIds?.length || row.activityIds.some((id) => !activityIds.has(id))) issues.push(`${goalId} 缺少有效学习活动`);
    if (row.activityIds?.some((id) => !outline.stages.find((stage) => stage.id === id)?.goalIds?.includes(goalId))) {
      issues.push(`${goalId} 与关联活动的目标标记不一致`);
    }
    if (!evidenceIds.has(row.evidenceId) || !row.evidencePlan?.length) issues.push(`${goalId} 缺少有效证据计划`);
    if (!row.criteria?.length) issues.push(`${goalId} 缺少判断标准`);
  }
  for (const stage of outline.stages) {
    if (!stage.studentAction?.trim()) issues.push(`${stage.id} 缺少学生行动`);
    if (!stage.goalIds?.length || stage.goalIds.some((id) => !goalIds.has(id))) issues.push(`${stage.id} 未关联有效目标`);
  }
  if (!outline.project?.title?.trim() || !outline.project?.drivingQuestion?.trim() || !outline.project?.deliverables?.length) issues.push('项目名称、问题或成果缺失');
  return { passed: issues.length === 0, issues, checkedAt: new Date().toISOString() };
}
