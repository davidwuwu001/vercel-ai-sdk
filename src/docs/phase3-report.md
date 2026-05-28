# Phase 3: 项目结构分析报告

> 生成时间: 2026-05-23
> 分析范围: Markdown 文档 + src 目录 TypeScript/TSX 文件

---

## 一、文档概览

项目共有 **5 个主要 Markdown 文档**：

| 文件路径 | 行数 | 用途 |
|---|---|---|
| `README.md` | 88 | 项目介绍、快速开始、配置说明 |
| `AGENTS.md` | 6 | Cursor Agent 规则 |
| `CLAUDE.md` | 2 | 引用 AGENTS.md |
| `docs/plans/2026-05-23-ai-agent-lab-upgrade-plan.md` | 582 | **升级实施计划**（核心蓝图） |
| `docs/Vercel-SDK-待探索的功能.md` | 178 | AI SDK 未使用能力分析 |

---

## 二、目录结构分析

```
src/
├── app/                          # Next.js App Router 页面
│   ├── api/                      # API Routes
│   │   ├── agents/               # Agent 管理 API
│   │   ├── chat/                # 聊天 API
│   │   ├── chat-sessions/       # 会话持久化 API
│   │   ├── documents/parse/     # 文档解析 API
│   │   ├── evals/run/           # 评估运行 API
│   │   ├── logs/                # 日志 API
│   │   ├── models/              # 模型配置 CRUD API
│   │   │   ├── [id]/           # 单个模型操作
│   │   │   └── compare/        # 模型对比 API
│   │   └── structured/analyze/ # 结构化输出 API
│   ├── admin/models/            # 模型管理后台 UI
│   ├── lab/                     # 功能实验室页面
│   │   ├── page.tsx            # 实验室首页
│   │   ├── agents/             # Agent 实验
│   │   ├── documents/          # 文档解析实验
│   │   ├── evals/              # 评估实验
│   │   ├── knowledge/          # 知识库实验
│   │   ├── logs/               # 日志查看
│   │   ├── models/             # 模型对比
│   │   └── structured/         # 结构化输出实验
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 主聊天页面
│   └── theme-provider.tsx       # 主题提供者
├── components/                   # 可复用组件
│   ├── agent-runner.tsx         # Agent 运行器
│   ├── document-parser-panel.tsx # 文档解析面板
│   └── markdown-message.tsx     # Markdown 渲染消息
└── lib/                         # 业务逻辑层
    ├── ai/                      # AI 核心
    │   ├── compare.ts           # 模型对比逻辑
    │   ├── model.ts            # 模型适配器
    │   ├── structured.ts        # 结构化输出
    │   ├── system.ts           # 系统提示词
    │   ├── tools.ts            # 工具定义
    │   └── types.ts            # 共享类型定义
    ├── agents/                  # Agent 封装
    │   ├── profile-audit-agent.ts  # 老师资料审核 Agent
    │   ├── registry.ts         # Agent 注册表
    │   ├── service-case-agent.ts  # 服务案例 Agent
    │   └── types.ts            # Agent 类型定义
    ├── db.ts                   # SQLite 数据库初始化
    ├── db/migrations.ts        # 数据库迁移
    ├── chat-store.ts           # 聊天会话存储
    ├── models.ts               # 模型配置 CRUD
    ├── documents/              # 文档解析
    │   ├── parse.ts            # 解析器实现
    │   └── types.ts            # 文档类型定义
    ├── evals/                  # 评估
    │   ├── run-eval.ts        # 评估运行
    │   └── types.ts            # 评估类型
    ├── knowledge/              # 知识库 RAG
    │   ├── chunk.ts            # 文档分块
    │   ├── embedding-provider.ts  # Embedding 适配器
    │   ├── rag.ts              # RAG 核心
    │   ├── rerank-provider.ts  # Rerank 适配器
    │   └── search.ts           # 搜索实现
    ├── observability/           # 可观测性
    │   └── log-run.ts          # 运行日志
    └── providers/              # Provider 适配层
        ├── index.ts            # 导出入口
        ├── openai-compatible.ts # OpenAI 兼容适配器
        ├── types.ts            # Provider 类型
        └── vercel-gateway.ts   # Vercel AI Gateway
```

---

## 三、已实现模块统计

| 模块 | 文件数 | 状态 |
|---|---|---|
| API Routes | 11 | ✅ 已实现 |
| 页面组件 (app/*) | 12 | ✅ 已实现 |
| 可复用组件 | 3 | ✅ 已实现 |
| AI 核心模块 | 5 | ✅ 已实现 |
| Agent 模块 | 4 | ✅ 已实现 |
| 文档解析 | 2 | ✅ 已实现 |
| 知识库 RAG | 5 | ✅ 已实现 |
| Provider 适配 | 3 | ✅ 已实现 |
| 数据库 | 2 | ✅ 已实现 |
| 评估 | 2 | ✅ 已实现 |
| **总计** | **55** | **Phase 3 完成** |

---

## 四、关键类型定义

### 4.1 Provider 类型 (`lib/ai/types.ts`)

```typescript
export type ProviderKind =
  | "volcengine"    // 火山引擎
  | "openai"         // OpenAI
  | "anthropic"      // Anthropic
  | "google"         // Google Gemini
  | "bailian"        // 阿里云百炼
  | "vercel-gateway"; // Vercel AI Gateway
```

### 4.2 模型配置 (`lib/models.ts`)

支持两种路由策略：
- `direct`: 直接连接 Provider
- `gateway`: 通过 Vercel AI Gateway

### 4.3 Agent 类型 (`lib/agents/types.ts`)

定义了 Agent 元数据、工具定义、执行器接口。

---

## 五、已使用 AI SDK 能力

根据 `docs/Vercel-SDK-待探索的功能.md` 分析：

| 能力 | 状态 | 位置 |
|---|---|---|
| `useChat` | ✅ 使用 | `src/app/page.tsx` |
| `streamText` | ✅ 使用 | `src/app/api/chat/route.ts` |
| 基础 tool calling | ✅ 使用 | `src/lib/ai/tools.ts` |
| 多步工具循环 | ✅ 使用 | `streamText({ stopWhen: stepCountIs(5) })` |
| OpenAI-compatible provider | ✅ 使用 | `@ai-sdk/openai` |

---

## 六、待探索 AI SDK 能力

| 能力 | 优先级 | 关联 Phase |
|---|---|---|
| ToolLoopAgent 封装 | 高 | Phase 5 |
| 结构化输出 | 高 | Phase 4 |
| useObject | 中 | Phase 4 |
| AI Gateway | 中 | Phase 6 |
| Embeddings / 向量知识库 | 高 | Phase 7 |
| 图像生成 / STT / TTS | 低 | Phase 8 |
| 工具调用过程展示 | 中 | Phase 5 |
| MCP 集成 | 低 | 未来 |
| 会话持久化 | 高 | Phase 2 |
| 观测 / 日志 / 评估 | 中 | Phase 9 |

---

## 七、实施计划要点

### Phase 0: 项目稳定化
- [x] 创建 Feature Roadmap Page (`src/app/lab/page.tsx`)
- [x] 添加共享运行时类型 (`src/lib/ai/types.ts`)

### Phase 2: SQLite 持久化
- [x] 数据库迁移系统 (`src/lib/db/migrations.ts`)
- [x] 聊天会话持久化 (`src/lib/chat-store.ts`)

### Phase 3: 文档解析
- [x] 解析器抽象 (`src/lib/documents/parse.ts`)
- [x] Documents UI (`src/app/lab/documents/page.tsx`)

### Phase 4: Markdown 渲染和结构化输出
- [x] Markdown 渲染 (`src/components/markdown-message.tsx`)
- [x] 结构化输出 (`src/lib/ai/structured.ts`)

### Phase 5: 正式 Agent 封装
- [x] Agent 注册表 (`src/lib/agents/registry.ts`)
- [x] Agent UI (`src/app/lab/agents/page.tsx`)

### Phase 6: 多 Provider 模型路由
- [x] Provider 适配层 (`src/lib/providers/`)
- [x] 模型对比 (`src/lib/ai/compare.ts`)

### Phase 7: 向量知识库
- [x] Embedding/Rerank 适配器 (`src/lib/knowledge/`)
- [x] RAG 核心 (`src/lib/knowledge/rag.ts`)

### Phase 8: 媒体能力
- [ ] 待实现

### Phase 9: 观测、日志、评估
- [x] 运行日志 (`src/lib/observability/log-run.ts`)
- [x] 评估系统 (`src/lib/evals/`)

---

## 八、依赖包清单

| 包名 | 用途 |
|---|---|
| `ai` v6.0.190 | Vercel AI SDK 核心 |
| `@ai-sdk/openai` | OpenAI 兼容 Provider |
| `@ai-sdk/react` | React 集成 |
| `better-sqlite3` | SQLite 数据库 |
| `pdf-parse` | PDF 解析 |
| `mammoth` | DOCX 解析 |
| `react-markdown` | Markdown 渲染 |
| `remark-gfm` | GitHub Flavored Markdown |
| `zod` | Schema 验证 |

---

## 九、下一步建议

1. **Phase 8 媒体能力**: 实现图像生成、STT、TTS 功能
2. **完善测试**: 为核心模块添加单元测试
3. **文档完善**: 补充 API 文档和使用示例
4. **性能优化**: 检查 bundle 大小，优化导入

---

*报告生成完成*
