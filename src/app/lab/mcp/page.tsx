"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Globe,
  Loader2,
  Play,
  Plus,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";

type TransportType = "stdio" | "http";

type MCPTool = {
  name: string;
  description: string;
  inputSchema?: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

type MCPClient = {
  id: string;
  name: string;
  transport: TransportType;
  connected: boolean;
  initialized: boolean;
  connectedAt: string;
  toolsCount: number;
};

type MCPClientDetail = MCPClient & {
  config: {
    id: string;
    name: string;
    transport: TransportType;
    url?: string;
    command?: string;
  };
  tools: MCPTool[];
};

type ToolCallResult = {
  success: boolean;
  toolName: string;
  duration: number;
  content?: Array<{ type: string; text?: string }>;
  error?: string;
  isError?: boolean;
};

export default function MCPPage() {
  const [clients, setClients] = useState<MCPClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<MCPClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTransport, setFormTransport] = useState<TransportType>("http");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formEnv, setFormEnv] = useState("");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState("");
  const [callingTool, setCallingTool] = useState(false);
  const [toolResult, setToolResult] = useState<ToolCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp/connect");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClientDetail = useCallback(async (clientId: string) => {
    try {
      const response = await fetch(`/api/mcp/connect?id=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedClient(data);
      }
    } catch {
      setError("Failed to load client details");
    }
  }, []);

  const handleLoadClients = useCallback(async () => {
    await loadClients();
  }, [loadClients]);

  const handleAddClient = async () => {
    if (!formName.trim()) {
      setError("Name is required");
      return;
    }

    if (formTransport === "http" && !formUrl.trim()) {
      setError("URL is required for HTTP transport");
      return;
    }

    if (formTransport === "stdio" && !formCommand.trim()) {
      setError("Command is required for stdio transport");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const env: Record<string, string> = {};
      if (formEnv.trim()) {
        formEnv.split("\n").forEach((line) => {
          const [key, ...valueParts] = line.split("=");
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join("=").trim();
          }
        });
      }

      const response = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `mcp-${Date.now()}`,
          name: formName.trim(),
          transport: formTransport,
          url: formTransport === "http" ? formUrl.trim() : undefined,
          command: formTransport === "stdio" ? formCommand.trim() : undefined,
          args: formTransport === "stdio" && formArgs.trim()
            ? formArgs.split(" ").filter(Boolean)
            : undefined,
          env,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Connection failed");
        return;
      }

      setShowAddForm(false);
      setFormName("");
      setFormUrl("");
      setFormCommand("");
      setFormArgs("");
      setFormEnv("");
      setError(null);
      await loadClients();

      if (data.clientId) {
        await loadClientDetail(data.clientId);
      }
    } catch {
      setError("Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (clientId: string) => {
    try {
      await fetch(`/api/mcp/connect?id=${clientId}`, { method: "DELETE" });
      await loadClients();
      if (selectedClient?.id === clientId) {
        setSelectedClient(null);
      }
    } catch {
      setError("Failed to disconnect");
    }
  };

  const handleCallTool = async () => {
    if (!selectedClient || !selectedTool) return;

    let args: Record<string, unknown> = {};
    if (toolArgs.trim()) {
      try {
        args = JSON.parse(toolArgs);
      } catch {
        setError("Invalid JSON in arguments");
        return;
      }
    }

    setCallingTool(true);
    setToolResult(null);
    setError(null);

    try {
      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          toolName: selectedTool.name,
          arguments: args,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Tool call failed");
        return;
      }

      setToolResult(data);
      setError(null);
    } catch {
      setError("Tool call failed");
    } finally {
      setCallingTool(false);
    }
  };

  const formatArgs = (schema?: MCPTool["inputSchema"]) => {
    if (!schema?.properties) return "{}";

    const example: Record<string, unknown> = {};
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const p = prop as { type?: string; default?: unknown };
      if (p.default !== undefined) {
        example[key] = p.default;
      } else {
        switch (p.type) {
          case "string":
            example[key] = "";
            break;
          case "number":
          case "integer":
            example[key] = 0;
            break;
          case "boolean":
            example[key] = false;
            break;
          case "array":
            example[key] = [];
            break;
          case "object":
            example[key] = {};
            break;
          default:
            example[key] = null;
        }
      }
    });

    return JSON.stringify(example, null, 2);
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="app-accent size-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                MCP Integration
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                MCP 外部工具生态
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                连接 MCP (Model Context Protocol) 服务器，访问外部工具生态。支持 stdio 和 HTTP 传输。
              </p>
            </div>
            <div className="app-card-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Servers</p>
              <p className="app-accent mt-1 text-lg">{clients.length}</p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* 左侧：服务器列表 */}
          <aside className="space-y-4">
            {/* 添加服务器 */}
            <section className="app-panel border p-4">
              <button
                className="app-button-hot flex w-full items-center justify-center gap-2"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? (
                  <>
                    <X className="size-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add Server
                  </>
                )}
              </button>

              {showAddForm && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Transport Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        className={`flex flex-1 items-center justify-center gap-2 border p-2 text-xs transition ${
                          formTransport === "http"
                            ? "app-card-active border-cyan-500/50"
                            : "border-transparent hover:border-white/10"
                        }`}
                        onClick={() => setFormTransport("http")}
                      >
                        <Globe className="size-4" />
                        HTTP
                      </button>
                      <button
                        className={`flex flex-1 items-center justify-center gap-2 border p-2 text-xs transition ${
                          formTransport === "stdio"
                            ? "app-card-active border-cyan-500/50"
                            : "border-transparent hover:border-white/10"
                        }`}
                        onClick={() => setFormTransport("stdio")}
                      >
                        <Terminal className="size-4" />
                        STDIO
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Name
                    </label>
                    <input
                      type="text"
                      className="field-input w-full font-mono text-sm"
                      placeholder="My MCP Server"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  {formTransport === "http" ? (
                    <div>
                      <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                        URL
                      </label>
                      <input
                        type="text"
                        className="field-input w-full font-mono text-sm"
                        placeholder="http://localhost:3000/mcp"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                          Command
                        </label>
                        <input
                          type="text"
                          className="field-input w-full font-mono text-sm"
                          placeholder="npx"
                          value={formCommand}
                          onChange={(e) => setFormCommand(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                          Arguments (space separated)
                        </label>
                        <input
                          type="text"
                          className="field-input w-full font-mono text-sm"
                          placeholder="-y @modelcontextprotocol/server-filesystem ./data"
                          value={formArgs}
                          onChange={(e) => setFormArgs(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                          Environment Variables (KEY=value, one per line)
                        </label>
                        <textarea
                          className="field-input w-full resize-y font-mono text-sm"
                          placeholder="API_KEY=xxx&#10;DEBUG=true"
                          value={formEnv}
                          onChange={(e) => setFormEnv(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                      {error}
                    </div>
                  )}

                  <button
                    className="app-button-hot flex w-full items-center justify-center gap-2"
                    disabled={connecting}
                    onClick={() => void handleAddClient()}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wifi className="size-4" />
                        Connect
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* 服务器列表 */}
            <section className="app-panel border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="app-accent flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                  <Terminal className="size-4" />
                  Connected Servers
                </h2>
                <button
                  className="app-chip border px-2 py-1 font-mono text-[10px]"
                  onClick={() => void handleLoadClients()}
                >
                  Refresh
                </button>
              </div>

              {clients.length === 0 ? (
                <p className="app-muted py-4 text-center text-sm">
                  No servers connected. Add one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`cursor-pointer rounded border p-3 transition ${
                        selectedClient?.id === client.id
                          ? "app-card-active border-cyan-500/50"
                          : "border-transparent hover:border-white/10"
                      }`}
                      onClick={() => void loadClientDetail(client.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {client.connected ? (
                            <Wifi className="size-4 text-emerald-400" />
                          ) : (
                            <WifiOff className="size-4 text-rose-400" />
                          )}
                          <span className="text-sm font-medium">{client.name}</span>
                        </div>
                        <span className="app-chip border px-2 py-0.5 font-mono text-[10px]">
                          {client.transport}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="app-subtle font-mono text-xs">
                          {client.toolsCount} tools
                        </span>
                        <button
                          className="text-rose-400 transition hover:text-rose-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnect(client.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          {/* 右侧：工具详情和调用 */}
          <main className="space-y-4">
            {!selectedClient ? (
              <div className="app-panel flex min-h-64 items-center justify-center border p-8">
                <div className="text-center">
                  <Terminal className="app-subtle mx-auto mb-4 size-12" />
                  <p className="app-muted text-lg">Select a server to view tools</p>
                  <p className="app-subtle mt-2 text-sm">
                    Choose a connected MCP server from the left panel
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* 服务器信息 */}
                <section className="app-panel border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="app-accent flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      {selectedClient.connected ? (
                        <Wifi className="size-4 text-emerald-400" />
                      ) : (
                        <WifiOff className="size-4 text-rose-400" />
                      )}
                      {selectedClient.name}
                    </h2>
                    <span className="app-chip border px-2 py-1 font-mono text-[10px]">
                      {selectedClient.transport}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded border border-white/5 bg-white/5 p-3">
                      <p className="app-subtle font-mono text-[10px] uppercase tracking-wider">
                        Status
                      </p>
                      <p className={`mt-1 font-mono text-sm ${selectedClient.connected ? "text-emerald-400" : "text-rose-400"}`}>
                        {selectedClient.connected ? "Connected" : "Disconnected"}
                      </p>
                    </div>
                    <div className="rounded border border-white/5 bg-white/5 p-3">
                      <p className="app-subtle font-mono text-[10px] uppercase tracking-wider">
                        Tools
                      </p>
                      <p className="mt-1 font-mono text-sm">{selectedClient.tools?.length || 0}</p>
                    </div>
                    <div className="rounded border border-white/5 bg-white/5 p-3">
                      <p className="app-subtle font-mono text-[10px] uppercase tracking-wider">
                        Connected At
                      </p>
                      <p className="mt-1 font-mono text-xs">
                        {new Date(selectedClient.connectedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 工具列表 */}
                <section className="app-panel border p-4">
                  <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                    <Terminal className="size-4" />
                    Available Tools ({selectedClient.tools?.length || 0})
                  </h2>

                  {selectedClient.tools?.length === 0 ? (
                    <p className="app-muted py-4 text-center text-sm">
                      No tools available on this server
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedClient.tools?.map((tool) => (
                        <div
                          key={tool.name}
                          className={`cursor-pointer rounded border p-4 transition ${
                            selectedTool?.name === tool.name
                              ? "app-card-active border-cyan-500/50"
                              : "border-white/5 hover:border-white/20"
                          }`}
                          onClick={() => {
                            setSelectedTool(selectedTool?.name === tool.name ? null : tool);
                            setToolArgs(formatArgs(tool.inputSchema));
                            setToolResult(null);
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">
                                  {tool.name}
                                </span>
                                {selectedTool?.name === tool.name && (
                                  <ChevronDown className="size-4" />
                                )}
                              </div>
                              <p className="app-muted mt-1 text-xs">
                                {tool.description || "No description"}
                              </p>
                            </div>
                            <button
                              className="app-chip border px-2 py-1 font-mono text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(tool.name);
                              }}
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>

                          {selectedTool?.name === tool.name && tool.inputSchema && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <h4 className="app-subtle mb-2 font-mono text-[10px] uppercase tracking-wider">
                                Schema
                              </h4>
                              <pre className="max-h-32 overflow-auto rounded border border-white/5 bg-black/20 p-2 font-mono text-xs">
                                {JSON.stringify(tool.inputSchema, null, 2)}
                              </pre>

                              <div className="mt-4">
                                <h4 className="app-subtle mb-2 font-mono text-[10px] uppercase tracking-wider">
                                  Arguments (JSON)
                                </h4>
                                <textarea
                                  className="field-input w-full resize-y font-mono text-xs"
                                  value={toolArgs}
                                  onChange={(e) => setToolArgs(e.target.value)}
                                  rows={6}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              {error && (
                                <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                                  {error}
                                </div>
                              )}

                              {toolResult && (
                                <div className="mt-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <h4 className="app-subtle font-mono text-[10px] uppercase tracking-wider">
                                      Result ({toolResult.duration}ms)
                                    </h4>
                                    <span
                                      className={`app-chip border px-2 py-0.5 font-mono text-[10px] ${
                                        toolResult.success
                                          ? "border-emerald-500/50 text-emerald-400"
                                          : "border-rose-500/50 text-rose-400"
                                      }`}
                                    >
                                      {toolResult.success ? "Success" : "Error"}
                                    </span>
                                  </div>
                                  <pre className={`max-h-48 overflow-auto rounded border p-3 font-mono text-xs ${
                                    toolResult.success
                                      ? "border-white/5 bg-black/20"
                                      : "border-rose-500/30 bg-rose-500/10"
                                  }`}>
                                    {toolResult.error || JSON.stringify(toolResult.content, null, 2)}
                                  </pre>
                                </div>
                              )}

                              <button
                                className="app-button-hot mt-4 flex w-full items-center justify-center gap-2"
                                disabled={callingTool}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCallTool();
                                }}
                              >
                                {callingTool ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Calling...
                                  </>
                                ) : (
                                  <>
                                    <Play className="size-4" />
                                    Call Tool
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </main>
  );
}
