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
import { getEnabledModelConfigById } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 从 UIMessage 中检测是否包含图片附件
 */
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
        // 检查文件类型中的图片 (Vercel AI SDK v3 格式)
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

/**
 * 检查消息中的图片格式是否与模型兼容
 */
function validateImageFormats(
  messages: UIMessage[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查消息中的图片部分
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

  try {
    // 验证请求体
    if (!req.body) {
      return Response.json(
        { error: "invalid_request", message: "请求体不能为空" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      messages,
      modelConfigId,
    }: { messages: UIMessage[]; modelConfigId?: number } = body;

    // 验证 messages
    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "invalid_messages", message: "messages 必须是数组" },
        { status: 400 }
      );
    }

    // 获取模型配置信息用于日志
    const modelConfig = modelConfigId
      ? getEnabledModelConfigById(modelConfigId)
      : null;

    // 检测消息中是否包含图片
    const imageDetection = detectImageAttachments(messages);
    const modelId = modelConfig?.modelId || "default";

    // 如果有图片，检查模型是否支持视觉
    if (imageDetection.hasImages) {
      const visionCheck = checkVisionSupport(modelConfigId);

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

      // 验证图片格式
      const formatValidation = validateImageFormats(messages);
      if (!formatValidation.valid) {
        return Response.json(
          {
            error: "invalid_image_format",
            message: formatValidation.errors.join("; "),
          },
          { status: 400 }
        );
      }
    }

    // 启动日志记录
    runId = startRun("/api/chat", {
      modelConfigId: modelConfigId,
      provider: modelConfig?.provider || "unknown",
      modelId: modelId,
      attachmentCount: imageDetection.imageCount,
      metadata: {
        messageCount: messages.length,
        hasImages: imageDetection.hasImages,
      },
    });

    const modelMessages = await convertToModelMessages(messages, {
      tools: agentTools,
    });

    const result = streamText({
      model: getChatModel(modelConfigId),
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
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (runId) {
      logError(runId, error);
    }

    // 添加详细错误日志以便调试
    console.error("[POST /api/chat] Error:", error);
    if (error instanceof Error) {
      console.error("[POST /api/chat] Stack:", error.stack);
    }

    const message =
      error instanceof Error ? error.message : "AI request failed unexpectedly.";

    return Response.json(
      { message, error: "internal_error" },
      { status: 500 }
    );
  }
}
