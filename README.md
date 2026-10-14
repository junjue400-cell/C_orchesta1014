# C语言第二章项目式学习大纲原型

本目录是 C_orchestra 多智能体系统的第一条纵向样例：从学生需求生成第二章“基本数据类型”的静态项目大纲，展示并校验“目标—活动—证据”对应关系。默认样例是可更新的校园活动信息卡，学生可以修改项目主题、使用者、需求和字段。结果可修改、重新校验并导出 JSON 或 Markdown。系统组件与后续扩展见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 启动

**离线查看：**直接双击打开 `第二章大纲生成器.html`。此页面把课程数据与规则实现放在一个文件中，不需要启动服务，也不会把需求发送到外部服务。重新生成单文件页面时运行：

```powershell
node build-static.mjs
```

**DeepSeek 项目编排模式：**在本机的环境变量中配置 `DEEPSEEK_API_KEY`，然后启动本地服务。密钥只在服务端读取，不填入网页或提交到项目文件。默认模型是 `deepseek-flash`；如需指定其他有效模型，可设置 `DEEPSEEK_MODEL`。每次生成会调用项目编排 Agent，随后运行本地对齐校验器。需要 Node.js 20 或更新版本，无需安装依赖。在此目录运行：

```powershell
node prepare-data.mjs
$deepseekSecret = Read-Host 'DeepSeek API Key' -AsSecureString
$env:DEEPSEEK_API_KEY = [System.Net.NetworkCredential]::new('', $deepseekSecret).Password
node server.mjs
```

打开 `http://127.0.0.1:8765`。服务启动后会持续运行；结束时按 Ctrl+C。提示输入密钥时在本机终端输入，不要发到聊天中。

运行验证：

```powershell
node test.mjs
```

生成一份可直接查看的样例：

```powershell
node make-sample.mjs
```

会写出 `第二章样例大纲.json` 和 `第二章样例大纲.md`。

## 数据与范围

`prepare-data.mjs` 从相邻目录的 `图谱修订_第1至2章_v1.1/第1至2章_教学对齐图谱_v1.1.json` 提取第二章目标、活动和证据，生成 `curriculum-ch02.json`。来源标记为“待教师审核”，教材正文尚未完成核对。本原型只规划证据，不推断真实学生是否掌握。

当前流程包含普通需求输入整理、项目编排 Agent 和确定性对齐校验器，并记录各步调用状态。配置密钥后，项目编排 Agent 调用 DeepSeek API；未配置密钥时，本地服务自动使用离线规则模式，单文件页面始终使用离线模式。模型可以设计项目标题、驱动问题和三项学生活动，但课程目标、活动 ID 和证据标准由课程数据锁定，输出还须经过结构与章节边界检查。模型调用需要有效的 DeepSeek 账户与可用网络；本机目前没有配置密钥，因此真实请求尚未验证。第一版只启用项目编排 Agent，后续教学环节的智能体尚未实现，因此当前样例尚不是完整多智能体运行。输入提到键盘输入或数组等后续内容时，系统会提示章节边界。
