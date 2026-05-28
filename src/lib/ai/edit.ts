/**
 * AI 编辑工具 - 服务端专用
 * 
 * 提供消息编辑、重新生成等功能
 */

import { z } from "zod";
import { agentTools } from "./tools";
import { getChatModel } from "./model";
import { systemPrompt } from "./system";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { startRun, endRun } from "@/lib/observability/log-run";
import { getEnabledModelConfigById } from "@/lib/models";
import type { UIMessage } from "ai";

// Re-export tool metadata and helpers for convenience
export { toolMetadataSchema as toolMetadata, getToolCategories, getToolInfo } from "./edit-metadata";
export type { ToolMetadataKey, ToolMetadataValue as ToolMetadata } from "./edit-metadata";

// Schema for editing a message (for API validation)
export const editMessageSchema = z.object({
  sessionId: z.string().describe("Chat session ID"),
  messageId: z.string().describe("ID of the message to edit"),
  newContent: z.string().describe("New content for the message"),
  modelConfigId: z.number().optional().describe("Optional model config ID"),
});

/**
 * 转换使用量格式
 */
function convertUsage(usage: unknown): { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined {
  if (!usage) return undefined;
  const u = usage as Record<string, unknown>;
  return {
    promptTokens: (u.promptTokens ?? u.inputTokens ?? u.prompt_tokens) as number | undefined,
    completionTokens: (u.completionTokens ?? u.outputTokens ?? u.completion_tokens) as number | undefined,
    totalTokens: u.totalTokens ?? u.total_tokens,
  } as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/**
 * 编辑消息并重新生成回复
 */
export async function editAndRegenerate(
  messages: UIMessage[],
  editIndex: number,
  newContent: string,
  modelConfigId?: number
) {
  let runId: number | null = null;

  // 获取模型配置信息用于日志
  const modelConfig = modelConfigId
    ? getEnabledModelConfigById(modelConfigId)
    : null;

  // 启动日志记录
  runId = startRun("/api/chat/edit", {
    modelConfigId: modelConfigId,
    provider: modelConfig?.provider || "unknown",
    modelId: modelConfig?.modelId || modelConfig?.name || "default",
    attachmentCount: 0,
    metadata: {
      editIndex,
      originalContent: messages[editIndex]?.parts?.[0]?.type === "text" 
        ? messages[editIndex].parts[0].text.slice(0, 50) 
        : undefined,
    },
  });

  // 替换消息内容
  const editedMessages = messages.map((msg, idx) => {
    if (idx === editIndex && msg.role === "user") {
      return {
        ...msg,
        parts: [{ type: "text" as const, text: newContent }],
      };
    }
    // 删除编辑点之后的所有 assistant 消息
    if (idx > editIndex && msg.role === "assistant") {
      return null;
    }
    return msg;
  }).filter((msg): msg is UIMessage => msg !== null);

  const modelMessages = await convertToModelMessages(editedMessages, {
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
        const usage = finishEvent.usage;
        const toolCalls = finishEvent.toolCalls;
        
        endRun(runId, {
          status: "success",
          usage: convertUsage(usage),
          toolCallCount: toolCalls?.length || 0,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
