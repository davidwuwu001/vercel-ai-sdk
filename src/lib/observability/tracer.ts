/**
 * 调用追踪工具
 * 
 * 提供分布式追踪能力，支持 spans、traces 和调用链追踪
 */

import { getDb } from "@/lib/db";

export type SpanStatus = "ok" | "error" | "cancelled";

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: SpanStatus;
  errorMessage?: string;
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: string;
  fields: Record<string, string | number | boolean>;
}

export interface Trace {
  id: string;
  spans: Span[];
  startTime: string;
  endTime?: string;
  durationMs?: number;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 追踪收集器单例
 */
class TracerCollector {
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private db: ReturnType<typeof getDb> | null = null;
  private _currentTraceId: string | null = null;

  /**
   * 获取当前 trace ID
   */
  getCurrentTraceId(): string | null {
    return this._currentTraceId;
  }

  private getDb() {
    if (!this.db) {
      this.db = getDb();
      this.ensureSchema();
    }
    return this.db;
  }

  /**
   * 确保追踪表存在
   */
  private ensureSchema(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spans (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        service TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_ms INTEGER,
        status TEXT NOT NULL DEFAULT 'ok',
        error_message TEXT,
        tags TEXT,
        logs TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trace_id) REFERENCES traces(id)
      );

      CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_parent_id ON spans(parent_id);
      CREATE INDEX IF NOT EXISTS idx_spans_name ON spans(name);
      CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time DESC);
    `);
  }

  /**
   * 创建新的追踪
   */
  startTrace(): string {
    const traceId = generateId();
    this._currentTraceId = traceId;

    const trace: Trace = {
      id: traceId,
      spans: [],
      startTime: new Date().toISOString(),
    };

    try {
      const db = this.getDb();
      db.prepare(
        "INSERT INTO traces (id, start_time) VALUES (?, ?)"
      ).run(traceId, trace.startTime);
    } catch {
      // 数据库可能不可用
    }

    return traceId;
  }

  /**
   * 结束追踪
   */
  endTrace(traceId: string): void {
    const firstSpan = Array.from(this.spans.values()).find(
      (s) => s.traceId === traceId && !s.parentId
    );

    if (firstSpan) {
      const lastSpan = Array.from(this.spans.values())
        .filter((s) => s.traceId === traceId)
        .sort((a, b) => {
          const aEnd = a.endTime || a.startTime;
          const bEnd = b.endTime || b.startTime;
          return aEnd.localeCompare(bEnd);
        })
        .pop();

      if (lastSpan?.endTime) {
        const db = this.getDb();
        const startTime = new Date(firstSpan.startTime);
        const endTime = new Date(lastSpan.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();

        try {
          db.prepare(
            "UPDATE traces SET end_time = ?, duration_ms = ? WHERE id = ?"
          ).run(lastSpan.endTime, durationMs, traceId);
        } catch {
          // 数据库可能不可用
        }
      }
    }

    if (this._currentTraceId === traceId) {
      this._currentTraceId = null;
    }
  }

  /**
   * 开始一个新的 span
   */
  startSpan(
    name: string,
    options: {
      service?: string;
      traceId?: string;
      parentId?: string;
      tags?: Record<string, string | number | boolean>;
    } = {}
  ): string {
    const traceId = options.traceId || this._currentTraceId || this.startTrace();
    const spanId = generateId();

    const span: Span = {
      id: spanId,
      traceId,
      parentId: options.parentId,
      name,
      service: options.service || "default",
      startTime: new Date().toISOString(),
      status: "ok",
      tags: options.tags || {},
      logs: [],
    };

    this.spans.set(spanId, span);
    this.activeSpans.set(spanId, span);

    return spanId;
  }

  /**
   * 结束 span
   */
  endSpan(
    spanId: string,
    options: {
      status?: SpanStatus;
      errorMessage?: string;
      tags?: Record<string, string | number | boolean>;
    } = {}
  ): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    const now = new Date().toISOString();
    span.endTime = now;
    span.durationMs = new Date(now).getTime() - new Date(span.startTime).getTime();
    span.status = options.status || span.status;

    if (options.errorMessage) {
      span.errorMessage = options.errorMessage;
      span.status = "error";
    }

    if (options.tags) {
      span.tags = { ...span.tags, ...options.tags };
    }

    // 持久化到数据库
    try {
      const db = this.getDb();
      db.prepare(`
        INSERT INTO spans (
          id, trace_id, parent_id, name, service, start_time, end_time,
          duration_ms, status, error_message, tags, logs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        span.id,
        span.traceId,
        span.parentId || null,
        span.name,
        span.service,
        span.startTime,
        span.endTime,
        span.durationMs,
        span.status,
        span.errorMessage || null,
        JSON.stringify(span.tags),
        JSON.stringify(span.logs)
      );
    } catch {
      // 数据库可能不可用
    }

    this.activeSpans.delete(spanId);
  }

  /**
   * 添加 span 日志
   */
  addSpanLog(spanId: string, fields: Record<string, string | number | boolean>): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: new Date().toISOString(),
      fields,
    });
  }

  /**
   * 给 span 添加标签
   */
  setSpanTag(
    spanId: string,
    key: string,
    value: string | number | boolean
  ): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.tags[key] = value;
  }

  /**
   * 获取 span
   */
  getSpan(spanId: string): Span | null {
    return this.spans.get(spanId) || null;
  }

  /**
   * 获取追踪
   */
  getTrace(traceId: string): Trace | null {
    const spans = Array.from(this.spans.values()).filter(
      (s) => s.traceId === traceId
    );

    if (spans.length === 0) return null;

    const startTime = spans
      .map((s) => s.startTime)
      .sort()[0];
    const endTime = spans
      .map((s) => s.endTime || s.startTime)
      .sort()
      .pop();

    return {
      id: traceId,
      spans,
      startTime,
      endTime,
      durationMs: endTime
        ? new Date(endTime).getTime() - new Date(startTime).getTime()
        : undefined,
    };
  }

  /**
   * 获取当前活跃的 span
   */
  getCurrentSpan(): Span | null {
    const activeSpans = Array.from(this.activeSpans.values());
    return activeSpans[activeSpans.length - 1] || null;
  }

  /**
   * 获取追踪列表
   */
  listTraces(limit: number = 50): Trace[] {
    try {
      const db = this.getDb();
      const rows = db.prepare(
        "SELECT * FROM traces ORDER BY start_time DESC LIMIT ?"
      ).all(limit) as Array<{
        id: string;
        start_time: string;
        end_time: string | null;
        duration_ms: number | null;
      }>;

      return rows.map((row) => ({
        id: row.id,
        spans: [],
        startTime: row.start_time,
        endTime: row.end_time || undefined,
        durationMs: row.duration_ms || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 获取追踪的 span
   */
  getTraceSpans(traceId: string): Span[] {
    try {
      const db = this.getDb();
      const rows = db.prepare(
        "SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time"
      ).all(traceId) as Array<{
        id: string;
        trace_id: string;
        parent_id: string | null;
        name: string;
        service: string;
        start_time: string;
        end_time: string | null;
        duration_ms: number | null;
        status: SpanStatus;
        error_message: string | null;
        tags: string;
        logs: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        traceId: row.trace_id,
        parentId: row.parent_id || undefined,
        name: row.name,
        service: row.service,
        startTime: row.start_time,
        endTime: row.end_time || undefined,
        durationMs: row.duration_ms || undefined,
        status: row.status,
        errorMessage: row.error_message || undefined,
        tags: JSON.parse(row.tags || "{}"),
        logs: JSON.parse(row.logs || "[]"),
      }));
    } catch {
      return [];
    }
  }
}

/**
 * 全局追踪收集器实例
 */
export const tracer = new TracerCollector();

/**
 * Span 上下文
 */
export interface SpanContext {
  spanId: string;
  traceId: string;
}

/**
 * 带追踪的函数包装器
 */
export async function withSpan<T>(
  name: string,
  fn: (context: SpanContext) => Promise<T>,
  options: {
    service?: string;
    tags?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  const parentSpan = tracer.getCurrentSpan();
  const spanId = tracer.startSpan(name, {
    service: options.service,
    parentId: parentSpan?.id,
    tags: options.tags,
  });

  try {
    const result = await fn({
      spanId,
      traceId: parentSpan?.traceId || tracer.getCurrentTraceId() || "",
    });
    tracer.endSpan(spanId, { status: "ok" });
    return result;
  } catch (error) {
    tracer.endSpan(spanId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * 带追踪的同步函数包装器
 */
export function withSpanSync<T>(
  name: string,
  fn: (context: SpanContext) => T,
  options: {
    service?: string;
    tags?: Record<string, string | number | boolean>;
  } = {}
): T {
  const parentSpan = tracer.getCurrentSpan();
  const spanId = tracer.startSpan(name, {
    service: options.service,
    parentId: parentSpan?.id,
    tags: options.tags,
  });

  try {
    const result = fn({
      spanId,
      traceId: parentSpan?.traceId || tracer.getCurrentTraceId() || "",
    });
    tracer.endSpan(spanId, { status: "ok" });
    return result;
  } catch (error) {
    tracer.endSpan(spanId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * 创建 span 的便捷类
 */
export class SpanTimer {
  private name: string;
  private service: string;
  private tags: Record<string, string | number | boolean>;
  private spanId?: string;

  constructor(
    name: string,
    options: {
      service?: string;
      tags?: Record<string, string | number | boolean>;
    } = {}
  ) {
    this.name = name;
    this.service = options.service || "default";
    this.tags = options.tags || {};
  }

  start(): this {
    const parentSpan = tracer.getCurrentSpan();
    this.spanId = tracer.startSpan(this.name, {
      service: this.service,
      parentId: parentSpan?.id,
      tags: this.tags,
    });
    return this;
  }

  end(options: { status?: SpanStatus; errorMessage?: string } = {}): void {
    if (this.spanId) {
      tracer.endSpan(this.spanId, options);
    }
  }

  log(fields: Record<string, string | number | boolean>): void {
    if (this.spanId) {
      tracer.addSpanLog(this.spanId, fields);
    }
  }

  tag(key: string, value: string | number | boolean): this {
    if (this.spanId) {
      tracer.setSpanTag(this.spanId, key, value);
    }
    this.tags[key] = value;
    return this;
  }
}

/**
 * 便捷函数：创建并自动启动 span timer
 */
export function startSpan(
  name: string,
  options?: { service?: string; tags?: Record<string, string | number | boolean> }
): SpanTimer {
  return new SpanTimer(name, options).start();
}

/**
 * 获取当前追踪 ID
 */
export function getCurrentTraceId(): string | null {
  return tracer.getCurrentTraceId();
}
