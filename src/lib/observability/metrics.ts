/**
 * 基础指标收集
 * 
 * 提供应用运行时指标收集，包括计数器、仪表盘和直方图
 */

import { getDb } from "@/lib/db";

export interface Counter {
  name: string;
  description?: string;
  value: number;
  labels: Record<string, string>;
}

export interface Gauge {
  name: string;
  description?: string;
  value: number;
  labels: Record<string, string>;
}

export interface Histogram {
  name: string;
  description?: string;
  buckets: { le: number; count: number }[];
  sum: number;
  count: number;
  labels: Record<string, string>;
}

export interface MetricSnapshot {
  counters: Counter[];
  gauges: Gauge[];
  histograms: Histogram[];
  timestamp: string;
}

/**
 * 指标收集器单例
 */
class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private db: ReturnType<typeof getDb> | null = null;

  private getDb() {
    if (!this.db) {
      this.db = getDb();
      this.ensureSchema();
    }
    return this.db;
  }

  /**
   * 确保指标表存在
   */
  private ensureSchema(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_counters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        labels TEXT,
        value INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, labels)
      );

      CREATE TABLE IF NOT EXISTS metrics_gauges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        labels TEXT,
        value REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, labels)
      );

      CREATE TABLE IF NOT EXISTS metrics_histograms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        labels TEXT,
        bucket_le TEXT,
        bucket_count INTEGER NOT NULL DEFAULT 0,
        sum REAL NOT NULL DEFAULT 0,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, labels, bucket_le)
      );

      CREATE INDEX IF NOT EXISTS idx_counters_name ON metrics_counters(name);
      CREATE INDEX IF NOT EXISTS idx_gauges_name ON metrics_gauges(name);
      CREATE INDEX IF NOT EXISTS idx_histograms_name ON metrics_histograms(name);
    `);
  }

  /**
   * 生成指标唯一键
   */
  private makeKey(name: string, labels?: Record<string, string>): string {
    const sortedLabels = labels
      ? Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).join(";")
      : "";
    return `${name}:${sortedLabels}`;
  }

  /**
   * 序列化标签
   */
  private serializeLabels(labels?: Record<string, string>): string {
    return labels ? JSON.stringify(labels) : "";
  }

  /**
   * 反序列化标签
   */
  private deserializeLabels(str: string): Record<string, string> {
    return str ? JSON.parse(str) : {};
  }

  // ==================== 计数器 ====================

  /**
   * 增加计数器
   */
  incCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.makeKey(name, labels);

    const counter = this.counters.get(key) || {
      name,
      labels: labels || {},
      value: 0,
    };
    counter.value += value;
    this.counters.set(key, counter);

    // 持久化到数据库
    try {
      const db = this.getDb();
      const labelsStr = this.serializeLabels(labels);
      db.prepare(`
        INSERT INTO metrics_counters (name, labels, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(name, labels) DO UPDATE SET
          value = value + excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(name, labelsStr, value);
    } catch {
      // 数据库可能不可用，静默失败
    }
  }

  /**
   * 获取计数器
   */
  getCounter(name: string, labels?: Record<string, string>): Counter | null {
    const key = this.makeKey(name, labels);
    return this.counters.get(key) || null;
  }

  /**
   * 获取所有计数器
   */
  getAllCounters(): Counter[] {
    return Array.from(this.counters.values());
  }

  // ==================== 仪表盘 ====================

  /**
   * 设置仪表盘值
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);

    const gauge: Gauge = {
      name,
      labels: labels || {},
      value,
    };
    this.gauges.set(key, gauge);

    // 持久化到数据库
    try {
      const db = this.getDb();
      const labelsStr = this.serializeLabels(labels);
      db.prepare(`
        INSERT INTO metrics_gauges (name, labels, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(name, labels) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(name, labelsStr, value);
    } catch {
      // 数据库可能不可用，静默失败
    }
  }

  /**
   * 增加仪表盘值
   */
  incGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const current = this.gauges.get(key);
    const newValue = (current?.value || 0) + value;
    this.setGauge(name, newValue, labels);
  }

  /**
   * 减少仪表盘值
   */
  decGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const current = this.gauges.get(key);
    const newValue = (current?.value || 0) - value;
    this.setGauge(name, newValue, labels);
  }

  /**
   * 获取仪表盘
   */
  getGauge(name: string, labels?: Record<string, string>): Gauge | null {
    const key = this.makeKey(name, labels);
    return this.gauges.get(key) || null;
  }

  /**
   * 获取所有仪表盘
   */
  getAllGauges(): Gauge[] {
    return Array.from(this.gauges.values());
  }

  // ==================== 直方图 ====================

  private readonly DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  /**
   * 观察直方图值
   */
  observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: number[] = this.DEFAULT_BUCKETS
  ): void {
    const key = this.makeKey(name, labels);

    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = {
        name,
        labels: labels || {},
        buckets: buckets.map((le) => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    histogram.sum += value;
    histogram.count += 1;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }

    // 持久化到数据库
    try {
      const db = this.getDb();
      const labelsStr = this.serializeLabels(labels);

      for (const bucket of histogram.buckets) {
        db.prepare(`
          INSERT INTO metrics_histograms (name, labels, bucket_le, bucket_count, sum, count, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(name, labels, bucket_le) DO UPDATE SET
            bucket_count = excluded.bucket_count,
            sum = excluded.sum,
            count = excluded.count,
            updated_at = CURRENT_TIMESTAMP
        `).run(name, labelsStr, bucket.le, bucket.count, histogram.sum, histogram.count);
      }
    } catch {
      // 数据库可能不可用，静默失败
    }
  }

  /**
   * 获取直方图
   */
  getHistogram(name: string, labels?: Record<string, string>): Histogram | null {
    const key = this.makeKey(name, labels);
    return this.histograms.get(key) || null;
  }

  /**
   * 获取所有直方图
   */
  getAllHistograms(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  // ==================== 便捷方法 ====================

  /**
   * 记录 API 请求
   */
  recordApiRequest(
    route: string,
    method: string,
    statusCode: number,
    latencyMs: number
  ): void {
    const labels = { route, method, status: String(statusCode) };

    this.incCounter("api_requests_total", labels);
    this.observeHistogram("api_request_duration_ms", latencyMs, { route });
  }

  /**
   * 记录 Token 使用
   */
  recordTokenUsage(
    modelId: string,
    promptTokens: number,
    completionTokens: number
  ): void {
    this.incCounter("tokens_total", { model: modelId, type: "prompt" }, promptTokens);
    this.incCounter("tokens_total", { model: modelId, type: "completion" }, completionTokens);
  }

  /**
   * 记录错误
   */
  recordError(errorType: string, route?: string): void {
    const labels: Record<string, string> = { type: errorType };
    if (route) labels.route = route;
    this.incCounter("errors_total", labels);
  }

  // ==================== 快照和重置 ====================

  /**
   * 获取指标快照
   */
  snapshot(): MetricSnapshot {
    return {
      counters: this.getAllCounters(),
      gauges: this.getAllGauges(),
      histograms: this.getAllHistograms(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 从数据库加载指标
   */
  loadFromDb(): void {
    try {
      const db = this.getDb();

      // 加载计数器
      const counterRows = db.prepare(
        "SELECT name, labels, value FROM metrics_counters"
      ).all() as Array<{ name: string; labels: string; value: number }>;

      for (const row of counterRows) {
        const labels = this.deserializeLabels(row.labels);
        const key = this.makeKey(row.name, labels);
        this.counters.set(key, {
          name: row.name,
          labels,
          value: row.value,
        });
      }

      // 加载仪表盘
      const gaugeRows = db.prepare(
        "SELECT name, labels, value FROM metrics_gauges"
      ).all() as Array<{ name: string; labels: string; value: number }>;

      for (const row of gaugeRows) {
        const labels = this.deserializeLabels(row.labels);
        const key = this.makeKey(row.name, labels);
        this.gauges.set(key, {
          name: row.name,
          labels,
          value: row.value,
        });
      }
    } catch {
      // 数据库可能不可用
    }
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

/**
 * 全局指标收集器实例
 */
export const metricsCollector = new MetricsCollector();

// 便捷导出
export const incCounter = (name: string, labels?: Record<string, string>, value?: number) =>
  metricsCollector.incCounter(name, labels, value);
export const setGauge = (name: string, value: number, labels?: Record<string, string>) =>
  metricsCollector.setGauge(name, value, labels);
export const incGauge = (name: string, value: number, labels?: Record<string, string>) =>
  metricsCollector.incGauge(name, value, labels);
export const decGauge = (name: string, value: number, labels?: Record<string, string>) =>
  metricsCollector.decGauge(name, value, labels);
export const observeHistogram = (
  name: string,
  value: number,
  labels?: Record<string, string>,
  buckets?: number[]
) => metricsCollector.observeHistogram(name, value, labels, buckets);

/**
 * 常用指标名称
 */
export const MetricNames = {
  // API 指标
  API_REQUESTS_TOTAL: "api_requests_total",
  API_REQUEST_DURATION: "api_request_duration_ms",
  API_ERRORS: "api_errors_total",

  // AI 指标
  AI_REQUESTS_TOTAL: "ai_requests_total",
  AI_REQUEST_DURATION: "ai_request_duration_ms",
  TOKENS_TOTAL: "tokens_total",

  // 业务指标
  ACTIVE_SESSIONS: "active_sessions",
  DOCUMENT_PARSES: "document_parses_total",
  AGENT_RUNS: "agent_runs_total",
} as const;
