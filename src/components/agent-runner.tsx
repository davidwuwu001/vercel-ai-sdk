"use client";

/**
 * Agent Runner 组件 - 在 UI 中运行 Agent 并显示工具调用时间线
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Wrench,
} from "lucide-react";
import type { AgentMetadata } from "@/lib/agents/types";

interface ToolCall {
  id: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  timestamp: Date;
  durationMs?: number;
}

interface AgentRunnerProps {
  agent: AgentMetadata;
  modelConfigId?: number;
}

export function AgentRunner({ agent, modelConfigId }: AgentRunnerProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolCalls, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          modelConfigId,
          maxSteps: agent.modelRequirements?.recommendedTemperature
            ? undefined
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const data = JSON.parse(line.slice(2));
                if (data.content) {
                  assistantMessage += data.content;
                }
              } catch {
                // Skip invalid JSON
              }
            } else if (line.startsWith("3:")) {
              try {
                const toolData = JSON.parse(line.slice(2));
                const toolCall: ToolCall = {
                  id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  toolName: toolData.toolCall?.toolName || "unknown",
                  input: toolData.toolCall?.input || {},
                  timestamp: new Date(),
                };
                setToolCalls((prev) => [...prev, toolCall]);
              } catch {
                // Skip invalid JSON
              }
            } else if (line.startsWith("4:")) {
              try {
                const resultData = JSON.parse(line.slice(2));
                if (resultData.result) {
                  setToolCalls((prev) => {
                    const updated = [...prev];
                    if (updated.length > 0) {
                      const lastCall = updated[updated.length - 1];
                      lastCall.output = resultData.result;
                      lastCall.durationMs = new Date().getTime() - lastCall.timestamp.getTime();
                    }
                    return updated;
                  });
                }
              } catch {
                // Skip invalid JSON
              }
            } else if (line.startsWith("7:")) {
              try {
                const finishData = JSON.parse(line.slice(2));
                if (finishData.finishReason === "tool_calls") {
                  // More tool calls incoming
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage || "Agent completed." }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Request failed",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Agent Header */}
      <div className="app-panel border-b p-4">
        <div className="flex items-center gap-3">
          <div className="app-icon-tile grid size-10 place-items-center border">
            <Bot className="size-5" />
          </div>
          <div>
            <h2 className="app-title text-lg font-semibold">{agent.name}</h2>
            <p className="app-muted text-sm">{agent.purpose}</p>
          </div>
        </div>
        {agent.instructions && (
          <div className="app-card mt-3 border p-3">
            <p className="app-subtle mb-1 text-xs uppercase tracking-wider">Instructions</p>
            <p className="app-muted text-sm whitespace-pre-wrap">{agent.instructions}</p>
          </div>
        )}
      </div>

      {/* Tool Timeline */}
      {toolCalls.length > 0 && (
        <div className="app-panel border-b">
          <div className="flex items-center gap-2 border-b p-3">
            <Wrench className="app-accent size-4" />
            <span className="app-subtle text-xs uppercase tracking-wider">
              Tool Calls ({toolCalls.length})
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto p-3">
            <div className="space-y-2">
              {toolCalls.map((call) => (
                <div key={call.id} className="app-card border">
                  <button
                    className="flex w-full items-center justify-between p-2 text-left"
                    onClick={() =>
                      setExpandedTool(expandedTool === call.id ? null : call.id)
                    }
                  >
                    <div className="flex items-center gap-2">
                      {call.output ? (
                        <CheckCircle className="size-4 text-green-500" />
                      ) : call.error ? (
                        <XCircle className="size-4 text-red-500" />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-blue-500" />
                      )}
                      <span className="app-title font-mono text-sm">
                        {call.toolName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.durationMs && (
                        <span className="app-subtle text-xs">
                          {call.durationMs}ms
                        </span>
                      )}
                      {expandedTool === call.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </div>
                  </button>
                  {expandedTool === call.id && (
                    <div className="border-t p-2">
                      <div className="mb-2">
                        <p className="app-subtle text-xs uppercase">Input</p>
                        <pre className="app-card mt-1 overflow-x-auto whitespace-pre-wrap border p-2 text-xs">
                          {JSON.stringify(call.input, null, 2)}
                        </pre>
                      </div>
                      {call.output !== undefined && (
                        <div>
                          <p className="app-subtle text-xs uppercase">Output</p>
                          <pre className="app-card mt-1 overflow-x-auto whitespace-pre-wrap border p-2 text-xs">
                            {typeof call.output === "string" 
                              ? call.output 
                              : JSON.stringify(call.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {call.error && (
                        <div>
                          <p className="text-red-500 text-xs uppercase">Error</p>
                          <p className="text-red-500 mt-1 text-xs">{call.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="app-muted mb-4 size-12" />
            <p className="app-muted text-lg">Start a conversation with {agent.name}</p>
            <p className="app-subtle mt-2 max-w-sm text-sm">
              This agent can help you with {agent.purpose.toLowerCase()}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`app-card max-w-[80%] border px-4 py-3 ${
                    msg.role === "user"
                      ? "app-card-active"
                      : ""
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {msg.role === "assistant" && <Bot className="size-4" />}
                    <span className="app-subtle text-xs uppercase">
                      {msg.role}
                    </span>
                  </div>
                  <p className="app-title whitespace-pre-wrap text-sm">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2">
                <Loader2 className="app-accent size-4 animate-spin" />
                <span className="app-muted text-sm">Agent is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="app-panel border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            disabled={isLoading}
            className="app-input flex-1 resize-none border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="app-button-primary border px-4 py-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
