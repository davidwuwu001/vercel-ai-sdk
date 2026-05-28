/**
 * API 可观测性中间件
 * 
 * 提供统一的日志、指标和追踪集成
 */

import { createRequestLogger, sanitize } from "./logger";
import { metricsCollector, MetricNames } from "./metrics";
import { tracer, withSpan, type SpanContext } from "./tracer";
import { startRun, endRun, logError } from "./log-run";

export interface ObservabilityOptions {
  /** 是否启用日志 */
  enableLogging?: boolean;
  /** 是否启用指标 */
  enableMetrics?: boolean;
  /** 是否启用追踪 */
  enableTracing?: boolean;
  /** 服务名称 */
  service?: string;
  /** 自定义标签 */
  tags?: Record<string, string>;
}

/**
 * 带可观测性的 API 处理器包装器
 */
export function withObservability(
  handler: (req: Request, context: ObservabilityContext) => Promise<Response>,
  options: ObservabilityOptions = {}
) {
  const {
    enableLogging = true,
    enableMetrics = true,
    enableTracing = true,
    service = "api",
    tags = {},
  } = options;

  return async (req: Request): Promise<Response> => {
    let spanId: string | null = null;
    let requestLogger: ReturnType<typeof createRequestLogger> | null = null;
    const startTime = Date.now();

    // 初始化日志记录器
    if (enableLogging) {
      requestLogger = createRequestLogger(req);
      requestLogger.info("Request started");
    }

    // 初始化追踪
    if (enableTracing) {
      spanId = tracer.startSpan(req.url, {
        service,
        tags: {
          method: req.method,
          url: req.url,
          ...tags,
        },
      });
    }

    try {
      const context: ObservabilityContext = {
        request: req,
        service,
        tags: { ...tags },
        log: requestLogger,
      };

      const result = await handler(req, context);

      const latencyMs = Date.now() - startTime;

      // 记录成功
      if (enableMetrics) {
        metricsCollector.recordApiRequest(req.url, req.method, 200, latencyMs);
      }

      if (requestLogger) {
        requestLogger.complete(200, latencyMs);
      }

      if (spanId) {
        tracer.endSpan(spanId, {
          status: "ok",
          tags: { statusCode: 200, latencyMs },
        });
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const statusCode = error instanceof APIError ? error.statusCode : 500;
      const errorMessage = error instanceof Error ? sanitize(error.message) : "Unknown error";

      // 记录错误
      if (enableMetrics) {
        metricsCollector.recordApiRequest(req.url, req.method, statusCode, latencyMs);
        metricsCollector.recordError("api_error", req.url);
      }

      if (requestLogger) {
        requestLogger.error(error);
      }

      if (spanId) {
        tracer.endSpan(spanId, {
          status: "error",
          errorMessage,
          tags: { statusCode, latencyMs },
        });
      }

      throw error;
    }
  };
}

/**
 * 可观测性上下文
 */
export interface ObservabilityContext {
  request: Request;
  service: string;
  tags: Record<string, string>;
  log: ReturnType<typeof createRequestLogger> | null;
}

/**
 * 带追踪的函数执行
 */
export async function traced<T>(
  name: string,
  fn: (context: SpanContext) => Promise<T>,
  options: { service?: string; tags?: Record<string, string | number | boolean> } = {}
): Promise<T> {
  return withSpan(name, fn, {
    service: options.service,
    tags: options.tags,
  });
}

/**
 * AI Run 日志包装器
 */
export async function withRunLogging<T>(
  route: string,
  fn: () => Promise<T>,
  options: {
    modelConfigId?: number;
    provider?: string;
    modelId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const runId = startRun(route, options);

  try {
    const result = await fn();
    endRun(runId, { status: "success" });
    return result;
  } catch (error) {
    logError(runId, error);
    throw error;
  }
}

/**
 * 自定义 API 错误
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * 便捷方法：创建 400 错误
 */
export function badRequest(message: string, code?: string): never {
  throw new APIError(message, 400, code);
}

/**
 * 便捷方法：创建 401 错误
 */
export function unauthorized(message: string = "Unauthorized"): never {
  throw new APIError(message, 401, "UNAUTHORIZED");
}

/**
 * 便捷方法：创建 404 错误
 */
export function notFound(message: string = "Not found"): never {
  throw new APIError(message, 404, "NOT_FOUND");
}

/**
 * 便捷方法：创建 500 错误
 */
export function internalError(message: string = "Internal server error"): never {
  throw new APIError(message, 500, "INTERNAL_ERROR");
}

/**
 * 记录 AI 请求
 */
export function recordAIRequest(
  modelId: string,
  provider: string,
  latencyMs: number,
  tokens?: {
    promptTokens: number;
    completionTokens: number;
  }
): void {
  metricsCollector.incCounter(MetricNames.AI_REQUESTS_TOTAL, {
    model: modelId,
    provider,
  });

  metricsCollector.observeHistogram(
    MetricNames.AI_REQUEST_DURATION,
    latencyMs,
    { model: modelId, provider }
  );

  if (tokens) {
    metricsCollector.recordTokenUsage(modelId, tokens.promptTokens, tokens.completionTokens);
  }
}
