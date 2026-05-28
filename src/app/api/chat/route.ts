import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getChatModel, checkVisionSupport } from "@/lib/ai/model";
import { systemPrompt } from "@/lib/ai/system";
import { agentTools } from "@/lib/ai/tools";
import {
  startRun,
  endRun,
  logError,
  convertUsage,
} from "@/lib/observability/log-run";
import { ensureSession, replaceSessionMessages, updateSessionModel } from "@/lib/chat-store";
import { getDefaultModelConfig, getEnabledModelConfigById } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

function detectImageAttachments(messages: UIMessage[]): {
  hasImages: boolean;
  imageCount: number;
  firstImagePosition: number;
} {
  let hasImages = false;
  let imageCount = 0;
  let firstImagePosition = -1;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const parts = message.parts;

    if (parts) {
      for (const part of parts) {
        if (part.type === "file") {
          const filePart = part as { mediaType?: string };
          if (filePart.mediaType?.startsWith("image/")) {
            hasImages = true;
            imageCount++;
            if (firstImagePosition === -1) {
              firstImagePosition = i;
            }
          }
        }
      }
    }
  }

  return { hasImages, imageCount, firstImagePosition };
}

function validateImageFormats(
  messages: UIMessage[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const message of messages) {
    if (message.parts) {
      for (const part of message.parts) {
        if (part.type === "file") {
          const filePart = part as { mediaType?: string; url?: string; base64?: unknown };
          if (filePart.mediaType?.startsWith("image/")) {
            if (!filePart.url && !filePart.base64) {
              errors.push("图片缺少 URL 或 base64 数据");
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function POST(req: Request) {
  let runId: number | null = null;
  let sessionId: string | undefined;

  try {
    if (!req.body) {
      return jsonError("invalid_request", "请求体不能为空", 400);
    }

    const body = await req.json();
    const {
      messages,
      modelConfigId,
    }: { messages: UIMessage[]; modelConfigId?: number } = body;
    sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

    if (!Array.isArray(messages)) {
      return jsonError("invalid_messages", "messages 必须是数组", 400);
    }

    const modelConfig = modelConfigId
      ? getEnabledModelConfigById(modelConfigId)
      : getDefaultModelConfig();

    if (sessionId) {
      ensureSession(sessionId, modelConfig?.id);
      if (modelConfig?.id) updateSessionModel(sessionId, modelConfig.id);
      replaceSessionMessages(sessionId, messages);
    }

    const imageDetection = detectImageAttachments(messages);
    const modelId = modelConfig?.modelId || process.env.VOLCENGINE_MODEL || process.env.ARK_MODEL || "default";

    if (imageDetection.hasImages) {
      const visionCheck = checkVisionSupport(modelConfig?.id);

      if (!visionCheck.supported) {
        return Response.json(
          {
            error: "vision_not_supported",
            message: visionCheck.reason || "当前模型不支持图片输入",
            suggestion:
              "请选择支持视觉的模型，如 GPT-4o、Claude Vision、Doubao Vision 或 Qwen-VL",
            recommendedModels: [
              { name: "GPT-4o", modelId: "gpt-4o", provider: "openai" },
              { name: "Claude 3.5 Sonnet", modelId: "claude-3-5-sonnet-20241022", provider: "anthropic" },
              { name: "Doubao Vision", modelId: "doubao-vision-pro", provider: "volcengine" },
              { name: "Qwen VL Plus", modelId: "qwen-vl-plus", provider: "bailian" },
            ],
          },
          { status: 400 }
        );
      }

      const formatValidation = validateImageFormats(messages);
      if (!formatValidation.valid) {
        return jsonError("invalid_image_format", formatValidation.errors.join("; "), 400);
      }
    }

    runId = startRun("/api/chat", {
      modelConfigId: modelConfig?.id || modelConfigId,
      provider: modelConfig?.provider || "unknown",
      modelId,
      attachmentCount: imageDetection.imageCount,
      metadata: {
        messageCount: messages.length,
        hasImages: imageDetection.hasImages,
        sessionId,
      },
    });

    const modelMessages = await convertToModelMessages(messages, {
      tools: agentTools,
    });

    const result = streamText({
      model: getChatModel(modelConfig?.id || modelConfigId),
      system: systemPrompt,
      messages: modelMessages,
      tools: agentTools,
      stopWhen: stepCountIs(5),
      temperature: 0.6,
      onFinish: (finishEvent) => {
        if (runId) {
          endRun(runId, {
            status: "success",
            usage: convertUsage(finishEvent.usage),
            toolCallCount: finishEvent.toolCalls?.length || 0,
          });
        }

        if (sessionId && finishEvent.response.messages.length) {
          replaceSessionMessages(sessionId, finishEvent.response.messages as UIMessage[]);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (runId) {
      logError(runId, error);
    }

    console.error("[POST /api/chat] Error:", error);
    if (error instanceof Error) {
      console.error("[POST /api/chat] Stack:", error.stack);
    }

    return jsonError("internal_error", formatChatError(error), 500);
  }
}

function jsonError(error: string, message: string, status: number) {
  return Response.json({ message, error }, { status });
}

function formatChatError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI request failed unexpectedly.";

  if (message.includes("Missing API key")) {
    return `${message} 请检查 .env.local 或模型管理后台中的 API Key 配置。`;
  }

  if (message.includes("No model configuration")) {
    return "没有可用模型配置。请先到模型管理后台启用一个模型，或配置 VOLCENGINE_API_KEY / ARK_API_KEY 等环境变量。";
  }

  if (message.includes("Selected model is disabled")) {
    return "当前选择的模型不存在或已禁用。请切换模型后重试。";
  }

  return message;
}
