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
} from "@/lib/providers/vercel-gateway";
import type { ProviderStrategy } from "@/lib/providers/types";

const DEFAULT_VOLCENGINE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-1-6-250615";

type RuntimeModelConfig = Pick<
  ModelConfigWithSecret,
  | "id"
  | "provider"
  | "modelId"
  | "baseUrl"
  | "apiKeyEnv"
  | "apiKeyValue"
  | "gatewaySlug"
  | "supportsVision"
>;

function getProviderStrategy(config?: {
  provider?: string;
  baseUrl?: string;
  gatewaySlug?: string;
}): ProviderStrategy {
  if (config?.gatewaySlug) {
    return "gateway";
  }

  if (config?.baseUrl?.includes("gateway.ai.cloudflare.com")) {
    return "gateway";
  }

  return "direct";
}

export function getChatModel(modelConfigId?: number): LanguageModelV3 {
  const config = resolveRuntimeModelConfig(modelConfigId);

  const provider = config.provider || "volcengine";
  const modelId = config.modelId || DEFAULT_MODEL;
  const baseUrl = config.baseUrl || "";
  const apiKeyEnv = config.apiKeyEnv || "VOLCENGINE_API_KEY";
  const apiKeyValue = config.apiKeyValue;

  const strategy = getProviderStrategy({
    provider,
    baseUrl,
    gatewaySlug: config.gatewaySlug,
  });

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

  return getOpenAICompatibleModel(
    provider,
    modelId,
    baseUrl || undefined,
    apiKeyEnv,
    apiKeyValue
  );
}

export function getActiveModelConfig(modelConfigId?: number): RuntimeModelConfig {
  return resolveRuntimeModelConfig(modelConfigId);
}

function resolveRuntimeModelConfig(modelConfigId?: number): RuntimeModelConfig {
  if (modelConfigId) {
    const selected = getEnabledModelConfigById(modelConfigId);
    if (!selected) {
      throw new Error("Selected model is disabled or does not exist.");
    }
    return selected;
  }

  const configured = getDefaultModelConfig();
  if (configured) return configured;

  return getEnvFallbackModelConfig();
}

function getEnvFallbackModelConfig(): RuntimeModelConfig {
  const provider = process.env.AI_PROVIDER || process.env.MODEL_PROVIDER || "volcengine";
  const baseUrl =
    process.env.VOLCENGINE_BASE_URL ||
    process.env.ARK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    DEFAULT_VOLCENGINE_BASE_URL;
  const modelId =
    process.env.VOLCENGINE_MODEL ||
    process.env.ARK_MODEL ||
    process.env.OPENAI_MODEL ||
    DEFAULT_MODEL;
  const apiKeyEnv =
    process.env.ARK_API_KEY && !process.env.VOLCENGINE_API_KEY
      ? "ARK_API_KEY"
      : process.env.OPENAI_API_KEY && provider === "openai"
        ? "OPENAI_API_KEY"
        : "VOLCENGINE_API_KEY";

  return {
    id: 0,
    provider,
    modelId,
    baseUrl,
    apiKeyEnv,
    apiKeyValue: "",
    gatewaySlug: "",
    supportsVision: isVisionCapableModel(modelId),
  };
}

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

export function supportsGatewayRouting(config?: {
  provider?: string;
  baseUrl?: string;
}): boolean {
  const strategy = getProviderStrategy(config);

  const hasAccountId = !!(
    process.env.VERCEL_ACCOUNT_ID ||
    config?.baseUrl?.includes("gateway.ai.cloudflare.com")
  );
  const hasToken = !!process.env.VERCEL_GATEWAY_TOKEN;

  return strategy === "gateway" && hasAccountId && hasToken;
}

export const VISION_CAPABLE_MODELS = [
  "doubao-vision-pro",
  "doubao-vision-lite",
  "qwen-vl-plus",
  "qwen-vl-max",
  "qwen-vl-max-longcontext",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-vision-preview",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

export function isVisionCapableModel(modelId: string): boolean {
  return VISION_CAPABLE_MODELS.some(
    (visionModel) =>
      modelId.toLowerCase().includes(visionModel.toLowerCase()) ||
      visionModel.toLowerCase().includes(modelId.toLowerCase())
  );
}

export function checkVisionSupport(
  modelConfigId?: number
): { supported: boolean; reason?: string } {
  const config = modelConfigId
    ? getEnabledModelConfigById(modelConfigId)
    : getDefaultModelConfig() || getEnvFallbackModelConfig();

  if (!config) {
    return { supported: false, reason: "没有找到模型配置" };
  }

  return checkVisionSupportByConfig(config);
}

function checkVisionSupportByConfig(config: {
  modelId: string;
  supportsVision?: boolean;
  provider?: string;
}): { supported: boolean; reason?: string } {
  if (config.supportsVision !== undefined) {
    if (config.supportsVision) {
      return { supported: true };
    }
    return {
      supported: false,
      reason: `当前模型 "${config.modelId}" 在配置中禁用了视觉支持`,
    };
  }

  if (isVisionCapableModel(config.modelId)) {
    return { supported: true };
  }

  const providerSupportsVision: Record<string, boolean> = {
    openai: true,
    anthropic: true,
  };

  if (config.provider && providerSupportsVision[config.provider]) {
    return { supported: true };
  }

  return {
    supported: false,
    reason: `模型 "${config.modelId}" 可能不支持图片输入。请使用视觉模型如 GPT-4o、Claude Vision、Doubao Vision 或 Qwen-VL。`,
  };
}

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
