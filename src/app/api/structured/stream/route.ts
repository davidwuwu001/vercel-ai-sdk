/**
 * 流式结构化分析 API
 * 使用 AI SDK 的 streamObject 实现实时字段更新
 */

import { streamObject } from "ai";
import { getChatModel } from "@/lib/ai/model";
import {
  MediaAnalysisSummarySchema,
  ServiceCaseRewriteSchema,
  TeacherProfileAuditSchema,
} from "@/lib/ai/structured";
import type { StructuredTaskType } from "@/lib/ai/structured";
import {
  startRun,
  endRun,
  logError,
} from "@/lib/observability/log-run";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASK_PROMPTS = {
  "teacher-profile-audit": `你是一个专业的教育行业档案审计专家。请根据以下输入审计教师档案信息。

输入信息：
{input}

请以 JSON 格式输出审计结果，包含以下结构：
- basicInfo: 基本信息（姓名、工号、科目、年级、教龄）
- qualificationCheck: 资质检查（学历认证、证书、教学资质）
- riskFactors: 风险因素（分类、严重程度、描述、建议）
- overallScore: 综合评分（0-100）
- auditDate: 审计日期
- auditor: 审计人`,

  "service-case-rewrite": `你是一个专业的教育服务文案专家。请根据以下输入改写服务案例。

原始案例内容：
{input}

请以 JSON 格式输出改写结果，包含以下结构：
- originalCase: 原始案例信息
- improvements: 改进评分和建议（清晰度、专业性、家长友好度）
- rewrittenCase: 改写后的案例（摘要、完整文本、要点、跟进事项）
- metadata: 元数据（案例类型、目标受众、语气）`,

  "media-analysis-summary": `你是一个专业的多媒体内容分析专家。请根据以下输入分析图像或文档内容。

输入内容：
{input}

请以 JSON 格式输出分析结果，包含以下结构：
- fileInfo: 文件信息
- contentSummary: 内容摘要（概述、关键发现、重要细节）
- structuredData: 结构化数据（键值对）
- classification: 分类（类别、可信度、标签）
- qualityAssessment: 质量评估
- recommendedActions: 建议操作`,
};

/**
 * POST - 流式结构化分析
 * 返回 SSE 格式的流式响应
 */
export async function POST(req: Request) {
  let runId: number | null = null;

  try {
    const body = await req.json();
    const { taskType, input } = body as {
      taskType: StructuredTaskType;
      input: string;
    };

    if (!taskType || !input) {
      return new Response(
        JSON.stringify({ error: "Missing taskType or input" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const promptTemplate = TASK_PROMPTS[taskType];
    if (!promptTemplate) {
      return new Response(
        JSON.stringify({ error: `Unknown task type: ${taskType}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const schema =
      taskType === "teacher-profile-audit"
        ? TeacherProfileAuditSchema
        : taskType === "service-case-rewrite"
          ? ServiceCaseRewriteSchema
          : MediaAnalysisSummarySchema;

    // 启动日志记录
    runId = startRun("/api/structured/stream", {
      modelId: taskType,
      metadata: { taskType, mode: "streaming" },
    });

    const model = getChatModel();
    const prompt = promptTemplate.replace("{input}", input);

    // 使用 streamObject 生成流式响应
    const { partialObjectStream } = streamObject({
      model,
      schema,
      prompt,
      temperature: 0.3,
    });

    // 将流转换为 SSE 格式
    const encoder = new TextEncoder();
    let isStreamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          if (!isStreamClosed) {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          }
        };

        try {
          // 发送开始事件
          sendEvent("start", { taskType, startedAt: Date.now() });

          // 处理部分对象流
          let previousPartial: Record<string, unknown> = {};

          for await (const partialObject of partialObjectStream) {
            const updates: Array<{
              path: string;
              value: unknown;
              type: "add" | "update";
            }> = [];

            // 检测新增或变化的字段
            const detectChanges = (
              prev: Record<string, unknown>,
              next: Record<string, unknown>,
              prefix = ""
            ) => {
              const allKeys = new Set([
                ...Object.keys(prev),
                ...Object.keys(next),
              ]);

              for (const key of allKeys) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                const prevValue = prev[key];
                const nextValue = next[key];

                if (!(key in prev) && key in next) {
                  updates.push({
                    path: fullPath,
                    value: nextValue,
                    type: "add",
                  });
                } else if (
                  key in prev &&
                  key in next &&
                  JSON.stringify(prevValue) !== JSON.stringify(nextValue)
                ) {
                  if (
                    typeof nextValue === "object" &&
                    nextValue !== null &&
                    !Array.isArray(nextValue)
                  ) {
                    detectChanges(
                      (prevValue as Record<string, unknown>) || {},
                      nextValue as Record<string, unknown>,
                      fullPath
                    );
                  } else {
                    updates.push({
                      path: fullPath,
                      value: nextValue,
                      type: "update",
                    });
                  }
                }
              }
            };

            detectChanges(previousPartial, partialObject);
            previousPartial = partialObject;

            // 发送更新事件
            sendEvent("partial", {
              partial: partialObject,
              updates,
              timestamp: Date.now(),
            });
          }

          // 发送完成事件
          sendEvent("complete", {
            result: previousPartial,
            completedAt: Date.now(),
          });

          // 结束日志
          if (runId) {
            endRun(runId, { status: "success" });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Streaming failed";
          sendEvent("error", { error: message });

          if (runId) {
            logError(runId, error);
          }
        } finally {
          isStreamClosed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (runId) {
      logError(runId, error);
    }

    const message =
      error instanceof Error ? error.message : "Streaming setup failed";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
