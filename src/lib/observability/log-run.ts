/**
 * AI Run Logging
 * 
 * 用于记录 AI 运行日志到 SQLite
 * 包含: route, model config id, provider, model id, start/end time,
 * latency, status, error message, token usage, tool call count, attachment count
 */

import { getDb } from "@/lib/db";
import type { ModelUsage } from "@/lib/ai/types";

export interface AIRunLog {
  id?: number;
  route: string;
  modelConfigId: number | null;
  provider: string | null;
  modelId: string | null;
  startTime: string;
  endTime: string | null;
  latencyMs: number | null;
  status: "success" | "error" | "streaming";
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  toolCallCount: number | null;
  attachmentCount: number;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
}

/**
 * 将 AI SDK v6 的 usage 格式转换为 AIRunLog 格式
 */
export function convertUsage(usage: unknown): ModelUsage {
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const u = usage as Record<string, number>;

  return {
    promptTokens: u.promptTokens ?? u.inputTokens ?? 0,
    completionTokens: u.completionTokens ?? u.outputTokens ?? 0,
    totalTokens: u.totalTokens ?? 0,
  };
}

export interface AIRunFilter {
  route?: string;
  status?: "success" | "error" | "streaming";
  modelId?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/** 单例: 当前运行的 log 记录 */
let currentRun: {
  id: number;
  startTime: Date;
  route: string;
  metadata: Partial<AIRunLog>;
} | null = null;

/**
 * 确保 ai_runs 表存在
 */
export function ensureAIRunSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT NOT NULL,
      model_config_id INTEGER,
      provider TEXT,
      model_id TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      latency_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'streaming',
      error_message TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      tool_call_count INTEGER,
      attachment_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_ai_runs_route ON ai_runs(route);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(status);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_model_id ON ai_runs(model_id);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_start_time ON ai_runs(start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_created_at ON ai_runs(created_at DESC);
  `);
}

/**
 * 开始一个新的运行日志
 */
export function startRun(
  route: string,
  options: {
    modelConfigId?: number;
    provider?: string;
    modelId?: string;
    attachmentCount?: number;
    metadata?: Record<string, unknown>;
  } = {}
): number {
  ensureAIRunSchema();
  const db = getDb();

  const now = new Date();
  const startTime = now.toISOString();

  const result = db
    .prepare(
      `INSERT INTO ai_runs 
        (route, model_config_id, provider, model_id, start_time, status, attachment_count, metadata)
       VALUES (?, ?, ?, ?, ?, 'streaming', ?, ?)`
    )
    .run(
      route,
      options.modelConfigId ?? null,
      options.provider ?? null,
      options.modelId ?? null,
      startTime,
      options.attachmentCount ?? 0,
      options.metadata ? JSON.stringify(options.metadata) : null
    );

  const runId = Number(result.lastInsertRowid);

  currentRun = {
    id: runId,
    startTime: now,
    route,
    metadata: options,
  };

  return runId;
}

/**
 * 结束当前运行日志
 */
export function endRun(
  runId: number,
  options: {
    status?: "success" | "error";
    errorMessage?: string;
    usage?: ModelUsage;
    toolCallCount?: number;
  } = {}
): void {
  const db = getDb();
  const now = new Date();

  const run = db.prepare("SELECT start_time FROM ai_runs WHERE id = ?").get(runId) as
    | { start_time: string }
    | undefined;

  const startTime = run ? new Date(run.start_time) : currentRun?.startTime || now;
  const latencyMs = Math.round(now.getTime() - startTime.getTime());

  db.prepare(
    `UPDATE ai_runs SET 
      end_time = ?,
      latency_ms = ?,
      status = ?,
      error_message = ?,
      prompt_tokens = ?,
      completion_tokens = ?,
      total_tokens = ?,
      tool_call_count = ?
     WHERE id = ?`
  ).run(
    now.toISOString(),
    latencyMs,
    options.status || "success",
    options.errorMessage || null,
    options.usage?.promptTokens ?? null,
    options.usage?.completionTokens ?? null,
    options.usage?.totalTokens ?? null,
    options.toolCallCount ?? null,
    runId
  );

  if (currentRun?.id === runId) {
    currentRun = null;
  }
}

/**
 * 便捷方法: 使用当前运行上下文结束
 */
export function endCurrentRun(
  options: {
    status?: "success" | "error";
    errorMessage?: string;
    usage?: ModelUsage;
    toolCallCount?: number;
  } = {}
): void {
  if (currentRun) {
    endRun(currentRun.id, options);
  }
}

/**
 * 记录运行错误
 * 不会泄露 API keys
 */
export function logError(runId: number, error: unknown): void {
  const errorMessage = sanitizeError(error);
  endRun(runId, {
    status: "error",
    errorMessage,
  });
}

/**
 * 清理敏感信息
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message;
    
    // 移除可能的 API keys
    message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, "[API_KEY]");
    message = message.replace(/[a-zA-Z0-9]{32,}/g, "[REDACTED]");
    
    // 移除 URL 中的 tokens
    message = message.replace(/token=[^&\s]+/g, "token=[REDACTED]");
    message = message.replace(/key=[^&\s]+/g, "key=[REDACTED]");
    
    return message;
  }
  
  return "Unknown error occurred";
}

/**
 * 查询运行日志
 */
export function queryRuns(filter: AIRunFilter = {}): {
  runs: AIRunLog[];
  total: number;
} {
  ensureAIRunSchema();
  const db = getDb();

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (filter.route) {
    whereClause += " AND route = ?";
    params.push(filter.route);
  }
  if (filter.status) {
    whereClause += " AND status = ?";
    params.push(filter.status);
  }
  if (filter.modelId) {
    whereClause += " AND model_id = ?";
    params.push(filter.modelId);
  }
  if (filter.provider) {
    whereClause += " AND provider = ?";
    params.push(filter.provider);
  }
  if (filter.startDate) {
    whereClause += " AND start_time >= ?";
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    whereClause += " AND start_time <= ?";
    params.push(filter.endDate);
  }

  // 计数
  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM ai_runs ${whereClause}`)
    .get(...params) as { count: number };
  const total = countResult.count;

  // 查询数据
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT * FROM ai_runs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
      id: number;
      route: string;
      model_config_id: number | null;
      provider: string | null;
      model_id: string | null;
      start_time: string;
      end_time: string | null;
      latency_ms: number | null;
      status: "success" | "error" | "streaming";
      error_message: string | null;
      prompt_tokens: number | null;
      completion_tokens: number | null;
      total_tokens: number | null;
      tool_call_count: number | null;
      attachment_count: number;
      metadata: string | null;
      created_at: string;
    }>;

  const runs: AIRunLog[] = rows.map(row => ({
    id: row.id,
    route: row.route,
    modelConfigId: row.model_config_id,
    provider: row.provider,
    modelId: row.model_id,
    startTime: row.start_time,
    endTime: row.end_time,
    latencyMs: row.latency_ms,
    status: row.status,
    errorMessage: row.error_message,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    toolCallCount: row.tool_call_count,
    attachmentCount: row.attachment_count,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
  }));

  return { runs, total };
}

/**
 * 获取单个运行详情
 */
export function getRunById(id: number): AIRunLog | null {
  ensureAIRunSchema();
  const db = getDb();

  const row = db.prepare("SELECT * FROM ai_runs WHERE id = ?").get(id) as {
    id: number;
    route: string;
    model_config_id: number | null;
    provider: string | null;
    model_id: string | null;
    start_time: string;
    end_time: string | null;
    latency_ms: number | null;
    status: "success" | "error" | "streaming";
    error_message: string | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    total_tokens: number | null;
    tool_call_count: number | null;
    attachment_count: number;
    metadata: string | null;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    route: row.route,
    modelConfigId: row.model_config_id,
    provider: row.provider,
    modelId: row.model_id,
    startTime: row.start_time,
    endTime: row.end_time,
    latencyMs: row.latency_ms,
    status: row.status,
    errorMessage: row.error_message,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    toolCallCount: row.tool_call_count,
    attachmentCount: row.attachment_count,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
  };
}

/**
 * 获取运行统计
 */
export function getRunStats(days: number = 7): {
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  avgLatencyMs: number;
  totalTokens: number;
  routes: Record<string, number>;
  models: Record<string, number>;
} {
  ensureAIRunSchema();
  const db = getDb();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_runs,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_runs,
      AVG(latency_ms) as avg_latency,
      SUM(total_tokens) as total_tokens_sum
    FROM ai_runs 
    WHERE created_at >= ?
  `).get(sinceStr) as {
    total_runs: number;
    success_runs: number;
    error_runs: number;
    avg_latency: number | null;
    total_tokens_sum: number | null;
  };

  const routeStats = db.prepare(`
    SELECT route, COUNT(*) as count 
    FROM ai_runs 
    WHERE created_at >= ?
    GROUP BY route
  `).all(sinceStr) as Array<{ route: string; count: number }>;

  const modelStats = db.prepare(`
    SELECT model_id, COUNT(*) as count 
    FROM ai_runs 
    WHERE created_at >= ? AND model_id IS NOT NULL
    GROUP BY model_id
  `).all(sinceStr) as Array<{ model_id: string; count: number }>;

  return {
    totalRuns: stats.total_runs || 0,
    successRuns: stats.success_runs || 0,
    errorRuns: stats.error_runs || 0,
    avgLatencyMs: Math.round(stats.avg_latency || 0),
    totalTokens: stats.total_tokens_sum || 0,
    routes: Object.fromEntries(routeStats.map(r => [r.route, r.count])),
    models: Object.fromEntries(modelStats.map(m => [m.model_id, m.count])),
  };
}

/**
 * 获取当前运行记录
 */
export function getCurrentRun() {
  return currentRun;
}
