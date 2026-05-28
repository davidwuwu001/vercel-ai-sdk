/**
 * MCP (Model Context Protocol) 类型定义
 * 基于 JSON-RPC 2.0 协议
 */

export type TransportType = "stdio" | "http";

export interface MCPClientConfig {
  id: string;
  name: string;
  transport: TransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPConnectionStatus {
  clientId: string;
  connected: boolean;
  error?: string;
  connectedAt?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPInputSchema;
}

export interface MCPInputSchema {
  type: "object";
  properties?: Record<string, MCPSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MCPSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: unknown[];
  items?: MCPSchemaProperty;
  properties?: Record<string, MCPSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | MCPSchemaProperty;
  anyOf?: MCPSchemaProperty[];
  oneOf?: MCPSchemaProperty[];
  allOf?: MCPSchemaProperty[];
  format?: string;
  pattern?: string;
}

export interface MCPToolCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  content?: MCPToolContent[];
  error?: string;
  isError?: boolean;
}

export interface MCPToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceUpdatedNotification {
  uri: string;
}

export interface MCPListToolsResult {
  tools: MCPTool[];
}

export interface MCPListResourcesResult {
  resources: MCPResource[];
  resourceTemplates?: MCPResourceTemplate[];
}

export interface MCPCallToolResult {
  content: MCPToolContent[];
  isError?: boolean;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

export interface MCPServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: Record<string, unknown>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPJSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPJSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPJSONRPCError;
}

export interface MCPJSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPJSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export const MCP_ERROR_CODES = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerError: -32000,
} as const;

export const MCP_METHODS = {
  Initialize: "initialize",
  ToolsList: "tools/list",
  ToolsCall: "tools/call",
  ResourcesList: "resources/list",
  ResourcesRead: "resources/read",
  ResourcesSubscribe: "resources/subscribe",
  PromptsList: "prompts/list",
  PromptsGet: "prompts/get",
  Ping: "ping",
} as const;
