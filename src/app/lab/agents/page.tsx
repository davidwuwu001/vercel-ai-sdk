"use client";

/**
 * Agent Lab 页面 - 列出所有已注册的 Agents 并提供测试界面
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Boxes,
  ChevronRight,
  Loader2,
  Wrench,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { AgentRunner } from "@/components/agent-runner";
import type { AgentMetadata } from "@/lib/agents/types";

interface AgentListItem {
  id: string;
  name: string;
  purpose: string;
  instructions?: string;
  tools: string[];
  tags: string[];
  version?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentListItem | null>(null);
  const initRef = useRef(false);

  const loadAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      void loadAgents();
    }
  }, []);

  if (isLoading) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="app-accent mx-auto mb-4 size-8 animate-spin" />
          <p className="app-muted">Loading agents...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">Error: {error}</p>
          <button
            onClick={() => void loadAgents()}
            className="app-button-primary mt-4 border px-4 py-2"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // 如果有选中的 Agent，显示 Agent Runner
  if (selectedAgent) {
    return (
      <main className="app-shell min-h-screen">
        <div className="mx-auto flex h-screen max-w-6xl flex-col">
          {/* 返回按钮和标题 */}
          <div className="app-panel border-b p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedAgent(null)}
                className="app-accent inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider hover:opacity-80"
              >
                <ArrowLeft className="size-4" />
                Back to agents
              </button>
              <div className="flex items-center gap-2">
                {selectedAgent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="app-chip border px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Runner */}
          <div className="flex-1 overflow-hidden">
            <AgentRunner
              agent={selectedAgent as unknown as AgentMetadata}
            />
          </div>
        </div>
      </main>
    );
  }

  // Agent 列表视图
  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to lab
          </Link>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Agent Lab
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                正式 Agent 封装
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                测试已注册的 Agents，每个 Agent 都有专属工具和指令模板。
              </p>
            </div>
            <div className="app-card-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Agents</p>
              <p className="app-accent mt-1 text-lg">{agents.length}</p>
            </div>
          </div>
        </header>

        {/* Agent List */}
        <section className="mt-5">
          {agents.length === 0 ? (
            <div className="app-panel border p-12 text-center">
              <Boxes className="app-muted mx-auto mb-4 size-12" />
              <p className="app-muted text-lg">No agents registered yet</p>
              <p className="app-subtle mt-2 text-sm">
                Agents will appear here once they are registered in the system.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <article
                  key={agent.id}
                  className="app-card group border p-5 transition-colors hover:border-blue-500/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="app-icon-tile grid size-12 shrink-0 place-items-center border">
                        <Bot className="size-6" />
                      </div>
                      <div>
                        <h2 className="app-title text-xl font-semibold">
                          {agent.name}
                        </h2>
                        <p className="app-muted mt-1 text-sm">
                          {agent.purpose}
                        </p>

                        {/* Tools */}
                        {agent.tools && agent.tools.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Wrench className="app-subtle size-3" />
                              <span className="app-subtle text-xs uppercase tracking-wider">
                                Tools:
                              </span>
                            </div>
                            {agent.tools.map((tool) => (
                              <span
                                key={tool}
                                className="app-chip border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Tags */}
                        {agent.tags && agent.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag className="app-subtle size-3" />
                            {agent.tags.map((tag) => (
                              <span
                                key={tag}
                                className="app-subtle text-xs"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedAgent(agent)}
                      className="app-button-primary shrink-0 border px-4 py-2 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">测试</span>
                        <ChevronRight className="size-4" />
                      </div>
                    </button>
                  </div>

                  {/* Instructions Preview */}
                  {agent.instructions && (
                    <div className="app-card mt-4 border p-3">
                      <p className="app-subtle mb-1 text-xs uppercase tracking-wider">
                        Instructions
                      </p>
                      <p className="app-muted line-clamp-2 text-sm">
                        {agent.instructions}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Info Section */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="app-card border p-4">
            <div className="app-icon-tile mb-3 grid size-10 w-fit place-items-center border">
              <Bot className="size-5" />
            </div>
            <h3 className="app-title font-semibold">Agent Registry</h3>
            <p className="app-muted mt-2 text-sm">
              Agents are registered with metadata, tools, and model requirements.
              Each agent has a unique ID and purpose.
            </p>
          </div>
          <div className="app-card border p-4">
            <div className="app-icon-tile mb-3 grid size-10 w-fit place-items-center border">
              <Wrench className="size-5" />
            </div>
            <h3 className="app-title font-semibold">Tool Calls</h3>
            <p className="app-muted mt-2 text-sm">
              Watch tool calls in real-time with input/output inspection.
              Tool execution is logged with timing information.
            </p>
          </div>
          <div className="app-card border p-4">
            <div className="app-icon-tile mb-3 grid size-10 w-fit place-items-center border">
              <Boxes className="size-5" />
            </div>
            <h3 className="app-title font-semibold">Shared Config</h3>
            <p className="app-muted mt-2 text-sm">
              Agents share model configuration and can use common tools.
              Run multiple agents with different settings.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
