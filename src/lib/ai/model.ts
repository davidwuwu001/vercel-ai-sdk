import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  getDefaultModelConfig,
  getEnabledModelConfigById,
} from "@/lib/models";
import type { ModelConfigWithSecret } from "@/lib/models";
import {
  getOpenAICompatibleModel,
  getVolcengineArkModel,
  getBailianModel,
} from "@/lib/providers/openai-compatible";
import {
  getMultiProviderModel,
  VERCEL_GATEWAY_DEFAULTS,
} from "@/lib/providers/vercel-gateway";
import type { ProviderStrategy } from "@/lib/providers/types";

const DEFAULT_VOLCENGINE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-1-6-250615";

/**
 * 从配置中解析 Provider 策略
 */
function getProviderStrategy(config?: {
  provider?: string;
  baseUrl?: string;
  gatewaySlug?: string;
}): ProviderStrategy {
  // 如果有 gatewaySlug，则使用 gateway 策略
  if (config?.gatewaySlug) {
    return "gateway";
  }

  // 如果 baseUrl 匹配 gateway URL，使用 gateway 策略
  if (config?.baseUrl?.includes("gateway.ai.cloudflare.com")) {
    return "gateway";
  }

  return "direct";
}

/**
 * 获取聊天模型实例
 * 支持多种 Provider 策略：
 * - direct: 直接连接 provider（默认）
 * - gateway: 通过 Vercel AI Gateway 路由
 */
export function getChatModel(modelConfigId?: number): LanguageModelV3 {
  const config = modelConfigId
    ? getEnabledModelConfigById(modelConfigId)
    : getDefaultModelConfig();

  if (modelConfigId && !config) {
    throw new Error("Selected model is disabled or does not exist.");
  }

  if (!config) {
    throw new Error("No model configuration found. Please configure a model in the admin panel.");
  }

  const provider = config.provider || "volcengine";
  const modelId = config.modelId || DEFAULT_MODEL;
  const baseUrl = config.baseUrl || "";
  const apiKeyEnv = config.apiKeyEnv || "VOLCENGINE_API_KEY";
  const apiKeyValue = (config as ModelConfigWithSecret).apiKeyValue;

  // 解析 Provider 策略
  const strategy = getProviderStrategy({
    provider,
    baseUrl,
    gatewaySlug: config.gatewaySlug,
  });

  // Gateway 策略
  if (strategy === "gateway") {
    const accountIdEnv = process.env.VERCEL_ACCOUNT_ID
      ? undefined
      : "VERCEL_ACCOUNT_ID";
    const gatewayTokenEnv = process.env.VERCEL_GATEWAY_TOKEN
      ? undefined
      : "VERCEL_GATEWAY_TOKEN";

    return getMultiProviderModel(modelId, {
      gatewayBaseUrl: baseUrl || undefined,
      gatewayTokenEnv,
      accountIdEnv,
    });
  }

  // Direct 策略 - 使用 OpenAI 兼容接口
  // 根据 provider 类型选择合适的适配器
  if (provider === "volcengine" || provider === "ark") {
    return getVolcengineArkModel(
      modelId,
      apiKeyEnv,
      baseUrl || undefined,
      apiKeyValue
    );
  }

  if (provider === "bailian" || provider === "dashscope") {
    return getBailianModel(
      modelId,
      apiKeyEnv,
      baseUrl || undefined,
      apiKeyValue
    );
  }

  // 通用 OpenAI 兼容接口
  return getOpenAICompatibleModel(
    provider,
    modelId,
    baseUrl || undefined,
    apiKeyEnv,
    apiKeyValue
  );
}

/**
 * 获取指定 Provider 的模型实例
 * 用于模型对比等场景
 */
export function getModelByProvider(
  provider: string,
  modelId: string,
  options?: {
    baseUrl?: string;
    apiKeyEnv?: string;
    gatewaySlug?: string;
  }
): LanguageModelV3 {
  const strategy = getProviderStrategy({
    provider,
    baseUrl: options?.baseUrl,
    gatewaySlug: options?.gatewaySlug,
  });

  if (strategy === "gateway") {
    return getMultiProviderModel(modelId, {
      gatewayBaseUrl: options?.baseUrl,
      gatewayTokenEnv: "VERCEL_GATEWAY_TOKEN",
      accountIdEnv: "VERCEL_ACCOUNT_ID",
    });
  }

  // Direct 策略
  if (provider === "volcengine" || provider === "ark") {
    return getVolcengineArkModel(
      modelId,
      options?.apiKeyEnv,
      options?.baseUrl
    );
  }

  if (provider === "bailian" || provider === "dashscope") {
    return getBailianModel(
      modelId,
      options?.apiKeyEnv,
      options?.baseUrl
    );
  }

  return getOpenAICompatibleModel(
    provider,
    modelId,
    options?.baseUrl,
    options?.apiKeyEnv
  );
}

/**
 * 检查模型是否支持 Gateway 路由
 */
export function supportsGatewayRouting(config?: {
  provider?: string;
  baseUrl?: string;
}): boolean {
  const strategy = getProviderStrategy(config);

  // 检查是否有必要的环境变量
  const hasAccountId = !!(
    process.env.VERCEL_ACCOUNT_ID ||
    config?.baseUrl?.includes("gateway.ai.cloudflare.com")
  );
  const hasToken = !!process.env.VERCEL_GATEWAY_TOKEN;

  return strategy === "gateway" && hasAccountId && hasToken;
}

/**
 * 已知的支持视觉的模型 ID 列表
 * 这些模型原生支持图片输入
 */
export const VISION_CAPABLE_MODELS = [
  // Volcengine Ark Vision
  "doubao-vision-pro",
  "doubao-vision-lite",
  // Alibaba Bailian Vision (Qwen-VL)
  "qwen-vl-plus",
  "qwen-vl-max",
  "qwen-vl-max-longcontext",
  // OpenAI Vision
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-vision-preview",
  // Anthropic Claude Vision
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

/**
 * 检查模型 ID 是否为已知的视觉模型
 */
export function isVisionCapableModel(modelId: string): boolean {
  return VISION_CAPABLE_MODELS.some(
    (visionModel) =>
      modelId.toLowerCase().includes(visionModel.toLowerCase()) ||
      visionModel.toLowerCase().includes(modelId.toLowerCase())
  );
}

/**
 * 检查模型配置是否支持视觉输入
 * 
 * 检查优先级：
 * 1. 模型配置中的 supportsVision 字段
 * 2. 已知的视觉模型列表
 * 
 * @param modelConfigId - 模型配置 ID
 * @returns 是否支持视觉输入，以及不支持的原因
 */
export function checkVisionSupport(
  modelConfigId?: number
): { supported: boolean; reason?: string } {
  // 如果没有指定模型，尝试获取默认模型
  if (!modelConfigId) {
    const defaultConfig = getDefaultModelConfig();
    if (!defaultConfig) {
      return { supported: false, reason: "没有找到默认模型配置" };
    }
    return checkVisionSupportByConfig(defaultConfig);
  }

  const config = getEnabledModelConfigById(modelConfigId);
  if (!config) {
    return { supported: false, reason: "指定的模型配置不存在或已禁用" };
  }

  return checkVisionSupportByConfig(config);
}

/**
 * 根据模型配置检查视觉支持
 */
function checkVisionSupportByConfig(config: {
  modelId: string;
  supportsVision?: boolean;
  provider?: string;
}): { supported: boolean; reason?: string } {
  // 1. 如果配置明确设置了 supportsVision
  if (config.supportsVision !== undefined) {
    if (config.supportsVision) {
      return { supported: true };
    }
    return {
      supported: false,
      reason: `当前模型 "${config.modelId}" 在配置中禁用了视觉支持`,
    };
  }

  // 2. 检查是否为已知的视觉模型
  if (isVisionCapableModel(config.modelId)) {
    return { supported: true };
  }

  // 3. 检查 Provider 是否通常支持视觉
  const providerSupportsVision: Record<string, boolean> = {
    openai: true, // OpenAI 支持视觉
    anthropic: true, // Anthropic 支持视觉
  };

  if (config.provider && providerSupportsVision[config.provider]) {
    return { supported: true };
  }

  // 4. 不支持
  return {
    supported: false,
    reason: `模型 "${config.modelId}" 可能不支持图片输入。请使用视觉模型如 GPT-4o、Claude Vision、Doubao Vision 或 Qwen-VL。`,
  };
}

/**
 * 获取视觉模型的推荐列表
 */
export function getRecommendedVisionModels(): Array<{
  name: string;
  modelId: string;
  provider: string;
  description: string;
}> {
  return [
    {
      name: "Doubao Vision Pro",
      modelId: "doubao-vision-pro",
      provider: "volcengine",
      description: "字节豆包视觉模型，支持高质量图片理解",
    },
    {
      name: "Qwen VL Plus",
      modelId: "qwen-vl-plus",
      provider: "bailian",
      description: "通义千问视觉增强版",
    },
    {
      name: "GPT-4o",
      modelId: "gpt-4o",
      provider: "openai",
      description: "OpenAI 最新多模态模型",
    },
    {
      name: "Claude 3.5 Sonnet",
      modelId: "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      description: "Anthropic 最新多模态模型",
    },
  ];
}
