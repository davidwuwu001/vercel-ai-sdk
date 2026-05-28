"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Search,
  DatabaseZap,
  Clock,
  Boxes,
  AlertTriangle,
  Loader2,
  FileJson,
  Eye,
  Play,
  RefreshCw,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { getToolCategories, getToolInfo } from "@/lib/ai/edit-metadata";
import { agentTools } from "@/lib/ai/tools";
import { ToolStreamPanel, ToolCallTimeline, type ToolCallInfo } from "@/components/tool-stream-panel";
import { createSimulatedToolCalls } from "@/lib/ai/tool-stream";

const mockToolCalls = [
  {
    id: "tc-001",
    toolName: "getCurrentTime",
    args: { timezone: "Asia/Shanghai" },
    output: {
      timezone: "Asia/Shanghai",
      iso: "2026-05-23T03:55:00.000Z",
      local: "2026年5月23日星期六 上午11:55:00",
    },
    state: "output-available" as const,
    duration: 45,
    timestamp: "2026-05-23T03:55:00Z",
  },
  {
    id: "tc-002",
    toolName: "queryOrders",
    args: { city: "北京", status: "正常使用" },
    output: {
      source: "mock",
      count: 2,
      orders: [
        {
          id: "TZ-202605-1001",
          studentName: "张三",
          city: "北京",
          teacher: "王老师",
          status: "正常使用",
          balanceHours: 18,
        },
        {
          id: "TZ-202605-1003",
          studentName: "小雨",
          city: "北京",
          teacher: "刘老师",
          status: "正常使用",
          balanceHours: 36,
        },
      ],
    },
    state: "output-available" as const,
    duration: 128,
    timestamp: "2026-05-23T03:55:30Z",
  },
  {
    id: "tc-003",
    toolName: "searchKnowledgeBase",
    args: { query: "老师资料审核规则", enableRerank: true },
    output: {
      source: "knowledge_base",
      query: "老师资料审核规则",
      results: [
        {
          documentName: "SOP-001-教师资质审核流程.md",
          chunkId: "chunk-001",
          content:
            "一、基本资质要求\n1. 必须持有教师资格证\n2. 学历要求：本科及以上\n3. 无犯罪记录证明",
          heading: "基本资质要求",
          score: 0.92,
        },
      ],
      message: "找到 1 个相关片段",
    },
    state: "output-available" as const,
    duration: 892,
    timestamp: "2026-05-23T03:56:00Z",
  },
  {
    id: "tc-004",
    toolName: "createAgentTaskPlan",
    args: {
      goal: "生成家长反馈报告",
      riskLevel: "medium",
    },
    output: {
      goal: "生成家长反馈报告",
      riskLevel: "medium",
      requiresHumanApproval: true,
      steps: [
        "识别目标和业务对象",
        "选择合适的 Skill",
        "调用查询类 Tool 收集上下文",
        "生成草稿或分析结果",
        "等待人工确认后再执行写入动作",
      ],
    },
    state: "output-available" as const,
    duration: 67,
    timestamp: "2026-05-23T03:56:30Z",
  },
  {
    id: "tc-005",
    toolName: "queryOrders",
    args: { studentName: "李想" },
    error: "Connection timeout",
    state: "error" as const,
    duration: 5000,
    timestamp: "2026-05-23T03:57:00Z",
  },
  {
    id: "tc-006",
    toolName: "getCurrentTime",
    args: {},
    state: "running" as const,
    duration: null,
    timestamp: "2026-05-23T03:57:30Z",
  },
];

const categoryLabels: Record<string, string> = {
  system: "系统工具",
  business: "业务工具",
  knowledge: "知识库",
  planning: "任务规划",
};

const categoryIcons: Record<string, React.ReactNode> = {
  system: <Clock className="size-4" />,
  business: <DatabaseZap className="size-4" />,
  knowledge: <Search className="size-4" />,
  planning: <Boxes className="size-4" />,
};

export default function ToolsPage() {
  const [selectedToolCall, setSelectedToolCall] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSteps, setStreamingSteps] = useState<{ step: number; toolCall: ToolCallInfo }[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState<number | undefined>(undefined);
  const [streamingError, setStreamingError] = useState<string | null>(null);

  const toolCategories = getToolCategories();

  const filteredToolCalls = useMemo(() => {
    if (filterCategory === "all") return mockToolCalls;
    const categoryTools = toolCategories[filterCategory as keyof typeof toolCategories] || [];
    return mockToolCalls.filter((tc) =>
      categoryTools.some((t) => tc.toolName.includes(t) || t.includes(tc.toolName))
    );
  }, [filterCategory, toolCategories]);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatDuration(ms: number | null) {
    if (ms === null) return "运行中...";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function getStateIcon(state: string) {
    switch (state) {
      case "output-available":
        return <Zap className="size-4 text-emerald-400" />;
      case "error":
        return <AlertTriangle className="size-4 text-rose-400" />;
      case "running":
        return <Loader2 className="size-4 animate-spin text-amber-400" />;
      default:
        return <Clock className="size-4 text-slate-400" />;
    }
  }

  function getStateLabel(state: string) {
    switch (state) {
      case "output-available":
        return "完成";
      case "error":
        return "错误";
      case "running":
        return "运行中";
      default:
        return state;
    }
  }

  function getToolCategory(toolName: string): string {
    for (const [category, tools] of Object.entries(toolCategories)) {
      if (tools.some((t) => toolName.includes(t))) {
        return category;
      }
    }
    return "unknown";
  }

  /** 运行流式演示 */
  const runStreamingDemo = useCallback(async () => {
    setIsStreaming(true);
    setStreamingSteps([]);
    setTotalDurationMs(undefined);
    setStreamingError(null);

    try {
      const events = createSimulatedToolCalls();
      const startTime = Date.now();

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        await new Promise((resolve) => setTimeout(resolve, 300));

        const toolCall: ToolCallInfo = {
          toolName: event.toolName,
          status: event.status === "success" ? "running" : event.status,
          input: event.args,
          output: event.result,
          error: event.error,
          startTime: event.startTime,
          endTime: event.endTime,
        };

        setStreamingSteps((prev) => [...prev, { step: i + 1, toolCall }]);

        await new Promise((resolve) => setTimeout(resolve, 500));

        if (event.status === "success" && event.endTime) {
          setStreamingSteps((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, toolCall: { ...s.toolCall, status: "success" as const } }
                : s
            )
          );
        }
      }

      setTotalDurationMs(Date.now() - startTime);
    } catch (err) {
      setStreamingError(err instanceof Error ? err.message : "流式演示运行失败，请重试");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  /** 重置流式演示 */
  const resetStreamingDemo = useCallback(() => {
    setStreamingSteps([]);
    setTotalDurationMs(undefined);
    setStreamingError(null);
    setIsStreaming(false);
  }, []);

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
                Tool Inspection
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                工具调用查看器
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                深入检查 AI 工具调用的参数、输出、错误和执行时间。了解每个工具的调用过程。
              </p>
            </div>
            <div className="app-card-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Tools</p>
              <p className="app-accent mt-1 text-lg">{Object.keys(agentTools).length}</p>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="app-card border p-4">
            <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              <Zap className="size-4" />
              Total Calls
            </div>
            <p className="app-title text-2xl font-semibold">{mockToolCalls.length}</p>
          </div>
          <div className="app-card border p-4">
            <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              <Check className="size-4 text-emerald-400" />
              Successful
            </div>
            <p className="app-title text-2xl font-semibold text-emerald-400">
              {mockToolCalls.filter((tc) => tc.state === "output-available").length}
            </p>
          </div>
          <div className="app-card border p-4">
            <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              <AlertTriangle className="size-4 text-rose-400" />
              Failed
            </div>
            <p className="app-title text-2xl font-semibold text-rose-400">
              {mockToolCalls.filter((tc) => tc.state === "error").length}
            </p>
          </div>
          <div className="app-card border p-4">
            <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              <Clock className="size-4 text-amber-400" />
              Running
            </div>
            <p className="app-title text-2xl font-semibold text-amber-400">
              {mockToolCalls.filter((tc) => tc.state === "running").length}
            </p>
          </div>
        </section>

        {/* Tool Streaming Demo Section */}
        <section className="mt-5">
          <div className="app-panel border p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="app-title flex items-center gap-2 text-lg font-semibold">
                  <Zap className="size-5 text-emerald-400" />
                  Tool Streaming Demo
                </h2>
                <p className="app-muted mt-1 text-sm">
                  模拟工具调用过程可视化 - 展示实时工具执行状态
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="app-button-primary flex items-center gap-2 border px-4 py-2 font-mono text-xs transition"
                  onClick={runStreamingDemo}
                  disabled={isStreaming}
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Streaming...
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Run Demo
                    </>
                  )}
                </button>
                <button
                  className="app-chip border px-3 py-2 font-mono text-xs transition"
                  onClick={resetStreamingDemo}
                  disabled={isStreaming}
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>

            {/* Streaming Steps */}
            <div className="space-y-4">
              {/* Error Message */}
              {streamingError && (
                <div className="rounded border border-rose-500/30 bg-rose-500/10 p-4">
                  <div className="flex items-center gap-2 text-rose-300">
                    <AlertTriangle className="size-4" />
                    <span className="font-semibold">错误</span>
                  </div>
                  <p className="app-muted mt-2 text-sm">{streamingError}</p>
                </div>
              )}

              {/* Timeline Overview */}
              {streamingSteps.length > 0 && (
                <ToolCallTimeline
                  steps={streamingSteps}
                  totalDurationMs={totalDurationMs}
                />
              )}

              {/* Individual Tool Panels */}
              {streamingSteps.map((item) => (
                <ToolStreamPanel
                  key={item.toolCall.toolName}
                  step={item.step}
                  toolCall={item.toolCall}
                  totalSteps={streamingSteps.length}
                />
              ))}

              {/* Empty State */}
              {streamingSteps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wrench className="size-12 text-emerald-400/30" />
                  <p className="app-muted mt-4 text-sm">
                    点击 Run Demo 开始模拟工具调用过程
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Filter */}
        <section className="mt-5">
          <div className="app-panel border p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="app-subtle font-mono text-xs uppercase tracking-wider">
                Filter by Category:
              </span>
              <button
                className={`app-chip border px-3 py-1.5 font-mono text-xs transition ${
                  filterCategory === "all" ? "app-card-active" : ""
                }`}
                onClick={() => setFilterCategory("all")}
              >
                All ({mockToolCalls.length})
              </button>
              {Object.entries(toolCategories).map(([category, tools]) => {
                const count = mockToolCalls.filter((tc) =>
                  tools.some((t) => tc.toolName.includes(t))
                ).length;
                return (
                  <button
                    key={category}
                    className={`app-chip border px-3 py-1.5 font-mono text-xs transition ${
                      filterCategory === category ? "app-card-active" : ""
                    }`}
                    onClick={() => setFilterCategory(category)}
                  >
                    {categoryLabels[category]} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t pt-4">
              <span className="app-subtle font-mono text-xs uppercase tracking-wider">
                View:
              </span>
              <button
                className={`app-chip border px-3 py-1.5 font-mono text-xs transition ${
                  viewMode === "list" ? "app-card-active" : ""
                }`}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
              <button
                className={`app-chip border px-3 py-1.5 font-mono text-xs transition ${
                  viewMode === "detail" ? "app-card-active" : ""
                }`}
                onClick={() => setViewMode("detail")}
              >
                Detail
              </button>
            </div>
          </div>
        </section>

        {/* Tool Call List */}
        <section className="mt-5 space-y-3">
          {filteredToolCalls.map((toolCall) => {
            const toolInfo = getToolInfo(toolCall.toolName);
            const category = getToolCategory(toolCall.toolName);
            const isSelected = selectedToolCall === toolCall.id;

            return (
              <div
                key={toolCall.id}
                className={`app-card border transition ${
                  isSelected ? "app-card-active" : ""
                }`}
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() =>
                    setSelectedToolCall(isSelected ? null : toolCall.id)
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getStateIcon(toolCall.state)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="app-title font-semibold">
                            {toolInfo?.name || toolCall.toolName}
                          </span>
                          <span className="app-chip border px-2 py-0.5 font-mono text-[10px]">
                            {categoryLabels[category] || category}
                          </span>
                        </div>
                        <p className="app-muted mt-1 text-xs">
                          {toolInfo?.description || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono text-xs text-emerald-400">
                          {getStateLabel(toolCall.state)}
                        </div>
                        <div className="app-subtle mt-1 font-mono text-xs">
                          {formatDuration(toolCall.duration)}
                        </div>
                      </div>
                      {isSelected ? (
                        <ChevronDown className="size-5" />
                      ) : (
                        <ChevronRight className="size-5" />
                      )}
                    </div>
                  </div>
                </button>

                {isSelected && (
                  <div className="border-t p-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Arguments */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="app-subtle font-mono text-xs uppercase tracking-wider">
                            Arguments
                          </h4>
                          <button
                            className="app-accent flex items-center gap-1 font-mono text-xs"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(toolCall.args, null, 2),
                                `${toolCall.id}-args`
                              )
                            }
                          >
                            {copiedId === `${toolCall.id}-args` ? (
                              <>
                                <Check className="size-3" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="app-panel-soft max-h-48 overflow-auto border p-3 font-mono text-xs">
                          {JSON.stringify(toolCall.args, null, 2)}
                        </pre>
                      </div>

                      {/* Output */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="app-subtle font-mono text-xs uppercase tracking-wider">
                            Output
                          </h4>
                          {toolCall.output && (
                            <button
                              className="app-accent flex items-center gap-1 font-mono text-xs"
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(toolCall.output, null, 2),
                                  `${toolCall.id}-output`
                                )
                              }
                            >
                              {copiedId === `${toolCall.id}-output` ? (
                                <>
                                  <Check className="size-3" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" /> Copy
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {toolCall.error ? (
                          <pre className="border border-rose-300/30 bg-rose-300/10 p-3 font-mono text-xs text-rose-300">
                            Error: {toolCall.error}
                          </pre>
                        ) : toolCall.state === "running" ? (
                          <div className="flex items-center gap-2 border border-amber-300/30 bg-amber-300/10 p-3 font-mono text-xs text-amber-300">
                            <Loader2 className="size-4 animate-spin" />
                            Waiting for output...
                          </div>
                        ) : (
                          <pre className="app-panel-soft max-h-48 overflow-auto border p-3 font-mono text-xs">
                            {JSON.stringify(toolCall.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 flex flex-wrap gap-4 border-t pt-4">
                      <div className="app-subtle font-mono text-xs">
                        <span className="uppercase">ID:</span> {toolCall.id}
                      </div>
                      <div className="app-subtle font-mono text-xs">
                        <span className="uppercase">Tool:</span> {toolCall.toolName}
                      </div>
                      <div className="app-subtle font-mono text-xs">
                        <span className="uppercase">Duration:</span>{" "}
                        {formatDuration(toolCall.duration)}
                      </div>
                      <div className="app-subtle font-mono text-xs">
                        <span className="uppercase">Time:</span>{" "}
                        {new Date(toolCall.timestamp).toLocaleString("zh-CN")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Tool Definitions */}
        <section className="mt-8">
          <h2 className="app-title mb-4 text-xl font-semibold">Available Tools</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(toolCategories).map(([category, tools]) => (
              <div key={category} className="app-card border p-4">
                <div className="mb-3 flex items-center gap-2">
                  {categoryIcons[category]}
                  <h3 className="app-title font-semibold">
                    {categoryLabels[category]}
                  </h3>
                </div>
                <div className="space-y-3">
                  {tools.map((toolName) => {
                    const info = getToolInfo(toolName);
                    return (
                      <div
                        key={toolName}
                        className="border-b border-slate-700/50 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <FileJson className="size-4 text-emerald-400" />
                          <span className="font-mono text-sm">{toolName}</span>
                        </div>
                        {info && (
                          <p className="app-muted mt-1 text-xs">{info.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Help */}
        <section className="mt-8">
          <div className="app-panel-soft border p-6">
            <h3 className="app-title mb-3 flex items-center gap-2 font-semibold">
              <Eye className="size-5" />
              How to Use
            </h3>
            <ul className="app-muted space-y-2 text-sm">
              <li>
                <span className="app-accent font-mono">•</span> Click on a tool call to
                expand and see full details
              </li>
              <li>
                <span className="app-accent font-mono">•</span> Use the copy button to copy
                arguments or output as JSON
              </li>
              <li>
                <span className="app-accent font-mono">•</span> Filter by category to focus
                on specific tool types
              </li>
              <li>
                <span className="app-accent font-mono">•</span> Green = completed, Red =
                error, Yellow = running
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
