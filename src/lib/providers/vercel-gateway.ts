import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { GatewayProviderConfig } from "./types";

/**
 * Vercel AI Gateway Provider 适配器
 * 支持通过 Vercel AI Gateway 进行多 provider 路由
 */

/**
 * Vercel AI Gateway 默认配置
 */
export const VERCEL_GATEWAY_DEFAULTS = {
  /** 默认 Gateway 基础 URL */
  baseUrl: "https://gateway.ai.cloudflare.com",
  /** Gateway API Token 环境变量 */
  tokenEnv: "VERCEL_GATEWAY_TOKEN",
  /** Gateway Account ID 环境变量（也用于路径） */
  accountIdEnv: "VERCEL_ACCOUNT_ID",
};

/**
 * Gateway 路由策略类型
 */
export type GatewayRouteType = "openai" | "anthropic" | "google" | "custom";

/**
 * 获取 Gateway 路由类型
 */
function getGatewayRouteType(provider: string): GatewayRouteType {
  const routeTypes: Record<string, GatewayRouteType> = {
    volcengine: "openai", // Ark 使用 OpenAI 兼容路由
    bailian: "openai", // 百炼使用 OpenAI 兼容路由
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    custom: "custom",
  };
  return routeTypes[provider] || "openai";
}

/**
 * 构建 Gateway URL
 * 格式: {baseUrl}/{accountId}/{gatewaySlug}/{routeType}
 */
export function buildGatewayUrl(
  config: GatewayProviderConfig,
  accountId: string
): string {
  const baseUrl = config.gatewayBaseUrl || VERCEL_GATEWAY_DEFAULTS.baseUrl;
  const slug = config.gatewaySlug || "default";

  return `${baseUrl}/${accountId}/${slug}/${getGatewayRouteType(config.knownProvider)}`;
}

/**
 * 获取 API Token（从环境变量或配置）
 */
export function getGatewayToken(tokenEnv?: string): string | undefined {
  return (
    process.env[tokenEnv || VERCEL_GATEWAY_DEFAULTS.tokenEnv] ||
    process.env.VERCEL_GATEWAY_TOKEN
  );
}

/**
 * 获取 Account ID（从环境变量）
 */
export function getGatewayAccountId(accountIdEnv?: string): string | undefined {
  return (
    process.env[accountIdEnv || VERCEL_GATEWAY_DEFAULTS.accountIdEnv] ||
    process.env.VERCEL_ACCOUNT_ID
  );
}

/**
 * 解析 Gateway 配置
 */
export function resolveGatewayConfig(
  gatewaySlug?: string,
  gatewayBaseUrl?: string,
  gatewayTokenEnv?: string,
  accountIdEnv?: string
): {
  baseUrl: string;
  tokenEnv: string;
  accountIdEnv: string;
} {
  return {
    baseUrl: gatewayBaseUrl || VERCEL_GATEWAY_DEFAULTS.baseUrl,
    tokenEnv: gatewayTokenEnv || VERCEL_GATEWAY_DEFAULTS.tokenEnv,
    accountIdEnv: accountIdEnv || VERCEL_GATEWAY_DEFAULTS.accountIdEnv,
  };
}

/**
 * 创建 Vercel AI Gateway Provider
 */
export function createGatewayProvider(
  config: GatewayProviderConfig,
  accountId: string,
  token?: string
): ReturnType<typeof createOpenAI> {
  const apiToken =
    token ||
    getGatewayToken(config.gatewayTokenEnv);

  if (!apiToken) {
    throw new Error(
      `Missing Vercel Gateway token. Set ${config.gatewayTokenEnv || VERCEL_GATEWAY_DEFAULTS.tokenEnv} in .env.local.`
    );
  }

  const baseUrl = buildGatewayUrl(config, accountId);

  return createOpenAI({
    apiKey: apiToken,
    baseURL: baseUrl,
    name: `gateway-${config.knownProvider}`,
  });
}

/**
 * 获取通过 Gateway 路由的模型
 */
export function getGatewayModel(
  modelId: string,
  provider: string,
  options?: {
    gatewaySlug?: string;
    gatewayBaseUrl?: string;
    gatewayTokenEnv?: string;
    accountIdEnv?: string;
  }
): LanguageModelV3 {
  const accountId = getGatewayAccountId(options?.accountIdEnv);

  if (!accountId) {
    throw new Error(
      `Missing Vercel Account ID. Set ${options?.accountIdEnv || VERCEL_GATEWAY_DEFAULTS.accountIdEnv} in .env.local.`
    );
  }

  const config: GatewayProviderConfig = {
    kind: "vercel-gateway",
    strategy: "gateway",
    knownProvider: provider as GatewayProviderConfig["knownProvider"],
    gatewaySlug: options?.gatewaySlug,
    gatewayBaseUrl: options?.gatewayBaseUrl,
    gatewayTokenEnv: options?.gatewayTokenEnv,
  };

  const gatewayProvider = createGatewayProvider(config, accountId);
  return gatewayProvider.chat(modelId);
}

/**
 * 使用 Gateway 进行多模型路由
 * 发送请求到 Gateway，Gateway 根据模型 ID 自动路由到对应 provider
 */
export function createMultiProviderGatewayRoute(
  accountId: string,
  options?: {
    gatewaySlug?: string;
    gatewayBaseUrl?: string;
    gatewayTokenEnv?: string;
    accountIdEnv?: string;
  }
) {
  const token = getGatewayToken(options?.gatewayTokenEnv);

  if (!token) {
    throw new Error(
      `Missing Vercel Gateway token. Set ${options?.gatewayTokenEnv || VERCEL_GATEWAY_DEFAULTS.tokenEnv} in .env.local.`
    );
  }

  if (!accountId) {
    throw new Error(
      `Missing Vercel Account ID. Set ${options?.accountIdEnv || VERCEL_GATEWAY_DEFAULTS.accountIdEnv} in .env.local.`
    );
  }

  const baseUrl = options?.gatewayBaseUrl || VERCEL_GATEWAY_DEFAULTS.baseUrl;
  const slug = options?.gatewaySlug || "default";

  const fullUrl = `${baseUrl}/${accountId}/${slug}`;

  return createOpenAI({
    apiKey: token,
    baseURL: fullUrl,
    name: "vercel-gateway-multi",
  });
}

/**
 * 获取多 Provider 路由模型
 */
export function getMultiProviderModel(
  modelId: string,
  options?: {
    gatewaySlug?: string;
    gatewayBaseUrl?: string;
    gatewayTokenEnv?: string;
    accountIdEnv?: string;
  }
): LanguageModelV3 {
  const accountId = getGatewayAccountId(options?.accountIdEnv);

  if (!accountId) {
    throw new Error(
      `Missing Vercel Account ID. Set ${options?.accountIdEnv || VERCEL_GATEWAY_DEFAULTS.accountIdEnv} in .env.local.`
    );
  }

  const provider = createMultiProviderGatewayRoute(accountId, options);
  return provider.chat(modelId);
}
