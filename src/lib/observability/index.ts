/**
 * 可观测性模块统一导出
 */

export {
  // 日志
  type LogLevel,
  type LogContext,
  type LogEntry,
  type RequestLogContext,
  debug,
  info,
  warn,
  error,
  createLogger,
  createRequestLogger,
  sanitize,
  LogCollector,
  globalLogCollector,
  startConsoleCapture,
  stopConsoleCapture,
  setMinLevel,
  getMinLevel,
} from "./logger";

export {
  // 指标
  type Counter,
  type Gauge,
  type Histogram,
  type MetricSnapshot,
  metricsCollector,
  incCounter,
  setGauge,
  incGauge,
  decGauge,
  observeHistogram,
  MetricNames,
} from "./metrics";

export {
  // 追踪
  type SpanStatus,
  type Span,
  type SpanLog,
  type Trace,
  type SpanContext,
  tracer,
  withSpan,
  withSpanSync,
  SpanTimer,
  startSpan,
  getCurrentTraceId,
} from "./tracer";

export {
  // 中间件
  withObservability,
  withRunLogging,
  traced,
  recordAIRequest,
  type ObservabilityContext,
  type ObservabilityOptions,
  APIError,
  badRequest,
  unauthorized,
  notFound,
  internalError,
} from "./middleware";
