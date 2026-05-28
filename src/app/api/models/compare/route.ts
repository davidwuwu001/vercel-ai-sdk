/**
 * 模型对比 API
 * 
 * 接收模型 ID 列表和提示词，返回多个模型的对比结果
 */

import { z } from "zod";
import { compareModels, rankResults } from "@/lib/ai/compare";
import { getModelByProvider } from "@/lib/ai/model";
import { listModelConfigs } from "@/lib/models";
import { getProviderDisplayName } from "@/lib/providers/types";
import { createRequestLogger, recordAIRequest, sanitize } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 120;

const CompareRequestSchema = z.object({
  /** 模型配置 ID 列表 */
  modelConfigIds: z.array(z.number()).min(2).max(5),
  /** 提示词 */
  prompt: z.string().min(1).max(10000),
  /** 系统提示词（可选） */
  system: z.string().max(5000).optional(),
  /** 温度（可选） */
  temperature: z.number().min(0).max(2).optional(),
  /** 最大输出 token 数（可选） */
  maxOutputTokens: z.number().min(1).max(32000).optional(),
});

export async function POST(req: Request) {
  const log = createRequestLogger(req);
  const startTime = Date.now();

  try {
    log.info("Compare request started");

    // 解析请求体
    const body = await req.json();
    const parsed = CompareRequestSchema.safeParse(body);

    if (!parsed.success) {
      log.warn("Invalid request body", { errors: parsed.error.issues.map(i => i.message).join("; ") });
      return Response.json(
        { message: "Invalid request body", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { modelConfigIds, prompt, system, temperature, maxOutputTokens } = parsed.data;

    // 获取模型配置
    const allConfigs = listModelConfigs();
    const selectedConfigs = modelConfigIds
      .map((id) => allConfigs.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined && c.enabled);

    if (selectedConfigs.length < 2) {
      log.warn("Not enough enabled models", { selectedCount: selectedConfigs.length });
      return Response.json(
        { message: "Need at least 2 enabled model configurations" },
        { status: 400 }
      );
    }

    // 构建模型列表
    const models = selectedConfigs.map((config) => ({
      model: getModelByProvider(config.provider, config.modelId, {
        baseUrl: config.baseUrl,
        apiKeyEnv: config.apiKeyEnv,
      }),
      modelId: config.modelId,
      modelName: config.name,
      provider: getProviderDisplayName(config.provider as Parameters<typeof getProviderDisplayName>[0]),
    }));

    // 运行对比
    const compareStartTime = Date.now();
    const compareResult = await compareModels({
      models,
      prompt,
      system,
      temperature,
      maxOutputTokens,
    });
    const compareLatencyMs = Date.now() - compareStartTime;

    // 记录每个模型的请求
    for (const result of compareResult.results) {
      if (result.success && result.usage) {
        recordAIRequest(
          result.modelId,
          result.provider,
          result.latencyMs || 0,
          {
            promptTokens: result.usage.promptTokens ?? 0,
            completionTokens: result.usage.completionTokens ?? 0,
          }
        );
      }
    }

    // 计算排名
    const rankings = rankResults(compareResult.results);

    const totalLatencyMs = Date.now() - startTime;
    log.info("Compare request completed", {
      modelCount: compareResult.results.length,
      successCount: compareResult.results.filter((r) => r.success).length,
      totalLatencyMs,
    });
    log.complete(200, totalLatencyMs);

    return Response.json({
      success: true,
      results: compareResult.results,
      rankings,
      summary: {
        totalModels: compareResult.results.length,
        successCount: compareResult.results.filter((r) => r.success).length,
        failedCount: compareResult.results.filter((r) => !r.success).length,
        totalLatencyMs: compareResult.totalLatencyMs,
        compareLatencyMs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? sanitize(error.message) : "Compare request failed unexpectedly.";
    log.error(error);
    log.complete(500, Date.now() - startTime);

    return Response.json({ message }, { status: 500 });
  }
}
