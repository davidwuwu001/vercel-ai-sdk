# Local pi-coding-agent / OpenClaw Asset Inventory

> **Date:** 2026-05-23  
> **Purpose:** Document local OpenClaw/pi-coding-agent installations for integration planning

---

## Overview

This document catalogs all OpenClaw-related installations found on this machine, their structure, and potential integration paths.

---

## 1. Primary OpenClaw Installation

**Path:** `~/.openclaw` (`/Users/Zhuanz/.openclaw`)

### Configuration Structure

The main config file `openclaw.json` contains:

```json
{
  "agents": {},       // Agent definitions
  "channels": {},     // Channel integrations (TUI, QQ, Feishu, etc.)
  "gateway": {
    "auth": { "mode": "token", "token": "***" },
    "mode": "local",
    "port": 18789,
    "bind": "loopback"
  },
  "messages": {},
  "meta": {},
  "models": {
    "mode": "merge",
    "providers": {
      "custom-ark-cn-beijing-volces-com": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
        "models": [
          { "id": "kimi-k2.6", "contextWindow": 256000 },
          { "id": "minimax-m2.7", "contextWindow": 256000 }
        ]
      }
    }
  },
  "plugins": {},      // Plugin registry
  "session": {},
  "skills": {},       // Skill registry
  "tools": {},
  "update": {},
  "wizard": {}
}
```

### Key Directories

| Directory | Purpose | Integration Potential |
|-----------|---------|----------------------|
| `agents/` | Agent definitions | Read-only, can query agent configs |
| `canvas/` | Canvas runtime data | Read-only inspection |
| `completions/` | Completion logs | Useful for analysis |
| `cron/` | Scheduled jobs | Read-only |
| `devices/` | Device registry | Not applicable |
| `exec-approvals.json` | Shell execution approvals | Security boundary |
| `extensions/` | Extension code | Can inspect plugin manifests |
| `feishu/` | Feishu integration | Reference only |
| `flows/` | Flow definitions | Read-only |
| `identity/` | Identity/auth data | **DO NOT READ** |
| `logs/` | Execution logs | Analysis source |
| `memory/` | Agent memory | Read-only |
| `npm/` | NPM package cache | Not applicable |
| `openclaw.json` | Main config | Read non-sensitive fields |
| `plugin-skills/` | Plugin-provided skills | Can list available skills |
| `plugins/` | Plugin registry | Can list plugins |
| `qqbot/` | QQ bot data | Not applicable |
| `skills/` | Local skill definitions | Can list available skills |
| `tasks/` | Task queue | Read-only |
| `tmp/` | Temporary files | Not applicable |
| `tui/` | TUI runtime data | Not applicable |
| `workspace/` | Agent workspace | **NEVER ACCESS** |

### Available Skills (Local Bundled)

Located in `~/.openclaw/skills/`:

| Skill | Purpose |
|-------|---------|
| `opencli-adapter-author` | Adapter authoring |
| `opencli-autofix` | Auto-fix code issues |
| `opencli-browser` | Browser automation |
| `opencli-usage` | Usage analysis |
| `planning-with-files` | File-based planning |
| `smart-search` | Smart search |

### Available Plugins

Located in `~/.openclaw/plugin-skills/` (symlinked):

| Plugin | Skills |
|--------|--------|
| `openclaw-lark` | `feishu-bitable`, `feishu-calendar`, `feishu-channel-rules`, `feishu-create-doc`, `feishu-fetch-doc`, `feishu-im-read`, `feishu-task`, `feishu-troubleshoot`, `feishu-update-doc` |

---

## 2. OpenClaw Application Support

**Path:** `/Users/Zhuanz/Library/Application Support/OpenClaw`

### Contents

| Item | Purpose |
|------|---------|
| `bridge.sock` | Unix socket for IPC |
| `canvas/` | Canvas runtime |
| `identity/` | Auth tokens |

**⚠️ SECURITY NOTE:** The `identity/` directory contains sensitive tokens. Do not read files in this directory.

---

## 3. OpenClaw Studio (Local Fork)

**Path:** `/Users/Zhuanz/Documents/project/龙虾项目管理开发/openclaw-studio`

A fork of [OpenClaw Studio](https://github.com/openclaw/studio) - a web dashboard for OpenClaw.

### Key Files

- `ARCHITECTURE.md` - Architecture documentation
- `skills-overview.md` - Skill system documentation
- `src/` - Next.js frontend
- `server/` - WebSocket server

### How It Works

1. Browser → Studio: HTTP + SSE (`/api/runtime/*`)
2. Studio → Gateway: One server-owned WebSocket to `ws://localhost:18789`

### Connection Options

- **Local:** Set upstream to `ws://localhost:18789`
- **Remote (Tailscale):** Use `wss://<gateway-host>.ts.net`

---

## 4. Feishu OpenClaw Plugin

**Path:** `/Users/Zhuanz/Documents/project/飞书插件-妙搭版/feishu-openclaw-plugin`

A Feishu (Lark) integration plugin for OpenClaw.

### Contents

- `index.js` / `index.d.ts` - Plugin entry point
- `README.md` - Documentation
- `LICENSE` - MIT License

---

## 5. Xiaozhi OpenClaw Integration

**Path:** `/Users/Zhuanz/Projects/xiaozhi-openclaw-integration`

Integration project connecting Xiaozhi ESP32-S3 4G device to OpenClaw.

### Key Info

- **Device:** ESP32-S3 QFN56 with 4G (ML307)
- **Current Firmware:** 小智 1.6.0
- **Target:** Connect to OpenClaw Gateway at `pub-118` (`root@118.196.0.44`)

### Directory Structure

```
xiaozhi-openclaw-integration/
├── docs/plans/       # Implementation plans
├── notes/            # Research notes
├── tools/            # Local scripts
├── logs/serial/      # Serial logs
├── backups/          # Flash backups
├── bridge/           # OpenClaw bridge service
├── server/           # Self-hosted Xiaozhi server
└── firmware/         # ESP-IDF / firmware source
```

---

## Integration Recommendations

### Safe Read-Only Entry Points

1. **List available skills** - Read `~/.openclaw/skills/*/SKILL.md` and `~/.openclaw/plugin-skills/*/SKILL.md`
2. **List agent definitions** - Read `~/.openclaw/agents/*/agent.json`
3. **Read plugin manifests** - Read `~/.openclaw/plugin-skills/*/metadata.json`
4. **Query non-sensitive config** - Parse `openclaw.json` for structure (skip tokens)
5. **Check gateway status** - Query `http://localhost:18789/status` (if gateway running)

### Requires Gateway Token

1. **Execute agent** - Requires `gateway.auth.token` from `openclaw.json`
2. **Send messages** - Requires active gateway session
3. **Tool execution** - Requires approved execution context

### ❌ Never Access

- `~/.openclaw/identity/` - Contains auth tokens
- `~/.openclaw/workspace/` - Contains agent working files
- Any file containing `apiKey`, `token`, `secret`, `password`

---

## Proposed Integration Path

### Phase 1: Read-Only Inspection Tool

Create `src/lib/agent-tools/local-coding-agent.ts` that:

1. Reads skill directories to list available skills
2. Reads agent definitions to list configured agents
3. Parses `openclaw.json` for structure (no secrets)
4. Returns structured JSON (not raw file content)

**This is safe because:**
- No shell execution
- No gateway connection required
- No secrets exposed

### Phase 2: Gateway-Aware Tool (Future)

After confirming gateway is running locally:

1. Connect to `ws://localhost:18789` with token
2. Execute read-only queries (list skills, agents)
3. Add execution approval workflow

---

## Facts vs Assumptions

### Confirmed Facts

- ✅ OpenClaw config is at `~/.openclaw/openclaw.json`
- ✅ Gateway runs locally on port 18789
- ✅ Skills use `SKILL.md` format (AgentSkills compatible)
- ✅ Local skills are in `~/.openclaw/skills/`
- ✅ Plugin skills are in `~/.openclaw/plugin-skills/`
- ✅ OpenClaw Studio exists as a separate project
- ✅ Several skills are already installed: autofix, browser, planning, etc.

### Assumptions

- ❓ Gateway token is stored in `openclaw.json` (needs verification)
- ❓ pi-coding-agent may be an alias for OpenClaw CLI (`opencli`)
- ❓ Exact API endpoint format for gateway communication unknown

---

## Next Steps

1. ✅ Document structure complete (this file)
2. Create `src/lib/agent-tools/local-coding-agent.ts` for read-only inspection
3. Test reading skill manifests
4. Explore gateway WebSocket protocol if needed
