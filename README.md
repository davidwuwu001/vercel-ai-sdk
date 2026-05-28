# Neon Agent Lab

A cyberpunk Vercel AI SDK playground for testing a lightweight company-grade AI agent architecture.

## Current Version: v0.2 Stability Upgrade

This version upgrades the original scaffold into a durable internal Agent Lab prototype.

### v0.2 Completed

- Durable SQLite chat sessions and message snapshots
- Session detail loading when switching conversations
- Rename session, delete session, and clear current session messages
- `sessionId` propagation from the UI into `/api/chat`
- Chat endpoint persistence before and after model generation
- Friendly chat errors for missing API keys and disabled model configs
- Environment-variable fallback model config when no SQLite model exists
- Model connectivity test endpoint at `/api/models/test`
- Model admin UI action for testing saved model configs

### Still Mock / Lab Stage

- Demo tools still return mock data
- File upload entry exists, but document parsing and RAG are not fully wired
- SQLite is intended for local/server-style development; Vercel production should use a managed database
- API keys can be stored locally for experiments, but production should prefer environment variables or encrypted storage

## What It Demonstrates

- Next.js App Router
- Vercel AI SDK v6 streaming chat
- `useChat` UI message streaming
- OpenAI-compatible provider configuration for Volcengine Ark / Bailian / OpenAI-compatible APIs
- Server-side tool calling
- SQLite-backed session and model management
- Image and document attachment entry point
- Cyberpunk UI designed as a working app, not a landing page

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Open `http://localhost:3000/admin/models` to manage and test model configs.

Open `http://localhost:3000/lab` to view the AI SDK feature lab roadmap.

## Volcengine / Ark Config

Set these in `.env.local`:

```bash
VOLCENGINE_API_KEY=your_volcengine_ark_api_key
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_MODEL=your_model_or_endpoint_id
```

Aliases are also supported:

```bash
ARK_API_KEY=your_volcengine_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=your_model_or_endpoint_id
```

OpenAI-compatible fallback is also supported:

```bash
OPENAI_API_KEY=your_openai_or_compatible_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
```

## Local SQLite Model Admin

Model configs are stored in a local SQLite database at `data/agent-lab.sqlite`.
The database stores provider metadata such as Base URL, model ID, feature tags,
and the environment variable name for the API key.

For local experiments, the admin page can store an API key in SQLite. For production,
prefer environment variables or encrypted storage.

The chat endpoint uses this priority order:

1. Explicit selected model config from the UI
2. Enabled default model config from SQLite
3. Environment fallback from Volcengine / Ark / OpenAI-compatible variables
4. A clear error message when no usable key or model is available

## Chat Session Persistence

The UI loads recent sessions from `/api/chat-sessions` and loads full messages from
`/api/chat-sessions/[id]` when a session is selected.

The chat endpoint is `src/app/api/chat/route.ts`. It receives `sessionId`, persists
incoming message snapshots before the model call, and persists the final message
snapshot after generation finishes.

## Model Connectivity Test

Use the test button in `/admin/models`, or call:

```bash
curl -X POST http://localhost:3000/api/models/test \
  -H "Content-Type: application/json" \
  -d '{"modelConfigId":1}'
```

The endpoint returns provider, model ID, latency, usage, and a short test response.

## Tool Calling

Tools live in `src/lib/ai/tools.ts`.

Current demo tools:

- `getCurrentTime`
- `queryOrders`
- `searchKnowledgeBase`
- `createAgentTaskPlan`

These tools return mock data. Replace their `execute` functions with real API/database calls when connecting TangZai orders, service calendar, Feishu, or company knowledge base.

## Multimodal Notes

The UI supports image and document attachment selection through `useChat.sendMessage({ files })`.

Whether images or documents are actually understood depends on the selected model. Use a Volcengine/Ark model that supports visual or file inputs for real multimodal analysis.

## Recommended v0.3 Direction

- Replace mock tools with real business APIs
- Add document parsing and chunk storage
- Add keyword search first, then embeddings/RAG
- Add model comparison page
- Add login and production-grade access control
