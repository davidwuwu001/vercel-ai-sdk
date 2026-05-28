/**
 * Embedding Provider Adapter
 * 
 * 支持多种 Embedding Provider:
 * - Alibaba Cloud Bailian (阿里云百炼)
 * - OpenAI Compatible
 * - 预留 Volcengine 扩展
 */

export interface EmbeddingConfig {
  provider: "bailian" | "openai" | "volcengine";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  /** embedding 维度，默认 1536 (OpenAI text-embedding-3-small) */
  dimensions?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface EmbeddingsResult {
  embeddings: number[][];
  provider: string;
  modelId: string;
  totalTokens?: number;
}

/**
 * 获取 Embedding Provider 配置
 */
function getEmbeddingConfig(): EmbeddingConfig {
  // 优先使用百炼配置
  if (process.env.BAILIAN_API_KEY) {
    return {
      provider: "bailian",
      baseUrl: process.env.BAILIAN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.BAILIAN_API_KEY,
      modelId: process.env.BAILIAN_EMBEDDING_MODEL || "text-embedding-v3",
      dimensions: 1536,
    };
  }

  // 降级到 OpenAI 兼容接口
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      modelId: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      dimensions: 1536,
    };
  }

  throw new Error(
    "No embedding provider configured. Set BAILIAN_API_KEY or OPENAI_API_KEY in .env.local"
  );
}

/**
 * 调用 Embedding API
 */
async function callEmbeddingAPI(
  config: EmbeddingConfig,
  texts: string[]
): Promise<{ embedding: number[]; tokenUsage: number }[]> {
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: config.modelId,
      ...(config.dimensions && { dimensions: config.dimensions }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // 计算 token 使用量 (估算: 每 4 个字符约 1 token)
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);

  return data.data.map((item: { embedding: number[] }) => ({
    embedding: item.embedding,
    tokenUsage: Math.ceil(item.embedding.length * 0.25), // 估算
  }));
}

/**
 * 主接口: 对多个文本进行 embedding
 * 
 * @param texts - 要嵌入的文本数组
 * @param config - 可选的 provider 配置，默认使用环境变量
 * @returns 嵌入结果数组
 */
export async function embedTexts(
  texts: string[],
  config?: Partial<EmbeddingConfig>
): Promise<EmbeddingsResult> {
  if (texts.length === 0) {
    return { embeddings: [], provider: "unknown", modelId: "unknown", totalTokens: 0 };
  }

  // 合并配置
  const fullConfig = {
    ...getEmbeddingConfig(),
    ...config,
  };

  // 批量处理，每个请求最多 100 个文本
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await callEmbeddingAPI(fullConfig, batch);
    results.push(...batchResults.map(r => r.embedding));
  }

  return {
    embeddings: results,
    provider: fullConfig.provider,
    modelId: fullConfig.modelId,
  };
}

/**
 * 单文本 embedding 便捷方法
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  const result = await embedTexts([text]);
  return {
    embedding: result.embeddings[0],
    tokens: result.totalTokens || 0,
  };
}

/**
 * Cosine Similarity 计算
 * 用于在没有向量数据库时进行相似度计算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
