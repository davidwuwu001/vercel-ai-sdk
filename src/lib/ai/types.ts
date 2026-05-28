/**
 * 共享运行时类型定义
 * 作为后续所有阶段的共享契约
 */

/** 支持的 Provider 类型 */
export type ProviderKind =
  | "volcengine"   // 火山引擎 / 豆包
  | "openai"       // OpenAI 兼容接口
  | "anthropic"    // Anthropic
  | "google"       // Google Gemini
  | "bailian"      // 阿里云百炼
  | "vercel-gateway"; // Vercel AI Gateway

/** 模型能力标志 */
export type ModelCapability =
  | "chat"
  | "streaming"
  | "vision"
  | "files"
  | "function-calling"
  | "structured-output"
  | "json-mode"
  | "reasoning";

/** 运行时模型配置 - 仅包含运行时需要的信息，不包含敏感数据 */
export interface ModelRuntimeConfig {
  /** 唯一标识符 */
  id: number;
  /** 显示名称 */
  name: string;
  /** Provider 类型 */
  provider: ProviderKind;
  /** 实际调用的模型 ID */
  modelId: string;
  /** Base URL */
  baseUrl: string;
  /** 环境变量名（用于日志展示，不包含实际 key） */
  apiKeyEnv: string;
  /** 是否支持视觉/多模态 */
  supportsVision: boolean;
  /** 是否支持文件输入 */
  supportsFiles: boolean;
  /** 能力列表 */
  capabilities: ModelCapability[];
}

/** 模型使用量统计 */
export interface ModelUsage {
  /** 输入 token 数 */
  promptTokens?: number;
  /** 输出 token 数 */
  completionTokens?: number;
  /** 总 token 数 */
  totalTokens?: number;
  /** 延迟（毫秒） */
  latencyMs?: number;
}

/** Provider 策略类型 */
export type ProviderStrategy =
  | "direct"           // 直接调用 provider
  | "vercel-gateway";  // 通过 Vercel AI Gateway

/** 扩展的运行时配置（用于高级场景） */
export interface ExtendedModelRuntimeConfig extends ModelRuntimeConfig {
  /** Provider 策略 */
  strategy: ProviderStrategy;
  /** Vercel AI Gateway slug（当 strategy 为 vercel-gateway 时使用） */
  gatewaySlug?: string;
  /** 降级模型列表（按优先级排序） */
  fallbackModels?: string[];
}
