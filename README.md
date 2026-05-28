# Neon Agent Lab

A cyberpunk Vercel AI SDK playground for testing a lightweight company-grade AI agent architecture.

## What It Demonstrates

- Next.js App Router
- Vercel AI SDK v6 streaming chat
- `useChat` UI message streaming
- OpenAI-compatible provider configuration for Volcengine Ark
- Server-side tool calling
- Local browser session management
- Image and document attachment entry point
- Cyberpunk UI designed as a working app, not a landing page

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Open `http://localhost:3000/admin/models` to manage model configs.

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

## Local SQLite Model Admin

Model configs are stored in a local SQLite database at `data/agent-lab.sqlite`.
The database stores provider metadata such as Base URL, model ID, feature tags,
and the environment variable name for the API key.

Real API keys should stay in `.env.local`; do not save secrets into SQLite.

The chat endpoint uses the enabled default model from the SQLite admin. If no
model config is available, it falls back to the Volcengine / Ark env vars above.

## Tool Calling

Tools live in `src/lib/ai/tools.ts`.

Current demo tools:

- `getCurrentTime`
- `queryOrders`
- `searchKnowledgeBase`
- `createAgentTaskPlan`

These tools return mock data. Replace their `execute` functions with real API/database calls when connecting TangZai orders, service calendar, Feishu, or company knowledge base.

## Chat API

The chat endpoint is `src/app/api/chat/route.ts`.

It uses:

- `convertToModelMessages`
- `streamText`
- `stepCountIs(5)`
- `toUIMessageStreamResponse`

## Multimodal Notes

The UI supports image and document attachment selection through `useChat.sendMessage({ files })`.

Whether images or documents are actually understood depends on the selected model. Use a Volcengine/Ark model that supports visual or file inputs for real multimodal analysis.
