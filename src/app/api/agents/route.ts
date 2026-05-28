/**
 * Agent 注册信息 API 路由 - GET /api/agents
 */

import { NextResponse } from "next/server";
import {
  listAgents,
  createStreamingAgentExecutor,
} from "@/lib/agents/registry";
import type { AgentMetadata } from "@/lib/agents/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const agents = listAgents();

    const agentList = agents.map((agent: AgentMetadata) => ({
      id: agent.id,
      name: agent.name,
      purpose: agent.purpose,
      instructions: agent.instructions,
      tools: agent.tools?.map((t) => t.name) || [],
      tags: agent.tags || [],
      version: agent.version,
    }));

    return NextResponse.json({ agents: agentList });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list agents";
    return NextResponse.json({ message }, { status: 500 });
  }
}
