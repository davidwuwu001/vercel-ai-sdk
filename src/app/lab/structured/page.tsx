"use client";

import {
  AlertCircle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Eye,
  FileText,
  Image,
  Loader2,
  ScrollText,
  Sparkles,
  View,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownMessage } from "@/components/markdown-message";
import {
  StreamingObjectViewer,
  FieldProgressList,
} from "@/components/streaming-object-view";
import {
  TASK_TYPE_METADATA,
  type StructuredResponse,
  type StructuredTaskType,
} from "@/lib/ai/structured";
import type { StreamingObjectState } from "@/lib/ai/object-stream";

type ViewMode = "json" | "card" | "markdown";
type OutputMode = "standard" | "streaming";

const TASK_EXAMPLES = {
  "teacher-profile-audit": `教师姓名：张老师
工号：EMP-2024-0892
科目：初中数学
年级：八年级
教龄：5年
学历：本科（数学与应用数学，北京师范大学）
证书：教师资格证（初中数学，有效期至2028年）
证书：奥数教练证（有效期至2025年6月）
教学资质：已认证
工作表现：良好，近两年学生满意度 92%`,

  "service-case-rewrite": `学生姓名：李明
科目：初三物理
原始案例内容：
张老师今天给小明上了物理课，教了他电路的东西。小明之前电路这块不太懂，今天学了欧姆定律，感觉还行。作业做了一些，错了两道题。老师说下节课继续讲。

案例类型：progress
目标受众：家长
语气：友好专业`,

  "media-analysis-summary": `文件信息：
文件名：学生作品集_2024秋季.pdf
文件类型：PDF
文件大小：2.3MB
页数：12页

内容描述：
一份学生作品集，收录了2024年秋季学期学生的艺术创作作品，包括素描、水彩和数码绘画。作品主题涉及自然风景、人物肖像和抽象艺术。`,

};

const TASK_OPTIONS = Object.entries(TASK_TYPE_METADATA).map(([key, value]) => ({
  value: key as StructuredTaskType,
  label: value.name,
  description: value.description,
}));

export default function StructuredPage() {
  const [selectedTask, setSelectedTask] = useState<StructuredTaskType>("teacher-profile-audit");
  const [input, setInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [outputMode, setOutputMode] = useState<OutputMode>("standard");
  const [result, setResult] = useState<StructuredResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 流式状态
  const [streamingState, setStreamingState] = useState<StreamingObjectState | null>(null);
  const [streamingTime, setStreamingTime] = useState<{ start: number; end?: number } | null>(null);
  const [liveDuration, setLiveDuration] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 实时更新持续时间
  useEffect(() => {
    if (!streamingTime || streamingTime.end) return;
    const interval = setInterval(() => {
      setLiveDuration(Date.now() - streamingTime.start);
    }, 100);
    return () => clearInterval(interval);
  }, [streamingTime]);

  // 清理 EventSource
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleStandardSubmit = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStreamingState(null);

    try {
      const response = await fetch("/api/structured/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: selectedTask,
          input: input.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "分析失败，请重试");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  }, [input, selectedTask]);

  const handleStreamingSubmit = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStreamingState({
      partial: {},
      isComplete: false,
      fieldUpdates: [],
      activeField: null,
      startedAt: Date.now(),
    });
    setStreamingTime({ start: Date.now() });

    // 关闭之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams({
      taskType: selectedTask,
      input: input.trim(),
    });

    const eventSource = new EventSource(`/api/structured/stream?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("start", () => {
      // Streaming started
    });

    eventSource.addEventListener("partial", (e) => {
      const data = JSON.parse(e.data);
      setStreamingState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          partial: data.partial,
          fieldUpdates: [
            ...prev.fieldUpdates,
            ...data.updates.map((u: { path: string; value: unknown; type: "add" | "update" }) => ({
              ...u,
              timestamp: data.timestamp,
            })),
          ],
          activeField: data.updates.length > 0 ? data.updates[data.updates.length - 1].path : prev.activeField,
        };
      });
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setStreamingState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          partial: data.result,
          isComplete: true,
          activeField: null,
          completedAt: data.completedAt,
        };
      });
      setStreamingTime((prev) => prev ? { ...prev, end: data.completedAt } : null);
      setLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener("error", (e) => {
      const errorData = JSON.parse((e as MessageEvent).data);
      setError(errorData.error || "流式传输失败");
      setLoading(false);
      setStreamingState((prev) => prev ? { ...prev, isComplete: true } : null);
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (!streamingTime?.end) {
        setError("连接中断，请重试");
        setLoading(false);
        setStreamingState((prev) => prev ? { ...prev, isComplete: true } : null);
        eventSource.close();
      }
    };
  }, [input, selectedTask, streamingTime]);

  const handleSubmit = useCallback(async () => {
    if (outputMode === "streaming") {
      await handleStreamingSubmit();
    } else {
      await handleStandardSubmit();
    }
  }, [outputMode, handleStandardSubmit, handleStreamingSubmit]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
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
                AI SDK Structured Output
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                结构化输出实验
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                使用 AI SDK 的结构化输出功能，根据预定义的 Zod Schema 生成类型安全的 JSON
                结果。支持三种任务类型：教师档案审计、服务案例改写和媒体内容分析。
                {outputMode === "streaming" && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-400">
                    <Sparkles className="size-3" />
                    流式模式已启用
                  </span>
                )}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* 左侧：输入区域 */}
          <section className="space-y-4">
            <div className="app-panel border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <Braces className="app-accent size-5" />
                选择任务类型
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {TASK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`app-card border p-4 text-left transition ${
                      selectedTask === option.value
                        ? "app-card-active"
                        : ""
                    }`}
                    onClick={() => setSelectedTask(option.value)}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <TaskIcon type={option.value} className="size-4" />
                      <span className="font-semibold">{option.label}</span>
                    </div>
                    <p className="app-muted text-xs">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="app-panel border p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="app-title flex items-center gap-2 text-lg font-semibold">
                  <FileText className="app-accent size-5" />
                  输入内容
                </h2>
                <button
                  className="app-accent flex items-center gap-1 text-xs font-mono uppercase tracking-wider"
                  onClick={() => setInput(TASK_EXAMPLES[selectedTask])}
                >
                  <Clipboard className="size-3" />
                  加载示例
                </button>
              </div>
              <textarea
                className="app-input min-h-64 w-full resize-y border p-4 text-sm outline-none"
                placeholder={`输入 ${TASK_TYPE_METADATA[selectedTask].name} 的相关信息...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="app-subtle text-xs">
                    {input.length} 字符
                  </span>
                  {/* 流式模式切换 */}
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="app-subtle text-xs">流式输出</span>
                    <div
                      className={`relative h-5 w-9 rounded-full transition ${
                        outputMode === "streaming"
                          ? "bg-emerald-400/30"
                          : "bg-cyan-400/20"
                      }`}
                      onClick={() =>
                        setOutputMode((prev) =>
                          prev === "standard" ? "streaming" : "standard"
                        )
                      }
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full transition ${
                          outputMode === "streaming"
                            ? "left-[18px] bg-emerald-400"
                            : "left-0.5 bg-cyan-400/60"
                        }`}
                      />
                    </div>
                    <Zap
                      className={`size-3 ${
                        outputMode === "streaming"
                          ? "text-emerald-400"
                          : "app-subtle"
                      }`}
                    />
                  </label>
                </div>
                <button
                  className="app-button-hot flex items-center gap-2 border px-4 py-2 font-mono text-xs disabled:opacity-40"
                  disabled={!input.trim() || loading}
                  onClick={() => void handleSubmit()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {outputMode === "streaming" ? "流式生成中..." : "分析中..."}
                    </>
                  ) : (
                    <>
                      <View className="size-4" />
                      {outputMode === "streaming" ? "开始流式生成" : "开始分析"}
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="border border-rose-300/40 bg-rose-950/60 p-4">
                <div className="flex items-center gap-2 text-rose-200">
                  <AlertCircle className="size-5" />
                  <span className="font-semibold">错误</span>
                </div>
                <p className="app-muted mt-2 text-sm">{error}</p>
              </div>
            )}
          </section>

          {/* 右侧：输出区域 */}
          <section className="space-y-4">
            <div className="app-panel border p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="app-title flex items-center gap-2 text-lg font-semibold">
                  <Eye className="app-accent size-5" />
                  输出结果
                  {outputMode === "streaming" && streamingState && !streamingState.isComplete && (
                    <span className="ml-2 flex items-center gap-1 text-xs text-emerald-400">
                      <Sparkles className="size-3 animate-pulse" />
                      实时生成中
                    </span>
                  )}
                </h2>
                <div className="flex gap-1 border p-1">
                  {[
                    { mode: "card" as ViewMode, label: "卡片" },
                    { mode: "json" as ViewMode, label: "JSON" },
                    { mode: "markdown" as ViewMode, label: "Markdown" },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      className={`px-3 py-1 font-mono text-xs transition ${
                        viewMode === mode
                          ? "app-button-hot"
                          : "app-muted hover:text-foreground"
                      }`}
                      onClick={() => setViewMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 流式输出区域 */}
              {outputMode === "streaming" && (
                <div className="mb-4 space-y-4">
                  {/* 字段进度 */}
                  {streamingState && (
                    <div className="rounded border border-emerald-400/20 bg-emerald-400/5 p-3">
                      <FieldProgressList
                        updates={streamingState.fieldUpdates}
                        activeField={streamingState.activeField}
                        totalFields={8}
                      />
                    </div>
                  )}

                  {/* 流式对象查看器 */}
                  {streamingState && (
                    <StreamingObjectViewer
                      state={streamingState}
                      showTimestamps
                    />
                  )}

                  {/* 生成时间 */}
                  {streamingTime && (
                    <div className="flex items-center justify-between border border-cyan-400/20 bg-cyan-400/5 p-2 font-mono text-xs">
                      <span className="app-muted">生成耗时</span>
                      <span className="app-accent">
                        {streamingTime.end
                          ? streamingTime.end - streamingTime.start
                          : liveDuration}ms
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 标准输出区域 */}
              {outputMode === "standard" && !result && (
                <div className="flex min-h-64 flex-col items-center justify-center rounded border border-dashed border-cyan-400/20 py-12">
                  <Braces className="app-subtle mb-3 size-10" />
                  <p className="app-muted text-sm">
                    提交后将在这里显示结构化结果
                  </p>
                </div>
              )}

              {/* 结果显示 */}
              {outputMode === "standard" && result && (
                <div className="space-y-4">
                  {result.tokens && (
                    <div className="app-panel-soft flex items-center gap-4 border p-3 font-mono text-xs">
                      <span className="app-accent">
                        Prompt: {result.tokens.prompt} tokens
                      </span>
                      <span className="app-hot">
                        Completion: {result.tokens.completion} tokens
                      </span>
                      <span className="app-muted">
                        Total: {result.tokens.total} tokens
                      </span>
                    </div>
                  )}

                  {viewMode === "card" && (
                    <StructuredCardView result={result} />
                  )}
                  {viewMode === "json" && (
                    <div className="relative">
                      <button
                        className="app-accent absolute right-2 top-2 flex items-center gap-1 text-xs"
                        onClick={() =>
                          void copyToClipboard(
                            JSON.stringify(result.result, null, 2)
                          )
                        }
                      >
                        <Copy className="size-3" />
                        复制
                      </button>
                      <pre className="max-h-96 overflow-auto border bg-black/40 p-4 text-xs leading-5">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </div>
                  )}
                  {viewMode === "markdown" && (
                    <div className="border p-4">
                      <MarkdownMessage content={result.markdown} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TaskIcon({
  type,
  className,
}: {
  type: StructuredTaskType;
  className?: string;
}) {
  switch (type) {
    case "teacher-profile-audit":
      return <ScrollText className={className} />;
    case "service-case-rewrite":
      return <FileText className={className} />;
    case "media-analysis-summary":
      return <Image className={className} />;
  }
}

function StructuredCardView({ result }: { result: StructuredResponse }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderValue = (value: unknown, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="app-muted">null</span>;
    }

    if (typeof value === "boolean") {
      return value ? (
        <span className="text-emerald-400">true</span>
      ) : (
        <span className="text-rose-400">false</span>
      );
    }

    if (typeof value === "number") {
      return <span className="text-cyan-400">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-amber-300">&ldquo;{value}&rdquo;</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="app-muted">[]</span>;
      }
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="flex gap-2">
              <span className="app-subtle">{index}:</span>
              <span>{renderValue(item, depth + 1)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="app-muted">{"{}"}</span>;
      }
      return (
        <div className="space-y-1">
          {entries.map(([key, val]) => (
            <div key={key}>
              <button
                className="flex items-center gap-1 text-left hover:opacity-80"
                onClick={() => toggleExpand(key)}
              >
                {expanded[key] ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span className="app-accent font-mono">{key}:</span>
              </button>
              {expanded[key] && (
                <div className="ml-5 border-l border-cyan-400/20 pl-2">
                  {renderValue(val, depth + 1)}
                </div>
              )}
              {!expanded[key] && (
                <span className="ml-1 app-muted">
                  {typeof val === "object" && val !== null
                    ? Array.isArray(val)
                      ? `[${(val as unknown[]).length} items]`
                      : `{${Object.keys(val).length} keys}`
                    : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };

  return (
    <div className="border bg-black/40">
      <div className="border-b border-cyan-400/20 bg-cyan-400/5 p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-emerald-400 size-4" />
          <span className="font-mono text-sm text-emerald-400">
            {TASK_TYPE_METADATA[result.taskType].name}
          </span>
          <span className="app-chip ml-auto border px-2 py-0.5 font-mono text-[10px]">
            success
          </span>
        </div>
      </div>
      <div className="max-h-96 overflow-auto p-4 font-mono text-xs">
        {renderValue(result.result)}
      </div>
    </div>
  );
}
