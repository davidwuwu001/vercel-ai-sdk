/**
 * MCP 工具 API
 * GET: 列出指定客户端的工具
 * POST: 调用工具
 */

import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcp/client";
import { MCPToolResult } from "@/lib/mcp/types";
import { mcpClientStore } from "@/lib/mcp/store";
import { z } from "zod";

const callToolSchema = z.object({
  clientId: z.string(),
  toolName: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  const clientInfo = mcpClientStore.get(clientId);
  if (!clientInfo) {
    return NextResponse.json(
      { error: "Client not connected" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    clientId,
    tools: clientInfo.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = callToolSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId, toolName, arguments: args } = parsed.data;

    const clientInfo = mcpClientStore.get(clientId);
    if (!clientInfo) {
      return NextResponse.json(
        { error: "Client not connected" },
        { status: 404 }
      );
    }

    const tool = clientInfo.tools.find((t) => t.name === toolName);
    if (!tool) {
      return NextResponse.json(
        { error: `Tool '${toolName}' not found` },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const result = await clientInfo.client.callTool(toolName, args);
    const duration = Date.now() - startTime;

    const response: MCPToolResult & { duration: number; toolName: string } = {
      success: result.success,
      toolName,
      duration,
      content: result.content,
      error: result.error,
      isError: result.isError,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool call failed";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  if (!mcpClientStore.has(clientId)) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
  }

  mcpClientStore.delete(clientId);
  mcpClientManager.removeClient(clientId);

  return NextResponse.json({ success: true });
}
