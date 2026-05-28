/**
 * MCP (Model Context Protocol) 客户端实现
 * 支持 stdio 和 HTTP 传输方式
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import {
  MCPClientConfig,
  MCPConnectionStatus,
  MCPTool,
  MCPToolResult,
  MCPToolContent,
  MCPInitializeResult,
  MCPJSONRPCRequest,
  MCPJSONRPCResponse,
  MCPJSONRPCNotification,
  MCP_METHODS,
} from "./types";

export class MCPClient extends EventEmitter {
  private clientId: string;
  private config: MCPClientConfig;
  private process?: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private connected = false;
  private initialized = false;
  private httpController?: AbortController;
  private initializedPromise?: Promise<MCPInitializeResult>;

  constructor(config: MCPClientConfig) {
    super();
    this.clientId = config.id;
    this.config = config;
  }

  get id(): string {
    return this.clientId;
  }

  get name(): string {
    return this.config.name;
  }

  get status(): MCPConnectionStatus {
    return {
      clientId: this.clientId,
      connected: this.connected,
      connectedAt: this.connected ? new Date().toISOString() : undefined,
    };
  }

  private generateId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.config.transport === "stdio") {
      await this.connectStdio();
    } else {
      await this.connectHttp();
    }
  }

  private async connectStdio(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.command) {
        reject(new Error("Command is required for stdio transport"));
        return;
      }

      const env = {
        ...process.env,
        ...this.config.env,
      };

      this.process = spawn(this.config.command, this.config.args || [], {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.on("error", (error) => {
        this.connected = false;
        this.emit("error", error);
        reject(error);
      });

      this.process.on("exit", (code) => {
        this.connected = false;
        this.initialized = false;
        this.emit("close", code);
      });

      if (this.process.stdout && this.process.stderr) {
        this.process.stdout.on("data", (data) => {
          this.handleMessage(data.toString());
        });

        this.process.stderr.on("data", (data) => {
          this.emit("debug", `stderr: ${data.toString()}`);
        });
      }

      this.connected = true;
      this.emit("connected");
      resolve();
    });
  }

  private async connectHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error("URL is required for HTTP transport");
    }

    this.httpController = new AbortController();
    
    const response = await fetch(`${this.config.url}/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.generateId(),
        method: MCP_METHODS.Initialize,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "mcp-client",
            version: "1.0.0",
          },
        },
      }),
      signal: this.httpController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP connection failed: ${response.status}`);
    }

    this.connected = true;
    this.emit("connected");
  }

  private handleMessage(data: string): void {
    const lines = data.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const message = JSON.parse(line);

        if ("id" in message && message.id !== undefined) {
          this.handleResponse(message as MCPJSONRPCResponse);
        } else if ("method" in message) {
          this.handleNotification(message as MCPJSONRPCNotification);
        }
      } catch {
        this.emit("debug", `Failed to parse message: ${line}`);
      }
    }
  }

  private handleResponse(response: MCPJSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  private handleNotification(notification: MCPJSONRPCNotification): void {
    this.emit("notification", notification);
    
    if (notification.method === "notifications/tools/list_changed") {
      this.emit("toolsChanged");
    } else if (notification.method === "notifications/resources/updated") {
      this.emit("resourcesUpdated", notification.params);
    }
  }

  private async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const request: MCPJSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const message = JSON.stringify(request);

      if (this.config.transport === "stdio" && this.process?.stdin) {
        this.process.stdin.write(message + "\n");
      } else if (this.config.transport === "http" && this.config.url) {
        this.sendHttpRequest(method, params)
          .then(resolve as (value: unknown) => void)
          .catch(reject);
        this.pendingRequests.delete(id);
        return;
      }

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  private async sendHttpRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.config.url) {
      throw new Error("URL is required for HTTP transport");
    }

    const response = await fetch(this.config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.generateId(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.result;
  }

  async initialize(): Promise<MCPInitializeResult> {
    if (this.initializedPromise) {
      return this.initializedPromise;
    }

    this.initializedPromise = this._doInitialize();
    return this.initializedPromise;
  }

  private async _doInitialize(): Promise<MCPInitializeResult> {
    const result = await this.sendRequest<MCPInitializeResult>(MCP_METHODS.Initialize, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "mcp-client",
        version: "1.0.0",
      },
    });

    this.initialized = true;
    this.emit("initialized", result);
    return result;
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest<{ tools: MCPTool[] }>(MCP_METHODS.ToolsList);
    return result.tools || [];
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    try {
      const result = await this.sendRequest<{ content: MCPToolContent[]; isError?: boolean }>(
        MCP_METHODS.ToolsCall,
        {
          name: toolName,
          arguments: args,
        }
      );

      return {
        success: !result.isError,
        content: result.content,
        isError: result.isError,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      };
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.sendRequest<boolean>(MCP_METHODS.Ping);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.config.transport === "stdio" && this.process) {
      this.process.kill();
      this.process = undefined;
    } else if (this.config.transport === "http" && this.httpController) {
      this.httpController.abort();
      this.httpController = undefined;
    }

    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error("Client disconnected"));
    });
    this.pendingRequests.clear();

    this.connected = false;
    this.initialized = false;
    this.initializedPromise = undefined;
    this.emit("disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export class MCPClientManager {
  private clients = new Map<string, MCPClient>();

  createClient(config: MCPClientConfig): MCPClient {
    const client = new MCPClient(config);
    this.clients.set(config.id, client);
    return client;
  }

  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  removeClient(id: string): boolean {
    const client = this.clients.get(id);
    if (client) {
      client.disconnect();
      return this.clients.delete(id);
    }
    return false;
  }

  listClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  async connectClient(config: MCPClientConfig): Promise<MCPClient> {
    const client = this.getClient(config.id) || this.createClient(config);
    await client.connect();
    await client.initialize();
    return client;
  }

  async disconnectClient(id: string): Promise<void> {
    const client = this.getClient(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }
}

export const mcpClientManager = new MCPClientManager();
