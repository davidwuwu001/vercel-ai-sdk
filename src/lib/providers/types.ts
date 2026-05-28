import { z } from "zod";

/**
 * Provider 类型枚举
 */
export const ProviderKindSchema = z.enum([
  "openai-compatible", // 通用 OpenAI 兼容接口 (Volcengine Ark, Bailian 等)
  "vercel-gateway", // Vercel AI Gateway 多 provider 路由
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

/**
 * Provider 路由策略
 * - direct: 直接连接 provider，不经过 Gateway
 * - gateway: 通过 Vercel AI Gateway 路由
 */
export const ProviderStrategySchema = z.enum(["direct", "gateway"]);
export type ProviderStrategy = z.infer<typeof ProviderStrategySchema>;

/**
 * 已知 Provider 类型
 */
export const KnownProviderSchema = z.enum([
  "volcengine", // 火山引擎 Ark
  "bailian", // 阿里云百炼
  "openai",
  "anthropic",
  "google",
  "custom", // 自定义 OpenAI 兼容
]);
export type KnownProvider = z.infer<typeof KnownProviderSchema>;

/**
 * Provider 基础配置
 */
export interface ProviderConfig {
  /** Provider 类型标识 */
  kind: ProviderKind;
  /** 已知 Provider 名称 */
  knownProvider: KnownProvider;
  /** 自定义 provider 名称（当 knownProvider 为 custom 时使用） */
  customProviderName?: string;
}

/**
 * Direct Provider 配置（直接连接）
 */
export interface DirectProviderConfig extends ProviderConfig {
  strategy: "direct";
  /** API 端点 */
  baseUrl: string;
  /** API Key 环境变量名 */
  apiKeyEnv: string;
  /** 是否使用 streaming */
  streaming?: boolean;
}

/**
 * Gateway Provider 配置（通过 Vercel AI Gateway）
 */
export interface GatewayProviderConfig extends ProviderConfig {
  strategy: "gateway";
  /** Gateway 基础 URL */
  gatewayBaseUrl?: string;
  /** Gateway slug（可选，用于特定路由） */
  gatewaySlug?: string;
  /** Gateway API Token 环境变量名 */
  gatewayTokenEnv?: string;
  /** Fallback 模型 ID（当主要模型失败时） */
  fallbackModelIds?: string[];
  /** 是否启用 streaming */
  streaming?: boolean;
}

/**
 * 统一的 Provider 配置
 */
export type UnifiedProviderConfig = DirectProviderConfig | GatewayProviderConfig;

/**
 * 模型运行时配置（扩展自 Provider 配置）
 */
export interface ModelRuntimeConfig {
  /** 模型 ID */
  modelId: string;
  /** Provider 配置 */
  provider: UnifiedProviderConfig;
  /** 模型能力 */
  capabilities: ModelCapabilities;
  /** 额外的模型参数 */
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    stop?: string[];
  };
}

/**
 * 模型能力标识
 */
export interface ModelCapabilities {
  /** 是否支持视觉/图片输入 */
  vision?: boolean;
  /** 是否支持文件上传 */
  files?: boolean;
  /** 是否支持流式输出 */
  streaming?: boolean;
  /** 是否支持工具调用 */
  tools?: boolean;
  /** 是否支持结构化输出 */
  structuredOutput?: boolean;
}

/**
 * 模型使用量统计
 */
export interface ModelUsage {
  /** 提示词 token 数量 */
  promptTokens?: number;
  /** 生成 token 数量 */
  completionTokens?: number;
  /** 总 token 数量 */
  totalTokens?: number;
  /** 推理时间（毫秒） */
  latencyMs?: number;
}

/**
 * 模型对比结果
 */
export interface ModelCompareResult {
  /** 模型 ID */
  modelId: string;
  /** 模型名称 */
  modelName: string;
  /** Provider 类型 */
  provider: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 输出内容 */
  output?: string;
  /** 使用量统计 */
  usage?: ModelUsage;
  /** 延迟（毫秒） */
  latencyMs: number;
  /** 输出长度（字符数） */
  outputLength: number;
  /** 完成时间戳 */
  completedAt: string;
}

/**
 * 已知 Provider 的默认配置
 */
export const DEFAULT_PROVIDER_CONFIGS: Record<
  KnownProvider,
  { baseUrl: string; apiKeyEnv: string }
> = {
  volcengine: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyEnv: "VOLCENGINE_API_KEY",
  },
  bailian: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GOOGLE_API_KEY",
  },
  custom: {
    baseUrl: "",
    apiKeyEnv: "CUSTOM_API_KEY",
  },
};

/**
 * 判断是否为已知 Provider
 */
export function isKnownProvider(provider: string): provider is KnownProvider {
  return [
    "volcengine",
    "bailian",
    "openai",
    "anthropic",
    "google",
    "custom",
  ].includes(provider);
}

/**
 * 获取 Provider 显示名称
 */
export function getProviderDisplayName(provider: KnownProvider | string): string {
  const names: Record<string, string> = {
    volcengine: "火山引擎 Ark",
    bailian: "阿里云百炼",
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google AI",
    custom: "自定义",
  };
  return names[provider] || provider;
}
