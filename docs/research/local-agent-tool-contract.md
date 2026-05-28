# Local Agent Tool Contract

> **Purpose:** Define the interface for read-only local OpenClaw inspection tools

---

## Overview

This document defines the tool contract for integrating with local OpenClaw installations. The initial implementation provides **read-only** access to metadata and configurations without executing any commands or accessing sensitive data.

---

## Security Principles

### ✅ Allowed Operations

1. **File reading** - Read skill manifests, agent configs, and non-sensitive config
2. **Directory listing** - List available skills, agents, and plugins
3. **Config parsing** - Parse `openclaw.json` structure without exposing tokens

### ❌ Prohibited Operations

1. **Shell execution** - No `exec`, `spawn`, or shell commands
2. **Gateway communication** - No WebSocket connections without explicit user consent
3. **Sensitive data access** - No reading of `identity/`, `workspace/`, or files containing tokens
4. **File modification** - No writing or deleting files
5. **Network calls** - No HTTP requests except localhost health checks

---

## Tool Interface

### Tool Name: `inspect_local_agent`

**Description:** Inspect local OpenClaw installation for available skills, agents, and configuration.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | One of: `status`, `skills`, `agents`, `plugins`, `config`, `inspect_skill` |
| `skill_name` | string | No | Required when `action=inspect_skill` |

### Actions

#### `status`
Returns OpenClaw installation status and gateway availability.

**Response:**
```typescript
interface StatusResponse {
  installed: boolean;
  configExists: boolean;
  gatewayPort: number;
  gatewayRunning: boolean;
  skillsCount: number;
  pluginsCount: number;
}
```

#### `skills`
Lists all available skills from local and plugin sources.

**Response:**
```typescript
interface Skill {
  name: string;
  description: string;
  source: "local" | "plugin";
  path: string;
  eligible: boolean;
  requirements?: {
    bins?: string[];
    env?: string[];
    config?: string[];
  };
}
```

#### `agents`
Lists all configured agents.

**Response:**
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  model?: string;
  skills: string[];
  channels: string[];
}
```

#### `plugins`
Lists all installed plugins.

**Response:**
```typescript
interface Plugin {
  name: string;
  version?: string;
  skills: string[];
}
```

#### `config`
Returns sanitized OpenClaw configuration (tokens redacted).

**Response:**
```typescript
interface Config {
  agents?: object;
  channels?: object;
  gateway?: object;
  messages?: object;
  models?: object;
  plugins?: object;
  session?: object;
  skills?: object;
  // ... (tokens replaced with "[REDACTED]")
}
```

#### `inspect_skill`
Returns the full content of a specific skill's `SKILL.md`.

**Parameters:**
- `skill_name`: Name of the skill to inspect

**Response:**
```typescript
interface SkillContent {
  exists: boolean;
  content?: string;  // Raw SKILL.md content
  metadata?: object; // Parsed frontmatter
}
```

---

## API Endpoints

### `GET /api/local-agent/inspect`

Main inspection endpoint with query parameters.

**Query Parameters:**
- `action` (optional): Single action to perform
- `name` (optional): Skill name for `inspect-skill` action

**Examples:**

```bash
# Get full inspection
GET /api/local-agent/inspect

# Get status only
GET /api/local-agent/inspect?action=status

# List all skills
GET /api/local-agent/inspect?action=skills

# Inspect specific skill
GET /api/local-agent/inspect?action=inspect-skill&name=planning-with-files
```

---

## File Access Rules

### Safe Paths (Read Allowed)

```
~/.openclaw/
├── skills/                    ✅
├── plugin-skills/              ✅
├── agents/                     ✅
├── plugins/                    ✅
├── openclaw.json              ✅ (sanitized)
├── logs/                       ✅
├── completions/                ✅
└── ...other directories...    ✅
```

### Unsafe Paths (Blocked)

```
~/.openclaw/
├── identity/                   ❌ Always blocked
├── workspace/                  ❌ Always blocked
├── **/token*                  ❌ Pattern blocked
├── **/secret*                 ❌ Pattern blocked
├── **/apiKey*                 ❌ Pattern blocked
└── **/password*               ❌ Pattern blocked
```

---

## Future Extensions

### Phase 2: Gateway-Aware Tools (Requires Consent)

After implementing read-only tools, consider adding:

1. **Gateway connection check** - Query `http://localhost:18789/status`
2. **Agent execution** - Run agent via gateway API (requires token)
3. **Tool execution** - Execute tools via gateway (requires approval workflow)

### Required Safeguards for Phase 2

1. **Explicit user consent** - All executions must be user-approved
2. **Execution logging** - All commands logged to `ai_runs` table
3. **Timeout limits** - Max 30s per execution
4. **Resource limits** - Max 100MB memory, no network beyond gateway

---

## Implementation Notes

### Path Sanitization

All file paths are normalized and validated before access:

```typescript
function isSafePath(p: string): boolean {
  const normalized = path.normalize(p);
  return normalized.startsWith(OPENCLAW_DIR) && 
         !normalized.includes("/identity/") && 
         !normalized.includes("/workspace/");
}
```

### Config Sanitization

Sensitive keys are replaced before returning config:

```typescript
const sensitiveKeys = ["token", "apiKey", "api_key", "secret", "password", "auth"];
```

### Error Handling

All tools return structured errors:

```typescript
interface ToolError {
  code: "NOT_FOUND" | "ACCESS_DENIED" | "PARSE_ERROR" | "TIMEOUT";
  message: string;
  details?: string;
}
```
