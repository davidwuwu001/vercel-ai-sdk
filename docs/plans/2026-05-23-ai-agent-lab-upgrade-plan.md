# Vercel AI Agent Lab Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current Vercel AI SDK demo into a practical AI Agent Lab that can explore local OpenClaw/pi-coding-agent ideas, document parsing, formal agents, structured output, multi-provider model routing, RAG, media generation, persistent chat, and observability.

**Architecture:** Keep Next.js App Router as the UI/API shell, Vercel AI SDK as the model/tool/agent orchestration layer, and SQLite as the local persistence layer. Introduce provider adapters, document pipelines, vector retrieval, and telemetry as separate modules so each capability can be tested independently before being composed into full agents.

**Tech Stack:** Next.js 16 App Router, React 19, Vercel AI SDK v6, better-sqlite3, Zod, SQLite, OpenAI-compatible providers for Volcengine Ark / Alibaba Cloud Bailian, Markdown rendering, document parsers, embedding/reranking adapters, and local OpenClaw/pi-coding-agent research outputs.

---

## Current Baseline

- Main chat UI: `src/app/page.tsx`
- Model admin UI: `src/app/admin/models/page.tsx`
- Chat endpoint: `src/app/api/chat/route.ts`
- Model config API: `src/app/api/models/route.ts`, `src/app/api/models/[id]/route.ts`
- Model adapter: `src/lib/ai/model.ts`
- Demo tools: `src/lib/ai/tools.ts`
- SQLite bootstrap: `src/lib/db.ts`
- Model storage service: `src/lib/models.ts`
- Current local database: `data/agent-lab.sqlite`

## Guiding Principles

- Build feature slices, not a huge rewrite.
- Keep every new capability visible in the UI through tabs or panels.
- Persist important runtime data in SQLite, not browser localStorage.
- Treat provider-specific APIs as adapters behind stable internal interfaces.
- Never return saved API keys to the browser.
- Use official AI SDK patterns for streaming, tools, agents, and structured output.
- Prefer mock-first tests, then connect real providers.

## Proposed UI Shape

Add a main workspace with tabs:

- `Chat`: existing chat, model selector, attachments.
- `Tools`: inspect and test tool calling.
- `Structured`: JSON schema output and Markdown rendering experiments.
- `Documents`: PDF / Word / Markdown parsing.
- `Knowledge`: upload docs, embed, retrieve, rerank, answer.
- `Agents`: formal ToolLoopAgent experiments.
- `Media`: image generation, STT, TTS.
- `Models`: provider and model routing experiments.
- `Logs`: request logs, errors, timing, token usage, evaluation results.

---

## Phase 0: Project Stabilization

### Task 0.1: Create a Feature Roadmap Page

**Files:**
- Create: `src/app/lab/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

**Steps:**
1. Add `/lab` as the future feature lab entry.
2. Add links from the current sidebar/topbar to `/lab`.
3. Render the planned feature tabs as disabled cards with status labels.
4. Run `npm run lint`.
5. Run `npm run build`.

**Acceptance:**
- `/lab` opens.
- It lists all planned modules.
- No behavior change to current chat.

### Task 0.2: Add Shared Runtime Types

**Files:**
- Create: `src/lib/ai/types.ts`
- Modify: `src/lib/models.ts`
- Modify: `src/lib/ai/model.ts`

**Steps:**
1. Define internal types: `ProviderKind`, `ModelCapability`, `ModelRuntimeConfig`, `ModelUsage`.
2. Map SQLite model configs into these runtime types.
3. Keep API key material server-only.
4. Run lint/build.

**Acceptance:**
- Existing model selection still works.
- Runtime type file becomes the shared contract for later phases.

---

## Phase 1: Local pi-coding-agent / OpenClaw Research

### Task 1.1: Local Asset Inventory

**Files:**
- Create: `docs/research/local-pi-coding-agent-openclaw-inventory.md`

**Known local candidates:**
- `/Users/Zhuanz/.openclaw`
- `/Users/Zhuanz/Library/Application Support/OpenClaw`
- `/Users/Zhuanz/Documents/project/个人知识库系统/OpenClaw`
- `/Users/Zhuanz/Documents/project/飞书插件-妙搭版/feishu-openclaw-plugin`
- `/Users/Zhuanz/Documents/project/龙虾项目管理开发/openclaw-studio`
- `/Users/Zhuanz/Projects/xiaozhi-openclaw-integration`

**Steps:**
1. Inspect configs without printing secrets.
2. Identify command entrypoints, plugin manifests, MCP servers, skill definitions, and workspace structure.
3. Record how OpenClaw/pi-coding-agent launches, how it calls tools, and how skills/plugins are represented.
4. Identify whether there is a callable local HTTP/MCP/CLI interface.
5. Write a short integration recommendation.

**Acceptance:**
- Research doc explains what exists locally.
- It clearly separates confirmed facts from assumptions.
- It proposes one safe integration path.

### Task 1.2: Agent Tool Design for Local Execution

**Files:**
- Create: `src/lib/agent-tools/local-coding-agent.ts`
- Create: `src/app/api/local-agent/inspect/route.ts`
- Create: `docs/research/local-agent-tool-contract.md`

**Steps:**
1. Define a read-only inspection tool first.
2. Support commands such as list skills, list plugins, read manifest.
3. Block arbitrary shell execution in the first iteration.
4. Return structured output.
5. Add UI card in `Tools` tab later.

**Acceptance:**
- The app can inspect known local OpenClaw/pi-coding-agent metadata.
- It cannot run destructive commands.

---

## Phase 2: SQLite Persistence Foundation

### Task 2.1: Add Database Schema Migrations

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/db/migrations.ts`

**Tables:**
- `model_configs`
- `chat_sessions`
- `chat_messages`
- `attachments`
- `documents`
- `document_chunks`
- `embeddings`
- `ai_runs`
- `tool_calls`
- `evaluations`
- `media_generations`

**Steps:**
1. Move ad hoc migration logic out of `db.ts`.
2. Add a `schema_migrations` table.
3. Add incremental migrations with version numbers.
4. Add indexes for session, document, run, and created time.
5. Run local migration against `data/agent-lab.sqlite`.

**Acceptance:**
- Existing model configs survive migration.
- New tables are created.
- App still starts.

### Task 2.2: Persist Chat Sessions

**Files:**
- Create: `src/lib/chat-store.ts`
- Create: `src/app/api/chat-sessions/route.ts`
- Create: `src/app/api/chat-sessions/[id]/route.ts`
- Modify: `src/app/page.tsx`

**Steps:**
1. Store session metadata in SQLite.
2. Store UI messages as JSON in `chat_messages`.
3. Replace localStorage persistence with API-backed persistence.
4. Keep localStorage only for UI preferences.
5. Add loading and empty states.

**Acceptance:**
- Refreshing the page restores sessions from SQLite.
- Long conversations no longer bloat localStorage.
- Chat remains usable without login.

---

## Phase 3: Document Parsing

### Task 3.1: Parser Abstraction

**Files:**
- Create: `src/lib/documents/types.ts`
- Create: `src/lib/documents/parse.ts`
- Create: `src/app/api/documents/parse/route.ts`

**Supported formats:**
- Markdown: `.md`, `.markdown`
- PDF: `.pdf`
- Word: `.docx` first; `.doc` can be marked unsupported unless a reliable parser is selected.

**Candidate packages:**
- Markdown: `unified`, `remark-parse`, or direct text path for first pass.
- Word docx: `mammoth`.
- PDF: evaluate `pdf-parse` or `unpdf` in the local Next.js runtime.

**Steps:**
1. Define `ParsedDocument` with `title`, `plainText`, `markdown`, `metadata`, `pages`.
2. Implement Markdown parser.
3. Implement DOCX parser.
4. Implement PDF parser.
5. Add file size limit and clear error messages.
6. Add parser tests with small fixtures.

**Acceptance:**
- API returns extracted text and metadata.
- Unsupported formats fail cleanly.
- No parsed file content is logged to terminal.

### Task 3.2: Documents UI

**Files:**
- Create: `src/app/lab/documents/page.tsx`
- Create: `src/components/document-parser-panel.tsx`

**Steps:**
1. Upload a document.
2. Show extracted Markdown/plain text preview.
3. Show metadata: type, size, page count if available.
4. Add “send to chat” and “save to knowledge base” buttons.

**Acceptance:**
- PDF/DOCX/MD can be parsed from UI.
- Extracted content can be reused in later RAG phase.

---

## Phase 4: Markdown Rendering and Structured Output

### Task 4.1: Markdown Renderer

**Files:**
- Create: `src/components/markdown-message.tsx`
- Modify: `src/app/page.tsx`
- Modify: `package.json`

**Packages:**
- `react-markdown`
- `remark-gfm`
- Optional later: `rehype-highlight` or `shiki`

**Steps:**
1. Render assistant text parts with Markdown.
2. Keep user messages as plain text or lightweight Markdown.
3. Style code blocks, lists, tables, quotes.
4. Guard against unsafe HTML.

**Acceptance:**
- AI replies with headings/lists/tables look readable.
- Code blocks do not break mobile layout.

### Task 4.2: Structured Output Endpoint

**Files:**
- Create: `src/lib/ai/structured.ts`
- Create: `src/app/api/structured/analyze/route.ts`
- Create: `src/app/lab/structured/page.tsx`

**Use cases:**
- Teacher profile audit.
- Service case rewrite.
- Image/document analysis summary.

**Steps:**
1. Define Zod schemas for sample tasks.
2. Use AI SDK structured output APIs.
3. Return JSON plus Markdown explanation.
4. Render both schema output and Markdown.

**Acceptance:**
- UI shows raw JSON, formatted cards, and Markdown narrative.
- Validation errors are visible and understandable.

---

## Phase 5: Formal Agent Encapsulation

### Task 5.1: Agent Registry

**Files:**
- Create: `src/lib/agents/registry.ts`
- Create: `src/lib/agents/types.ts`
- Create: `src/lib/agents/profile-audit-agent.ts`
- Create: `src/lib/agents/service-case-agent.ts`

**Steps:**
1. Define agent metadata: id, name, purpose, tools, model requirements.
2. Wrap existing `streamText + tools + stopWhen` into reusable agent definitions first.
3. Add formal `ToolLoopAgent` experiments as a second implementation path.
4. Add a route for running an agent by id.

**Acceptance:**
- Existing chat can select an agent preset.
- Agents can share model config and tools.

### Task 5.2: Agent UI

**Files:**
- Create: `src/app/lab/agents/page.tsx`
- Create: `src/components/agent-runner.tsx`

**Steps:**
1. List registered agents.
2. Show instructions and tool list.
3. Run agent with input.
4. Show tool timeline and final answer.

**Acceptance:**
- At least two agents can be tested from UI.
- Tool calls are visible.

---

## Phase 6: Multi-Provider Model Routing and AI Gateway

### Task 6.1: Provider Adapter Layer

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/openai-compatible.ts`
- Create: `src/lib/providers/vercel-gateway.ts`
- Modify: `src/lib/ai/model.ts`
- Modify: `src/lib/models.ts`

**Providers:**
- Volcengine Ark OpenAI-compatible.
- Alibaba Cloud Bailian OpenAI-compatible where possible.
- Vercel AI Gateway for multi-provider routing.

**Steps:**
1. Extend model configs with provider strategy.
2. Add `baseUrl`, `modelId`, `gatewaySlug`, `apiKeyEnv`, `apiKeyValue`.
3. Resolve model by strategy.
4. Keep direct provider path working.
5. Add UI fields for Gateway slug and fallback order later.

**Acceptance:**
- Existing Ark models still work.
- Gateway-style model identifiers can be stored and selected.

### Task 6.2: Model Comparison

**Files:**
- Create: `src/app/lab/models/page.tsx`
- Create: `src/app/api/models/compare/route.ts`
- Create: `src/lib/ai/compare.ts`

**Steps:**
1. Select 2-4 configured models.
2. Send same prompt to each.
3. Record latency, success/failure, output length, and usage if available.
4. Render side-by-side results.

**Acceptance:**
- You can compare Doubao / Kimi / Bailian / Gateway models from the UI.

---

## Phase 7: Vector Knowledge Base

### Task 7.1: Embedding and Rerank Adapters

**Files:**
- Create: `src/lib/knowledge/embedding-provider.ts`
- Create: `src/lib/knowledge/rerank-provider.ts`
- Create: `src/lib/knowledge/chunk.ts`
- Create: `src/lib/knowledge/search.ts`

**Initial provider plan:**
- Alibaba Cloud Bailian embedding model supplied by user.
- Alibaba Cloud Bailian reranking model supplied by user.
- Keep adapter interface flexible for Volcengine or AI SDK embeddings later.

**Steps:**
1. Define `embedTexts(texts: string[])`.
2. Define `rerank(query, candidates)`.
3. Add chunking by heading/paragraph/token-ish length.
4. Store chunks and embeddings in SQLite.
5. Start with JS cosine similarity for prototype.
6. Evaluate `sqlite-vec` only after basic RAG works.

**Acceptance:**
- A parsed document can be chunked and embedded.
- Query returns top chunks.
- Reranking can be toggled on/off.

### Task 7.2: RAG Chat Tool

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Create: `src/lib/knowledge/rag.ts`
- Create: `src/app/lab/knowledge/page.tsx`

**Steps:**
1. Replace mock `searchKnowledgeBase` with real retrieval.
2. Include retrieved chunk citations in tool output.
3. Feed retrieved context into answer generation.
4. Show citations in Markdown renderer.

**Acceptance:**
- Chat can answer from uploaded docs.
- UI shows which chunks were used.

---

## Phase 8: Image Generation, STT, and TTS

### Task 8.1: Media Provider Abstraction

**Files:**
- Create: `src/lib/media/types.ts`
- Create: `src/lib/media/image-generation.ts`
- Create: `src/lib/media/speech-to-text.ts`
- Create: `src/lib/media/text-to-speech.ts`

**Providers:**
- Volcengine for image/audio where available.
- Alibaba Cloud Bailian for image/audio where available.
- AI SDK media APIs where provider support fits.

**Steps:**
1. Define common input/output shapes.
2. Add provider-specific adapters.
3. Store generated media metadata in SQLite.
4. Save output files under local `data/media/` for prototype.

**Acceptance:**
- The app can call one image provider and one speech/text provider through stable internal functions.

### Task 8.2: Media Lab UI

**Files:**
- Create: `src/app/lab/media/page.tsx`
- Create: `src/components/media-lab-panel.tsx`

**Steps:**
1. Add image generation prompt UI.
2. Add audio upload for transcription.
3. Add text input for TTS.
4. Show generated images/audio/transcripts.

**Acceptance:**
- Media capabilities can be tested without touching chat.

---

## Phase 9: Observability, Logs, and Evaluation

### Task 9.1: AI Run Logging

**Files:**
- Create: `src/lib/observability/log-run.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/structured/analyze/route.ts`
- Modify: future agent/media/RAG routes.

**Fields:**
- route
- model config id
- provider
- model id
- start time
- end time
- latency
- status
- error message
- token usage when available
- tool call count
- attachment count

**Steps:**
1. Add logging helper.
2. Wrap chat route.
3. Record errors without leaking API keys.
4. Add indexes for logs.

**Acceptance:**
- Every chat run produces one `ai_runs` row.
- Errors are queryable.

### Task 9.2: Logs UI

**Files:**
- Create: `src/app/lab/logs/page.tsx`
- Create: `src/app/api/logs/route.ts`

**Steps:**
1. List recent runs.
2. Filter by model, status, route.
3. Show latency and error reason.
4. Drill into tool calls.

**Acceptance:**
- Slow or failed calls are easy to identify.

### Task 9.3: Lightweight Evaluation

**Files:**
- Create: `src/lib/evals/types.ts`
- Create: `src/lib/evals/run-eval.ts`
- Create: `src/app/lab/evals/page.tsx`

**Steps:**
1. Add a small prompt dataset.
2. Run one prompt against multiple models.
3. Store outputs.
4. Add manual rating fields first.
5. Add LLM-as-judge later.

**Acceptance:**
- You can compare answer quality over time.

---

## Recommended Execution Order

1. Phase 2: SQLite persistence foundation.
2. Phase 4: Markdown renderer and structured output.
3. Phase 3: document parsing.
4. Phase 7: embeddings, rerank, and RAG.
5. Phase 5: formal agent encapsulation.
6. Phase 6: provider routing and AI Gateway.
7. Phase 9: observability and evaluation.
8. Phase 8: image generation / STT / TTS.
9. Phase 1: local OpenClaw/pi-coding-agent integration, after research clarifies safe entrypoints.

Reason: persistence and logging are cross-cutting foundations. RAG needs document parsing and embeddings. Agent work becomes much more useful after tools, RAG, and structured output exist.

## First Implementation Sprint

If executing immediately, do this first:

1. Add migration system and SQLite tables.
2. Move chat session persistence from localStorage to SQLite.
3. Add Markdown renderer.
4. Add structured output lab with one teacher-profile audit schema.
5. Add document parsing for Markdown and DOCX.
6. Add run logging for chat and structured output.

This sprint produces visible value quickly and creates the foundation for every later feature.

## Verification Checklist

Run after every phase:

```bash
npm run lint
npm run build
```

For UI phases:

```bash
npm run dev
```

Then verify:

- Desktop viewport.
- Mobile viewport.
- Empty state.
- Error state.
- Long output.
- Provider/API failure.
- SQLite data persists after refresh.

