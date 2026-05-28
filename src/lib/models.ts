import { z } from "zod";
import { getDb } from "@/lib/db";
import type { ProviderStrategy } from "@/lib/providers/types";

/**
 * Provider 路由策略枚举
 */
export const providerStrategySchema = z.enum(["direct", "gateway"]);
export type ProviderStrategyInput = z.infer<typeof providerStrategySchema>;

/**
 * 已知 Provider 枚举
 */
export const knownProviderSchema = z.enum([
  "volcengine",
  "bailian",
  "openai",
  "anthropic",
  "google",
  "custom",
]);
export type KnownProviderInput = z.infer<typeof knownProviderSchema>;

/**
 * 模型配置 Schema（扩展版，支持 Provider 策略）
 */
export const modelConfigSchema = z.object({
  name: z.string().trim().min(1, "请输入模型名称").max(120),
  provider: z.string().trim().min(1).max(80).default("volcengine"),
  /** Provider 路由策略: direct=直接连接, gateway=通过 Vercel AI Gateway */
  strategy: providerStrategySchema.default("direct"),
  /** API 端点（direct 策略必需，gateway 策略可选，空字符串允许） */
  baseUrl: z.string().trim().max(500).refine(
    (val) => !val || /^https?:\/\/.+/.test(val),
    { message: "Base URL 必须是有效的 HTTP/HTTPS URL" }
  ).default(""),
  /** 模型 ID */
  modelId: z.string().trim().min(1, "请输入模型或 Endpoint ID").max(200),
  /** API Key 环境变量名 */
  apiKeyEnv: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "这里要填写环境变量名，例如 VOLCENGINE_API_KEY，不要直接填写 API Key",
    )
    .default("VOLCENGINE_API_KEY"),
  /** 直接存储的 API Key（可选） */
  apiKey: z.string().trim().max(4000).optional().default(""),
  /** 是否清除存储的 API Key */
  clearApiKey: z.boolean().optional().default(false),
  /** Vercel AI Gateway Slug（gateway 策略时使用） */
  gatewaySlug: z.string().trim().max(200).optional().default(""),
  /** Gateway Token 环境变量名（gateway 策略时使用） */
  gatewayTokenEnv: z
    .string()
    .trim()
    .max(80)
    .optional()
    .default("VERCEL_GATEWAY_TOKEN"),
  /** Fallback 模型 ID 列表（逗号分隔，gateway 策略时使用） */
  fallbackModelIds: z.string().trim().max(1000).optional().default(""),
  /** 是否支持视觉/图片输入 */
  supportsVision: z.boolean().default(false),
  /** 是否支持文件上传 */
  supportsFiles: z.boolean().default(false),
  /** 是否为默认模型 */
  isDefault: z.boolean().default(false),
  /** 是否启用 */
  enabled: z.boolean().default(true),
  /** 备注 */
  notes: z.string().trim().max(1000).default(""),
});

export type ModelConfigInput = z.infer<typeof modelConfigSchema>;

/**
 * 模型配置输出类型（不含敏感信息）
 */
export type ModelConfig = Omit<ModelConfigInput, "apiKey" | "clearApiKey"> & {
  id: number;
  /** 是否有存储的 API Key */
  hasApiKey: boolean;
  /** 是否有 Gateway 配置 */
  hasGatewayConfig: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * 带敏感信息的模型配置（仅服务端使用）
 */
export type ModelConfigWithSecret = ModelConfig & {
  apiKeyValue: string;
  gatewayTokenValue?: string;
};

/**
 * 数据库行类型
 */
type ModelConfigRow = {
  id: number;
  name: string;
  provider: string;
  strategy: string;
  base_url: string;
  model_id: string;
  api_key_env: string;
  api_key_value: string;
  gateway_slug: string;
  gateway_token_env: string;
  fallback_model_ids: string;
  supports_vision: number;
  supports_files: number;
  is_default: number;
  enabled: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

/**
 * 获取所有模型配置
 */
export function listModelConfigs() {
  const rows = getDb()
    .prepare("SELECT * FROM model_configs ORDER BY is_default DESC, id DESC")
    .all() as ModelConfigRow[];

  return rows.map(mapModelConfig);
}

/**
 * 获取默认模型配置（带 API Key）
 */
export function getDefaultModelConfig() {
  const row = getDb()
    .prepare(
      "SELECT * FROM model_configs WHERE enabled = 1 ORDER BY is_default DESC, id DESC LIMIT 1",
    )
    .get() as ModelConfigRow | undefined;

  return row ? mapModelConfigWithSecret(row) : null;
}

/**
 * 根据 ID 获取启用的模型配置
 */
export function getEnabledModelConfigById(id: number) {
  const row = getDb()
    .prepare("SELECT * FROM model_configs WHERE id = ? AND enabled = 1")
    .get(id) as ModelConfigRow | undefined;

  return row ? mapModelConfigWithSecret(row) : null;
}

/**
 * 创建模型配置
 */
export function createModelConfig(input: ModelConfigInput) {
  const data = modelConfigSchema.parse(input);
  const database = getDb();

  const insert = database.transaction(() => {
    if (data.isDefault) clearDefaultModel(database);

    const result = database
      .prepare(
        `
          INSERT INTO model_configs (
            name, provider, strategy, base_url, model_id, api_key_env, api_key_value,
            gateway_slug, gateway_token_env, fallback_model_ids,
            supports_vision, supports_files, is_default, enabled, notes,
            updated_at
          ) VALUES (
            @name, @provider, @strategy, @baseUrl, @modelId, @apiKeyEnv, @apiKeyValue,
            @gatewaySlug, @gatewayTokenEnv, @fallbackModelIds,
            @supportsVision, @supportsFiles, @isDefault, @enabled, @notes,
            CURRENT_TIMESTAMP
          )
        `,
      )
      .run(toRowParams(data));

    return Number(result.lastInsertRowid);
  });

  return getModelConfigById(insert());
}

/**
 * 更新模型配置
 */
export function updateModelConfig(id: number, input: ModelConfigInput) {
  const data = modelConfigSchema.parse(input);
  const database = getDb();

  const update = database.transaction(() => {
    if (data.isDefault) clearDefaultModel(database);

    database
      .prepare(
        `
          UPDATE model_configs SET
            name = @name,
            provider = @provider,
            strategy = @strategy,
            base_url = @baseUrl,
            model_id = @modelId,
            api_key_env = @apiKeyEnv,
            api_key_value = CASE
              WHEN @clearApiKey = 1 THEN ''
              WHEN @apiKeyValue != '' THEN @apiKeyValue
              ELSE api_key_value
            END,
            gateway_slug = @gatewaySlug,
            gateway_token_env = @gatewayTokenEnv,
            fallback_model_ids = @fallbackModelIds,
            supports_vision = @supportsVision,
            supports_files = @supportsFiles,
            is_default = @isDefault,
            enabled = @enabled,
            notes = @notes,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = @id
        `,
      )
      .run({ id, ...toRowParams(data) });
  });

  update();
  return getModelConfigById(id);
}

/**
 * 删除模型配置
 */
export function deleteModelConfig(id: number) {
  const database = getDb();
  database.prepare("DELETE FROM model_configs WHERE id = ?").run(id);

  const defaultCount = database
    .prepare("SELECT COUNT(*) as count FROM model_configs WHERE is_default = 1")
    .get() as { count: number };

  if (defaultCount.count === 0) {
    database
      .prepare(
        "UPDATE model_configs SET is_default = 1 WHERE id = (SELECT id FROM model_configs WHERE enabled = 1 ORDER BY id DESC LIMIT 1)",
      )
      .run();
  }
}

/**
 * 根据 ID 获取模型配置
 */
function getModelConfigById(id: number) {
  const row = getDb()
    .prepare("SELECT * FROM model_configs WHERE id = ?")
    .get(id) as ModelConfigRow | undefined;

  if (!row) {
    throw new Error("模型配置不存在");
  }

  return mapModelConfig(row);
}

/**
 * 清除所有默认标记
 */
function clearDefaultModel(database: ReturnType<typeof getDb>) {
  database.prepare("UPDATE model_configs SET is_default = 0").run();
}

/**
 * 转换为数据库行参数
 */
function toRowParams(data: ModelConfigInput) {
  return {
    name: data.name,
    provider: data.provider,
    strategy: data.strategy,
    baseUrl: data.baseUrl,
    modelId: data.modelId,
    apiKeyEnv: data.apiKeyEnv,
    apiKeyValue: data.apiKey || "",
    clearApiKey: data.clearApiKey ? 1 : 0,
    gatewaySlug: data.gatewaySlug || "",
    gatewayTokenEnv: data.gatewayTokenEnv || "VERCEL_GATEWAY_TOKEN",
    fallbackModelIds: data.fallbackModelIds || "",
    notes: data.notes,
    supportsVision: data.supportsVision ? 1 : 0,
    supportsFiles: data.supportsFiles ? 1 : 0,
    isDefault: data.isDefault ? 1 : 0,
    enabled: data.enabled ? 1 : 0,
  };
}

/**
 * 映射数据库行为 ModelConfig（不含敏感信息）
 */
function mapModelConfig(row: ModelConfigRow): ModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    strategy: row.strategy as ProviderStrategy,
    baseUrl: row.base_url,
    modelId: row.model_id,
    apiKeyEnv: row.api_key_env,
    hasApiKey: Boolean(row.api_key_value),
    gatewaySlug: row.gateway_slug,
    gatewayTokenEnv: row.gateway_token_env,
    fallbackModelIds: row.fallback_model_ids,
    hasGatewayConfig: Boolean(row.gateway_slug || row.gateway_token_env),
    supportsVision: Boolean(row.supports_vision),
    supportsFiles: Boolean(row.supports_files),
    isDefault: Boolean(row.is_default),
    enabled: Boolean(row.enabled),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 映射数据库行为 ModelConfigWithSecret（带敏感信息）
 */
function mapModelConfigWithSecret(row: ModelConfigRow): ModelConfigWithSecret {
  return {
    ...mapModelConfig(row),
    apiKeyValue: row.api_key_value,
    gatewayTokenValue: row.gateway_token_env
      ? process.env[row.gateway_token_env]
      : undefined,
  };
}
