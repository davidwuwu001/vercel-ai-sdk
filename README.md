# Neon Agent Lab

A cyberpunk Vercel AI SDK playground for testing a lightweight company-grade AI agent architecture.

## Current Version: v0.4 Admin Security Scope

This version focuses on admin login, basic permission protection, API access safety, business tool calling, durable chat, model management, and document parsing only. Model comparison, model test history, deployment migration, local knowledge-base search, embeddings, and RAG/2AG are intentionally not implemented in this stage.

### v0.4 Completed

- Admin login page at `/login`
- Login API at `/api/auth/login`
- Logout API at `/api/auth/logout`
- HTTP-only admin session cookie
- Middleware protection for app pages and sensitive APIs
- Protected routes include `/`, `/admin/*`, `/lab/*`, `/api/chat`, `/api/chat-sessions`, `/api/models`, and `/api/documents`
- `.env.example` with `ADMIN_PASSWORD` and `AUTH_SECRET`
- Floating logout button in the app shell

### v0.3 Completed

- Business tool service layer under `src/lib/business/*`
- Time tool backed by `src/lib/business/time.ts`
- Order query tool backed by `src/lib/business/orders.ts`
- Teacher profile query tool backed by `src/lib/business/teachers.ts`
- Feishu record query tool backed by `src/lib/business/feishu.ts`
- Tool outputs include data-source status and integration hints
- Document parser supports PDF, DOCX, Markdown, TXT, CSV, and JSON
- Document parser page is scoped to parsing + copying + sending parsed text to chat
- Knowledge-base save, local retrieval, embeddings, and RAG are explicitly deferred
- Model admin keeps the connectivity test action at `/api/models/test`

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

### Still Lab Stage

- Order, teacher, and Feishu tools use local demo data by default
- Real API integration points are prepared via `ORDERS_API_URL`, `TEACHERS_API_URL`, `FEISHU_APP_ID`, and `FEISHU_APP_SECRET`
- File parsing is implemented, but document chunking, retrieval, embeddings, and RAG are not included yet
- SQLite is intended for local/server-style development; Vercel production should use a managed database
- API keys can be stored locally for experiments, but production should prefer environment variables or encrypted storage
- Admin auth is basic password protection, not a full multi-user RBAC system

## What It Demonstrates

- Next.js App Router
- Vercel AI SDK v6 streaming chat
- `useChat` UI message streaming
- OpenAI-compatible provider configuration for Volcengine Ark / Bailian / OpenAI-compatible APIs
- Server-side tool calling
- Business-oriented tool architecture for orders, teachers, Feishu records, and time
- SQLite-backed session and model management
- Document parsing for common office formats
- Basic admin auth and API access protection
- Image and document attachment entry point
- Cyberpunk UI designed as a working app, not a landing page

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set at least these values in `.env.local`:

```bash
ADMIN_PASSWORD=change-me
AUTH_SECRET=replace-with-a-long-random-secret
```

Open `http://localhost:3000/login` and sign in with `ADMIN_PASSWORD`.

Open `http://localhost:3000` after login.

Open `http://localhost:3000/admin/models` to manage and test model configs.

Open `http://localhost:3000/lab/documents` to parse documents.

Open `http://localhost:3000/lab` to view the AI SDK feature lab roadmap.

## Admin Auth

Admin auth is controlled by:

```bash
ADMIN_PASSWORD=your_admin_password
AUTH_SECRET=your_long_random_secret
```

The login API creates an HTTP-only cookie named `neon_agent_admin`. Middleware checks this cookie before allowing access to protected pages and APIs.

Protected route scope:

- `/`
- `/admin/*`
- `/lab/*`
- `/api/chat`
- `/api/chat-sessions`
- `/api/models`
- `/api/documents`

This is enough for local/internal prototype protection. It is not a full user-management or RBAC implementation.

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

Use the test button in `/admin/models`, or call after login:

```bash
curl -X POST http://localhost:3000/api/models/test \
  -H "Content-Type: application/json" \
  -d '{"modelConfigId":1}'
```

The endpoint returns provider, model ID, latency, usage, and a short test response.

## Business Tools

Tools live in `src/lib/ai/tools.ts`. Business services live in `src/lib/business`.

Current tools:

- `getCurrentTime`
- `queryOrders`
- `queryTeacherProfiles`
- `queryFeishuRecords`
- `createAgentTaskPlan`

The business tools are structured for real integrations but currently default to demo data. Replace the relevant service implementation when connecting real TangZai orders, teacher profiles, or Feishu Bitable APIs.

## Document Parsing

The document parser is available at `/lab/documents` and `/api/documents/parse`.

Supported formats:

- PDF
- DOCX
- Markdown
- TXT
- CSV
- JSON

This stage only extracts text/markdown and document metadata. It does not save to a knowledge base and does not run retrieval or RAG.

## Deferred

- Real business database/API integration
- Model comparison page
- Model test history
- Local keyword retrieval
- Embeddings
- RAG / 2AG
- Knowledge-base save and query
- Multi-user RBAC
- Production deployment migration

## Recommended Next Direction

- Run local build/lint and fix any type errors
- Improve auth error display on `/login`
- Add real business integrations only after demo workflows are stable
