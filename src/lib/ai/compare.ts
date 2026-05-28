/**
 * 模型对比功能
 * 
 * 用于同时向多个模型发送相同提示词，比较输出结果
 */

import { generateText } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { ModelUsage } from "@/lib/ai/types";
import type { ModelCompareResult } from "@/lib/providers/types";

/**
 * 对比多个模型的结果
 */
export interface CompareModelsOptions {
  /** 要对比的模型列表 */
  models: Array<{
    model: LanguageModelV3;
    modelId: string;
    modelName: string;
    provider: string;
  }>;
  /** 提示词 */
  prompt: string;
  /** 系统提示词（可选） */
  system?: string;
  /** 温度（可选，默认 0.7） */
  temperature?: number;
  /** 最大输出 token 数（可选） */
  maxOutputTokens?: number;
}

/**
 * 模型对比结果
 */
export interface CompareModelsResult {
  results: ModelCompareResult[];
  /** 全部成功的标志 */
  allSucceeded: boolean;
  /** 总耗时（毫秒） */
  totalLatencyMs: number;
}

/**
 * AI SDK usage 类型（兼容不同版本）
 */
interface AIGenerateUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * 运行模型对比
 */
export async function compareModels(
  options: CompareModelsOptions
): Promise<CompareModelsResult> {
  const startTime = Date.now();
  const results: ModelCompareResult[] = [];

  // 并行执行所有模型的请求
  const promises = options.models.map(async (modelInfo) => {
    const modelStartTime = Date.now();

    try {
      const result = await generateText({
        model: modelInfo.model,
        system: options.system,
        prompt: options.prompt,
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2000,
      });

      const modelEndTime = Date.now();
      const latencyMs = modelEndTime - modelStartTime;

      // 提取 usage 信息（兼容不同 provider 返回格式）
      const rawUsage = result.usage as AIGenerateUsage | null;
      const usage: ModelUsage | undefined = rawUsage
        ? {
            promptTokens: rawUsage.promptTokens ?? rawUsage.inputTokens,
            completionTokens: rawUsage.completionTokens ?? rawUsage.outputTokens,
            totalTokens: rawUsage.totalTokens,
            latencyMs,
          }
        : undefined;

      return {
        modelId: modelInfo.modelId,
        modelName: modelInfo.modelName,
        provider: modelInfo.provider,
        success: true,
        output: result.text,
        usage,
        latencyMs,
        outputLength: result.text.length,
        completedAt: new Date().toISOString(),
      } satisfies ModelCompareResult;
    } catch (error) {
      const modelEndTime = Date.now();
      const latencyMs = modelEndTime - modelStartTime;

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      return {
        modelId: modelInfo.modelId,
        modelName: modelInfo.modelName,
        provider: modelInfo.provider,
        success: false,
        error: errorMessage,
        latencyMs,
        outputLength: 0,
        completedAt: new Date().toISOString(),
      } satisfies ModelCompareResult;
    }
  });

  // 等待所有请求完成
  const settledResults = await Promise.all(promises);
  results.push(...settledResults);

  const totalLatencyMs = Date.now() - startTime;
  const allSucceeded = results.every((r) => r.success);

  return {
    results,
    allSucceeded,
    totalLatencyMs,
  };
}

/**
 * 计算结果排名
 */
export function rankResults(results: ModelCompareResult[]): {
  byLatency: ModelCompareResult[];
  byLength: ModelCompareResult[];
  byTokens: ModelCompareResult[];
} {
  return {
    // 按延迟排序（最快到最慢）
    byLatency: [...results].sort((a, b) => a.latencyMs - b.latencyMs),
    // 按输出长度排序（最长到最短）
    byLength: [...results].sort((a, b) => b.outputLength - a.outputLength),
    // 按 token 数量排序（最多到最少）
    byTokens: [...results].sort((a, b) => {
      const aTokens = a.usage?.totalTokens ?? 0;
      const bTokens = b.usage?.totalTokens ?? 0;
      return bTokens - aTokens;
    }),
  };
}

/**
 * 格式化延迟显示
 */
export function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * 格式化 token 数量显示
 */
export function formatTokens(tokens?: number): string {
  if (tokens === undefined) return "N/A";
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * 计算成功率
 */
export function calculateSuccessRate(results: ModelCompareResult[]): {
  success: number;
  failed: number;
  rate: number;
} {
  const success = results.filter((r) => r.success).length;
  const failed = results.length - success;
  const rate = results.length > 0 ? success / results.length : 0;

  return { success, failed, rate };
}
