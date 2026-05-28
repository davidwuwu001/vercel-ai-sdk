/**
 * Rerank Provider Adapter
 * 
 * 支持多种 Rerank Provider:
 * - Alibaba Cloud Bailian (阿里云百炼)
 * - OpenAI Compatible
 */

export interface RerankConfig {
  provider: "bailian" | "openai";
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

export interface RerankCandidate {
  id: string;
  text: string;
  score?: number;
}

export interface RerankResult {
  id: string;
  text: string;
  score: number;
  index: number;
}

export interface RerankResponse {
  results: RerankResult[];
  provider: string;
  modelId: string;
  totalTokens?: number;
}

/**
 * 获取 Rerank Provider 配置
 */
function getRerankConfig(): RerankConfig {
  // 优先使用百炼配置
  if (process.env.BAILIAN_API_KEY) {
    return {
      provider: "bailian",
      baseUrl: process.env.BAILIAN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.BAILIAN_API_KEY,
      modelId: process.env.BAILIAN_RERANK_MODEL || "gte-rerank",
    };
  }

  // 降级到 OpenAI 兼容接口
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      modelId: process.env.OPENAI_RERANK_MODEL || "gpt-4o-mini",
    };
  }

  throw new Error(
    "No rerank provider configured. Set BAILIAN_API_KEY or OPENAI_API_KEY in .env.local"
  );
}

/**
 * 调用 Rerank API
 * 
 * @param query - 查询文本
 * @param candidates - 待重排序的候选文本数组
 * @param topN - 返回前 N 个结果
 * @param config - 可选的 provider 配置
 */
export async function rerank(
  query: string,
  candidates: RerankCandidate[],
  topN: number = 5,
  config?: Partial<RerankConfig>
): Promise<RerankResponse> {
  if (candidates.length === 0) {
    return { results: [], provider: "unknown", modelId: "unknown" };
  }

  // 合并配置
  const fullConfig = {
    ...getRerankConfig(),
    ...config,
  };

  // Bailian 使用专门的 rerank API
  if (fullConfig.provider === "bailian") {
    return rerankBailian(query, candidates, topN, fullConfig);
  }

  // OpenAI 兼容接口使用 rerank 端点 (如果有)
  return rerankOpenAICompatible(query, candidates, topN, fullConfig);
}

/**
 * Bailian Rerank API
 */
async function rerankBailian(
  query: string,
  candidates: RerankCandidate[],
  topN: number,
  config: RerankConfig
): Promise<RerankResponse> {
  const response = await fetch(`${config.baseUrl}/rerank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      query,
      documents: candidates.map(c => c.text),
      model: config.modelId,
      top_n: topN,
      return_documents: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bailian Rerank API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    results: data.results.map((item: { index: number; relevance_score: number }, i: number) => ({
      id: candidates[item.index]?.id || String(item.index),
      text: candidates[item.index]?.text || "",
      score: item.relevance_score,
      index: i,
    })),
    provider: "bailian",
    modelId: config.modelId,
    totalTokens: data.usage?.total_tokens,
  };
}

/**
 * OpenAI 兼容 Rerank API (通用实现)
 * 
 * 如果 provider 不支持专门的 rerank 端点，使用 LLM 进行重排序
 * 这是一个降级方案，结果质量可能不如专门的 rerank 模型
 */
async function rerankOpenAICompatible(
  query: string,
  candidates: RerankCandidate[],
  topN: number,
  config: RerankConfig
): Promise<RerankResponse> {
  // 尝试调用 rerank 端点
  try {
    const response = await fetch(`${config.baseUrl}/rerank`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: candidates.map(c => c.text),
        model: config.modelId,
        top_n: topN,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        results: data.results.map((item: { index: number; relevance_score: number }, i: number) => ({
          id: candidates[item.index]?.id || String(item.index),
          text: candidates[item.index]?.text || "",
          score: item.relevance_score,
          index: i,
        })),
        provider: "openai-compatible",
        modelId: config.modelId,
      };
    }
  } catch {
    // 端点不存在，继续使用 LLM 重排序
  }

  // 降级方案: 使用 Cosine Similarity 进行简单重排序
  // 这需要先对 query 和 candidates 进行 embedding
  const { embedTexts, cosineSimilarity } = await import("./embedding-provider");
  
  // 限制输入长度避免 token 过多
  const queryTruncated = query.slice(0, 500);
  const candidatesTruncated = candidates.map(c => ({
    ...c,
    text: c.text.slice(0, 1000),
  }));

  // 获取 query 和所有 candidates 的 embedding
  const queryResult = await embedTexts([queryTruncated]);
  const candidatesResult = await embedTexts(candidatesTruncated.map(c => c.text));

  // 计算相似度
  const scores = candidatesResult.embeddings.map((embedding, i) => ({
    id: candidates[i].id,
    text: candidates[i].text,
    score: cosineSimilarity(queryResult.embeddings[0], embedding),
    index: i,
  }));

  // 按分数排序并返回 topN
  scores.sort((a, b) => b.score - a.score);

  return {
    results: scores.slice(0, topN),
    provider: "embedding-fallback",
    modelId: queryResult.modelId,
    totalTokens: (queryResult.totalTokens || 0) + (candidatesResult.totalTokens || 0),
  };
}

/**
 * 快速检查 rerank 是否可用
 */
export function isRerankAvailable(): boolean {
  return Boolean(
    process.env.BAILIAN_API_KEY || 
    process.env.OPENAI_API_KEY ||
    process.env.BAILIAN_RERANK_MODEL
  );
}
