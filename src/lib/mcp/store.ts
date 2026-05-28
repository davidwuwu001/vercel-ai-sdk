/**
 * MCP 客户端共享存储
 * 用于在 API routes 之间共享客户端状态
 */

import { MCPClient } from "./client";
import { MCPClientConfig, MCPTool } from "./types";

interface ConnectedClient {
  client: MCPClient;
  config: MCPClientConfig;
  tools: MCPTool[];
  connectedAt: string;
}

class MCPClientStore {
  private clients = new Map<string, ConnectedClient>();

  set(id: string, info: ConnectedClient): void {
    this.clients.set(id, info);
  }

  get(id: string): ConnectedClient | undefined {
    return this.clients.get(id);
  }

  has(id: string): boolean {
    return this.clients.has(id);
  }

  delete(id: string): boolean {
    return this.clients.delete(id);
  }

  list(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  listIds(): string[] {
    return Array.from(this.clients.keys());
  }

  clear(): void {
    this.clients.clear();
  }
}

export const mcpClientStore = new MCPClientStore();
