按我们现在这个 `Vercel-AI-SDK` 项目来看，已经用到的是：

- `useChat`：前端聊天状态、发送消息、流式接收。
- `streamText`：服务端流式输出。
- 基础 `tool calling`：订单查询、知识库搜索、任务计划、当前时间这些 mock tools。
- 多步工具循环：用了 `stopWhen: stepCountIs(5)`，允许模型连续调用工具。
- OpenAI-compatible provider：用 `@ai-sdk/openai` 连接火山 Ark 这类兼容接口。
- 附件入口：前端有图片/文件选择入口，但还没有真正做深度解析链路。
- SQLite 模型管理：这是我们自己加的配置层，不是 AI SDK 自带后台。

还没用到的 AI SDK 能力主要有这些：

**1. 正式 Agent 封装**

现在我们是 `streamText + tools + stopWhen`，属于“轻量 agentic chat”。

AI SDK 还有更正式的 `ToolLoopAgent`，适合把一个智能体封装成可复用对象：固定 instructions、工具集、停止条件、结构化输出等。这个更适合你后面做“汤仔助手 Agent 中台”，比如：

- 家长反馈 Agent
- 老师资料审核 Agent
- 服务案例优化 Agent
- 订单风险巡检 Agent

官方文档里把 Agent 定义为 LLM + tools + loop 的组合，`ToolLoopAgent` 就是专门处理这种多步任务的类。参考：[Agents Overview](https://v6.ai-sdk.dev/docs/agents/overview)。

**2. 结构化输出**

现在聊天返回的是普通文本。

但很多业务场景其实更适合直接返回 JSON，比如：

```json
{
  "riskLevel": "medium",
  "issues": ["头像比例不合规", "服务案例超字数"],
  "suggestions": ["裁剪头像", "压缩案例到300字以内"]
}
```

AI SDK 支持用 schema 约束模型输出结构化数据，适合做审核、分类、抽取、评分、表单自动填写。参考：[Generating Structured Data](https://v6.ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)。

对汤仔助手来说，这个很重要。因为你的很多场景不是“聊一聊”，而是“给我一个可落库、可展示、可自动处理的结果”。

**3. `useObject` / 结构化流式 UI**

现在是文字一点点流出来。

但你也可以让结构化对象逐步生成，比如 AI 一边分析老师资料，一边把：

- 问题列表
- 风险等级
- 修改建议
- 推荐文案

逐步填到 UI 组件里。

这个比纯聊天更像真正的业务工具。

**4. AI Gateway**

现在我们是直接用火山 Ark 的 OpenAI-compatible endpoint。

AI SDK 还可以走 Vercel AI Gateway，优势是：

- 多模型统一入口
- provider 切换更方便
- 失败重试 / 路由 / 观测更集中
- 成本和调用情况更容易追踪

不过你现在主要用火山、阿里百炼，且项目本地化探索为主，短期不用急着上 Gateway。参考：[AI SDK Introduction](https://ai-sdk.dev/docs)。

**5. Embeddings / 向量知识库**

现在的 `searchKnowledgeBase` 只是 mock。

真正要做知识库，需要：

- 文档切片
- embedding
- 向量检索
- RAG 拼上下文
- 再让模型回答

AI SDK Core 里有 `embed` / `embedMany` 这类能力。参考：[AI SDK Core Reference](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core)。

这块对你公司知识库很关键，比如 SOP、老师服务规范、审核规则、话术库。

**6. 图像生成、语音转文字、文字转语音**

我们现在只做了图片上传入口，还没有做：

- AI 识图分析
- AI 生成图片
- 语音转文字
- 文字转语音

AI SDK Core 参考里有 image generation、transcription、speech 相关能力。参考：[AI SDK Core Reference](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core)。

对你当前业务，优先级我觉得是：

1. 识图：头像/证件/截图/资料图片分析。
2. 文档解析：上传 PDF、Word、Excel 后提取内容。
3. 语音能力：后面做 APP 语音助手时再考虑。

**7. Tool Streaming / 工具调用过程展示**

现在工具调用虽然能跑，但 UI 还没有把“模型正在调用哪个工具、参数是什么、结果是什么”做成清晰的过程面板。

更好的体验应该是：

- 正在查询订单
- 正在检索知识库
- 已找到 3 条规则
- 正在生成修改建议

这会让用户感觉 AI 不是黑箱，而是在执行任务。

官方工具调用文档提到 tool call / tool result 的概念，AI SDK 可以把工具过程纳入流式响应里。参考：[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

**8. MCP / 外部工具生态**

现在我们的工具是本地写死的函数。

后面可以扩展成：

- 调飞书
- 调企业微信
- 调内部订单系统
- 调 OSS
- 调数据库
- 调审核系统
- 调 MCP server

AI SDK 的工具机制本身可以承接这些，但我们当前还没有接 MCP，也没有接真实业务系统。

**9. 持久化会话**

现在会话主要存在浏览器 `localStorage`。

更正式的做法是：

- SQLite / Postgres 存会话
- 存消息
- 存工具调用记录
- 存用户
- 存模型配置
- 支持历史会话恢复
- 支持多人同时使用

这部分不是 AI SDK 自动帮你完成的，但 AI SDK 很适合接到这种架构里。

**10. 观测、日志、评估**

现在我们还没有做：

- 每次调用用了哪个模型
- 消耗多少 token
- 延迟多少
- 哪个工具调用失败
- 用户满意度
- AI 回答质量评估
- 不同模型效果对比

这对公司 300 人使用很重要。否则上线后你不知道“慢在哪里、贵在哪里、错在哪里”。

**我的建议优先级**

针对你的汤仔助手方向，下一步最值得补的是这几个：

1. **结构化输出**：审核、资料分析、案例优化都需要。
2. **真实知识库 RAG**：把 SOP、审核规则、服务规范接进去。
3. **工具调用过程 UI**：让用户看见 AI 在干活。
4. **会话持久化**：从 localStorage 升级到 SQLite/Postgres。
5. **图片/文件真实解析**：把现在的上传入口变成可用能力。
6. **ToolLoopAgent 封装**：把不同业务智能体拆成可复用 Agent。

一句话总结：  
我们现在做的是“Vercel AI SDK 的流式聊天 + 基础工具调用 Demo”。还没用到的高级能力，核心集中在 **结构化输出、正式 Agent、RAG 知识库、多模态解析、工具过程可视化、生产级观测和会话持久化**。这些才是它真正能变成公司级 AI Agent 架构的部分。