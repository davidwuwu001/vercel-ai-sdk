/**
 * 结构化日志工具
 * 
 * 提供统一的日志接口，支持不同级别、上下文和格式化输出
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: string | number | boolean | undefined | null;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentMinLevel: LogLevel = "info";

/**
 * 设置最小日志级别
 */
export function setMinLevel(level: LogLevel): void {
  currentMinLevel = level;
}

/**
 * 获取最小日志级别
 */
export function getMinLevel(): LogLevel {
  return currentMinLevel;
}

/**
 * 创建日志条目
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

/**
 * 检查是否应该记录该级别
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentMinLevel];
}

/**
 * 格式化日志输出
 */
function formatLog(entry: LogEntry): string {
  const parts: string[] = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.message,
  ];

  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = Object.entries(entry.context)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");
    parts.push(`{${contextStr}}`);
  }

  if (entry.error) {
    parts.push(`Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(entry.error.stack);
    }
  }

  return parts.join(" ");
}

/**
 * 输出日志到控制台
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLog(entry);

  switch (entry.level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/**
 * 记录调试日志
 */
export function debug(message: string, context?: LogContext): void {
  if (shouldLog("debug")) {
    outputLog(createLogEntry("debug", message, context));
  }
}

/**
 * 记录信息日志
 */
export function info(message: string, context?: LogContext): void {
  if (shouldLog("info")) {
    outputLog(createLogEntry("info", message, context));
  }
}

/**
 * 记录警告日志
 */
export function warn(message: string, context?: LogContext): void {
  if (shouldLog("warn")) {
    outputLog(createLogEntry("warn", message, context));
  }
}

/**
 * 记录错误日志
 */
export function error(message: string, error?: unknown, context?: LogContext): void {
  if (shouldLog("error")) {
    outputLog(createLogEntry("error", message, context, error));
  }
}

/**
 * 创建带上下文的日志记录器
 */
export function createLogger(context: LogContext) {
  return {
    debug: (message: string, extra?: LogContext) =>
      debug(message, { ...context, ...extra }),
    info: (message: string, extra?: LogContext) =>
      info(message, { ...context, ...extra }),
    warn: (message: string, extra?: LogContext) =>
      warn(message, { ...context, ...extra }),
    error: (message: string, err?: unknown, extra?: LogContext) =>
      error(message, err, { ...context, ...extra }),
  };
}

/**
 * API 请求日志中间件类型
 */
export interface RequestLogContext {
  method: string;
  url: string;
  statusCode?: number;
  latencyMs?: number;
  userAgent?: string;
  ip?: string;
}

/**
 * 创建请求日志记录器
 */
export function createRequestLogger(req: Request): {
  info: (message: string, extra?: LogContext) => void;
  warn: (message: string, extra?: LogContext) => void;
  complete: (statusCode: number, latencyMs: number) => void;
  error: (err: unknown) => void;
} {
  const baseContext: LogContext = {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get("user-agent") || undefined,
  };

  return {
    info: (message: string, extra?: LogContext) => {
      info(message, { ...baseContext, ...extra });
    },
    warn: (message: string, extra?: LogContext) => {
      warn(message, { ...baseContext, ...extra });
    },
    complete: (statusCode: number, latencyMs: number) => {
      const level: LogLevel = statusCode >= 400 ? "warn" : "info";
      const message = `${req.method} ${req.url} ${statusCode}`;
      
      if (level === "warn") {
        warn(message, { ...baseContext, statusCode, latencyMs });
      } else {
        info(message, { ...baseContext, statusCode, latencyMs });
      }
    },
    error: (err: unknown) => {
      error(`${req.method} ${req.url} failed`, err, baseContext);
    },
  };
}

/**
 * 清理敏感信息的正则
 */
const SENSITIVE_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: "[API_KEY]" },
  { pattern: /token=[^&\s]+/g, replacement: "token=[REDACTED]" },
  { pattern: /key=[^&\s]+/g, replacement: "key=[REDACTED]" },
  { pattern: /password=[^&\s]+/g, replacement: "password=[REDACTED]" },
  { pattern: /bearer [^&\s]+/gi, replacement: "bearer [REDACTED]" },
];

/**
 * 清理敏感信息
 */
export function sanitize(data: string): string {
  let result = data;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * 导出日志收集器（用于批量发送到日志服务）
 */
export class LogCollector {
  private entries: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  getAll(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  filter(predicate: (entry: LogEntry) => boolean): LogEntry[] {
    return this.entries.filter(predicate);
  }

  getByLevel(level: LogLevel): LogEntry[] {
    return this.filter((e) => e.level === level);
  }

  getRecent(count: number): LogEntry[] {
    return this.entries.slice(-count);
  }
}

/**
 * 全局日志收集器实例
 */
export const globalLogCollector = new LogCollector();

/**
 * 拦截控制台日志并收集
 */
export function startConsoleCapture(): void {
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    globalLogCollector.add(createLogEntry("debug", String(args[0])));
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    globalLogCollector.add(createLogEntry("info", String(args[0])));
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    globalLogCollector.add(createLogEntry("warn", String(args[0])));
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    globalLogCollector.add(createLogEntry("error", String(args[0])));
  };
}

/**
 * 停止控制台日志拦截
 */
export function stopConsoleCapture(): void {
  // 恢复到原始实现（此处简化处理）
  // 在实际生产环境中可能需要保存原始引用
}
