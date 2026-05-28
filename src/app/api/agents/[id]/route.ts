/**
 * Agent 运行 API 路由 - POST /api/agents/[id]
 * 使用 streamText 模式
 */

import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
  type ToolSet,
} from "ai";
import { NextResponse } from "next/server";
import { getAgent, listAgents } from "@/lib/agents/registry";
import { getChatModel } from "@/lib/ai/model";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      messages,
      modelConfigId,
      maxSteps,
      temperature,
    }: {
      messages: UIMessage[];
      modelConfigId?: number;
      maxSteps?: number;
      temperature?: number;
    } = await req.json();

    const agentConfig = getAgent(id);

    if (!agentConfig) {
      const availableAgents = listAgents().map((a) => a.id);
      return NextResponse.json(
        {
          message: `Agent '${id}' not found`,
          availableAgents,
        },
        { status: 404 }
      );
    }

    // 使用 streamText 模式
    const modelMessages = await convertToModelMessages(messages, {
      tools: agentConfig.tools as ToolSet,
    });

    const result = streamText({
      model: getChatModel(modelConfigId),
      system: agentConfig.systemPrompt,
      messages: modelMessages,
      tools: agentConfig.tools as ToolSet,
      stopWhen: stepCountIs(maxSteps ?? agentConfig.maxSteps ?? 5),
      temperature: temperature ?? agentConfig.temperature ?? 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent execution failed";

    return NextResponse.json({ message }, { status: 500 });
  }
}
