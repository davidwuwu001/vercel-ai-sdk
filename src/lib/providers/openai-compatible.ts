import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  type DirectProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  getProviderDisplayName,
  isKnownProvider,
} from "./types";

/**
 * OpenAI 兼容 Provider 适配器
 * 支持 Volcengine Ark、阿里云百炼等 OpenAI 兼容接口
 */

/**
 * 从环境变量获取 API Key
 * 优先级：apiKeyEnv 环境变量 > 数据库中的 apiKeyValue
 */
export function getApiKeyFromEnv(
  apiKeyEnv: string,
  dbApiKeyValue?: string
): string | undefined {
  const envKey = process.env[apiKeyEnv];
  if (envKey) return envKey;
  if (dbApiKeyValue) return dbApiKeyValue;
  // 兼容旧的环境变量名
  return (
    process.env.VOLCENGINE_API_KEY ||
    process.env.ARK_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

/**
 * 解析 Provider 配置为 Direct 配置
 * 如果传入的配置不完整，使用默认值填充
 */
export function resolveDirectConfig(
  provider: string,
  baseUrl?: string,
  apiKeyEnv?: string
): DirectProviderConfig {
  const knownProvider = isKnownProvider(provider) ? provider : "custom";
  const defaults = DEFAULT_PROVIDER_CONFIGS[knownProvider];

  return {
    kind: "openai-compatible",
    strategy: "direct",
    knownProvider,
    baseUrl: baseUrl || defaults.baseUrl,
    apiKeyEnv: apiKeyEnv || defaults.apiKeyEnv,
  };
}

/**
 * 从模型配置创建 OpenAI 兼容 Provider
 */
export function createOpenAICompatibleProvider(
  config: DirectProviderConfig,
  apiKeyValue?: string
): {
  provider: ReturnType<typeof createOpenAI>;
  modelId: string;
} {
  const apiKey = getApiKeyFromEnv(config.apiKeyEnv, apiKeyValue);

  if (!apiKey) {
    throw new Error(
      `Missing API key for ${getProviderDisplayName(config.knownProvider)}. ` +
        `Set ${config.apiKeyEnv} in .env.local or provide API key directly.`
    );
  }

  const provider = createOpenAI({
    apiKey,
    baseURL: config.baseUrl,
    name: config.knownProvider === "custom" ? "custom" : config.knownProvider,
  });

  return { provider, modelId: "" };
}

/**
 * 获取聊天模型实例（OpenAI 兼容）
 */
export function getOpenAICompatibleModel(
  provider: string,
  modelId: string,
  baseUrl?: string,
  apiKeyEnv?: string,
  apiKeyValue?: string
): LanguageModelV3 {
  const config = resolveDirectConfig(provider, baseUrl, apiKeyEnv);
  const { provider: aiProvider } = createOpenAICompatibleProvider(
    config,
    apiKeyValue
  );

  return aiProvider.chat(modelId);
}

/**
 * Volcengine Ark 特定配置
 */
export const VOLCENGINE_ARK_DEFAULTS = {
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  apiKeyEnv: "VOLCENGINE_API_KEY",
  knownModelIds: [
    "doubao-pro-4k",
    "doubao-pro-32k",
    "doubao-pro-128k",
    "doubao-seed-1-6-250615",
    "doubao-seed-1-5-250615",
    "doubao-lite-4k",
    "doubao-lite-32k",
  ],
};

/**
 * 获取 Volcengine Ark 模型
 */
export function getVolcengineArkModel(
  modelId: string,
  apiKeyEnv?: string,
  baseUrl?: string,
  apiKeyValue?: string
): LanguageModelV3 {
  return getOpenAICompatibleModel(
    "volcengine",
    modelId,
    baseUrl || VOLCENGINE_ARK_DEFAULTS.baseUrl,
    apiKeyEnv || VOLCENGINE_ARK_DEFAULTS.apiKeyEnv,
    apiKeyValue
  );
}

/**
 * 阿里云百炼（DashScope）特定配置
 */
export const BAILIAN_DEFAULTS = {
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKeyEnv: "DASHSCOPE_API_KEY",
  knownModelIds: [
    "qwen-plus",
    "qwen-plus-32k",
    "qwen-max",
    "qwen-max-longcontext",
    "qwen-turbo",
    "qwen-long",
    "qwen-vl-plus",
    "qwen-vl-max",
  ],
};

/**
 * 获取阿里云百炼模型
 */
export function getBailianModel(
  modelId: string,
  apiKeyEnv?: string,
  baseUrl?: string,
  apiKeyValue?: string
): LanguageModelV3 {
  return getOpenAICompatibleModel(
    "bailian",
    modelId,
    baseUrl || BAILIAN_DEFAULTS.baseUrl,
    apiKeyEnv || BAILIAN_DEFAULTS.apiKeyEnv,
    apiKeyValue
  );
}
