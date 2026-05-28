/**
 * MCP 连接管理 API
 * POST: 创建/连接 MCP 服务器
 * GET: 获取连接状态
 * DELETE: 断开连接
 */

import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcp/client";
import { MCPClientConfig } from "@/lib/mcp/types";
import { mcpClientStore } from "@/lib/mcp/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, transport, command, args, url, env } = body;

    if (!id || !name || !transport) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, transport" },
        { status: 400 }
      );
    }

    if (transport === "stdio" && !command) {
      return NextResponse.json(
        { error: "Command is required for stdio transport" },
        { status: 400 }
      );
    }

    if (transport === "http" && !url) {
      return NextResponse.json(
        { error: "URL is required for HTTP transport" },
        { status: 400 }
      );
    }

    if (mcpClientStore.has(id)) {
      const existing = mcpClientStore.get(id)!;
      await existing.client.disconnect();
    }

    const config: MCPClientConfig = {
      id,
      name,
      transport,
      command,
      args,
      url,
      env: env || {},
    };

    const client = mcpClientManager.createClient(config);
    
    await client.connect();
    await client.initialize();

    const tools = await client.listTools();

    mcpClientStore.set(id, {
      client,
      config,
      tools,
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      clientId: id,
      serverInfo: {
        name: config.name,
        transport: config.transport,
        toolsCount: tools.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("id");

  if (clientId) {
    const clientInfo = mcpClientStore.get(clientId);
    if (!clientInfo) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      clientId,
      config: {
        id: clientInfo.config.id,
        name: clientInfo.config.name,
        transport: clientInfo.config.transport,
        url: clientInfo.config.url,
        command: clientInfo.config.command,
      },
      connected: clientInfo.client.isConnected(),
      initialized: clientInfo.client.isInitialized(),
      connectedAt: clientInfo.connectedAt,
      tools: clientInfo.tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  }

  const clients = mcpClientStore.list().map((info) => ({
    id: info.config.id,
    name: info.config.name,
    transport: info.config.transport,
    connected: info.client.isConnected(),
    initialized: info.client.isInitialized(),
    connectedAt: info.connectedAt,
    toolsCount: info.tools.length,
  }));

  return NextResponse.json({ clients });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("id");

  if (!clientId) {
    return NextResponse.json(
      { error: "Client ID is required" },
      { status: 400 }
    );
  }

  const clientInfo = mcpClientStore.get(clientId);
  if (!clientInfo) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
  }

  await clientInfo.client.disconnect();
  mcpClientManager.removeClient(clientId);
  mcpClientStore.delete(clientId);

  return NextResponse.json({ success: true });
}
