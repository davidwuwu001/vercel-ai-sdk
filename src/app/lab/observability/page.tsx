"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock,
  FileText,
  GitBranch,
  Logs,
  RefreshCw,
  Server,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface MetricData {
  counters: Array<{ name: string; value: number; labels: Record<string, string> }>;
  gauges: Array<{ name: string; value: number; labels: Record<string, string> }>;
  histograms: Array<{
    name: string;
    buckets: Array<{ le: number; count: number }>;
    sum: number;
    count: number;
    labels: Record<string, string>;
  }>;
  timestamp: string;
}

interface TraceData {
  id: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  spans?: SpanData[];
}

interface SpanData {
  id: string;
  name: string;
  service: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: string;
  errorMessage?: string;
}

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "metrics" | "traces">("overview");
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [traceSpans, setTraceSpans] = useState<SpanData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 加载指标数据
  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // 从 API 获取统计数据
      const response = await fetch("/api/logs?limit=1");
      const data = await response.json();

      if (data.stats) {
        setMetrics({
          counters: [
            { name: "api_requests_total", value: data.stats.totalRuns || 0, labels: {} },
            { name: "success_runs", value: data.stats.successRuns || 0, labels: { status: "success" } },
            { name: "error_runs", value: data.stats.errorRuns || 0, labels: { status: "error" } },
          ],
          gauges: [
            { name: "avg_latency_ms", value: data.stats.avgLatencyMs || 0, labels: {} },
          ],
          histograms: [],
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Failed to load metrics:", error);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, []);

  // 加载追踪数据
  const loadTraces = useCallback(async () => {
    try {
      // 模拟追踪数据
      const mockTraces: TraceData[] = [
        {
          id: "trace-001",
          startTime: new Date(Date.now() - 300000).toISOString(),
          endTime: new Date(Date.now() - 299500).toISOString(),
          durationMs: 500,
        },
        {
          id: "trace-002",
          startTime: new Date(Date.now() - 180000).toISOString(),
          endTime: new Date(Date.now() - 179200).toISOString(),
          durationMs: 800,
        },
        {
          id: "trace-003",
          startTime: new Date(Date.now() - 60000).toISOString(),
          endTime: new Date(Date.now() - 59500).toISOString(),
          durationMs: 500,
        },
      ];
      setTraces(mockTraces);
    } catch (error) {
      console.error("Failed to load traces:", error);
    }
  }, []);

  // 加载追踪详情
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadTraceSpans = useCallback(async (_traceId: string) => {
    // 模拟 span 数据
    // 注意: 实际应该使用 _traceId 从 API 获取真实数据
    const mockSpans: SpanData[] = [
      {
        id: "span-001",
        name: "HTTP Handler",
        service: "api",
        startTime: new Date(Date.now() - 300000).toISOString(),
        endTime: new Date(Date.now() - 299500).toISOString(),
        durationMs: 500,
        status: "ok",
      },
      {
        id: "span-002",
        name: "AI Model Call",
        service: "openai",
        startTime: new Date(Date.now() - 299800).toISOString(),
        endTime: new Date(Date.now() - 299600).toISOString(),
        durationMs: 200,
        status: "ok",
      },
      {
        id: "span-003",
        name: "Database Query",
        service: "sqlite",
        startTime: new Date(Date.now() - 299700).toISOString(),
        endTime: new Date(Date.now() - 299680).toISOString(),
        durationMs: 20,
        status: "ok",
      },
    ];
    setTraceSpans(mockSpans);
  }, []);

  // 初始加载 - 使用 IIFE 直接内联逻辑避免 effect 依赖问题
  useEffect(() => {
    // 使用 async IIFE 直接处理初始加载
    (async () => {
      setLoading(true);
      try {
        // 从 API 获取统计数据
        const response = await fetch("/api/logs?limit=1");
        const data = await response.json();

        if (data.stats) {
          setMetrics({
            counters: [
              { name: "api_requests_total", value: data.stats.totalRuns || 0, labels: {} },
              { name: "success_runs", value: data.stats.successRuns || 0, labels: { status: "success" } },
              { name: "error_runs", value: data.stats.errorRuns || 0, labels: { status: "error" } },
            ],
            gauges: [
              { name: "avg_latency_ms", value: data.stats.avgLatencyMs || 0, labels: {} },
            ],
            histograms: [],
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Failed to load metrics:", error);
      } finally {
        setLoading(false);
        setLastUpdate(new Date());
      }

      // 加载追踪数据
      try {
        const mockTraces: TraceData[] = [
          {
            id: "trace-001",
            startTime: new Date(Date.now() - 300000).toISOString(),
            endTime: new Date(Date.now() - 299500).toISOString(),
            durationMs: 500,
          },
          {
            id: "trace-002",
            startTime: new Date(Date.now() - 180000).toISOString(),
            endTime: new Date(Date.now() - 179200).toISOString(),
            durationMs: 800,
          },
          {
            id: "trace-003",
            startTime: new Date(Date.now() - 60000).toISOString(),
            endTime: new Date(Date.now() - 59500).toISOString(),
            durationMs: 500,
          },
        ];
        setTraces(mockTraces);
      } catch (error) {
        console.error("Failed to load traces:", error);
      }
    })();
  }, []);

  // 刷新处理
  const handleRefresh = () => {
    void loadMetrics();
    void loadTraces();
  };

  // 选择追踪
  const handleSelectTrace = (trace: TraceData) => {
    setSelectedTrace(trace);
    void loadTraceSpans(trace.id);
  };

  // 格式化延迟
  const formatLatency = (ms: number | undefined) => {
    if (ms === undefined) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // 格式化时间
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const tabs = [
    { id: "overview", label: "总览", icon: Activity },
    { id: "metrics", label: "指标", icon: BarChart3 },
    { id: "traces", label: "追踪", icon: GitBranch },
  ] as const;

  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
          href="/lab"
        >
          <ArrowLeft className="size-4" />
          Back to Lab
        </Link>

        {/* Header */}
        <header className="app-panel border p-5 md:p-7 mb-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="app-icon-tile grid size-12 place-items-center border">
                <Activity className="size-6" />
              </div>
              <div>
                <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                  Observability Module
                </p>
                <h1 className="app-title mt-1 text-3xl font-semibold">可观测性</h1>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="app-button flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
          <p className="app-muted text-sm leading-7">
            统一的日志、指标和追踪监控系统。实时查看应用运行状态、性能指标和调用链路。
          </p>
          <div className="mt-3 text-xs text-gray-500">
            最后更新: {lastUpdate.toLocaleTimeString("zh-CN")}
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider transition ${
                activeTab === tab.id
                  ? "app-accent border-b-2 border-cyan-400 text-cyan-400"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* 关键指标卡片 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="总请求数"
                value={metrics?.counters.find((c) => c.name === "api_requests_total")?.value || 0}
                icon={<Server className="size-5" />}
                color="blue"
              />
              <MetricCard
                title="成功率"
                value={
                  metrics?.counters.find((c) => c.name === "api_requests_total")?.value
                    ? (
                        ((metrics?.counters.find((c) => c.name === "success_runs")?.value || 0) /
                          (metrics?.counters.find((c) => c.name === "api_requests_total")?.value || 1)) *
                        100
                      ).toFixed(1) + "%"
                    : "-"
                }
                icon={<TrendingUp className="size-5" />}
                color="green"
              />
              <MetricCard
                title="错误数"
                value={metrics?.counters.find((c) => c.name === "error_runs")?.value || 0}
                icon={<AlertCircle className="size-5" />}
                color="red"
              />
              <MetricCard
                title="平均延迟"
                value={formatLatency(metrics?.gauges.find((g) => g.name === "avg_latency_ms")?.value)}
                icon={<Timer className="size-5" />}
                color="purple"
              />
            </div>

            {/* 功能卡片 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                title="结构化日志"
                description="统一的日志格式，支持级别过滤和上下文追踪"
                icon={<Logs className="size-6" />}
                href="/lab/logs"
              />
              <FeatureCard
                title="性能指标"
                description="计数器、仪表盘和直方图，追踪关键业务指标"
                icon={<BarChart3 className="size-6" />}
                onClick={() => setActiveTab("metrics")}
              />
              <FeatureCard
                title="调用追踪"
                description="分布式追踪，查看请求在各服务间的流转"
                icon={<GitBranch className="size-6" />}
                onClick={() => setActiveTab("traces")}
              />
            </div>

            {/* 最近的追踪 */}
            <section className="app-card border p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="app-title flex items-center gap-2 text-lg font-semibold">
                  <Clock className="size-5" />
                  最近追踪
                </h2>
                <button
                  onClick={() => setActiveTab("traces")}
                  className="app-accent text-sm hover:underline"
                >
                  查看全部
                </button>
              </div>
              <div className="space-y-2">
                {traces.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <GitBranch className="size-12 mx-auto mb-3 opacity-30" />
                    <p>暂无追踪记录</p>
                  </div>
                ) : (
                  traces.slice(0, 5).map((trace) => (
                    <div
                      key={trace.id}
                      className="flex items-center justify-between rounded border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectTrace(trace)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="app-chip border px-2 py-1 font-mono text-xs">
                          {trace.id.slice(0, 8)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatTime(trace.startTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          {trace.spans?.length || 3} spans
                        </span>
                        <span className="font-mono text-sm text-gray-700">
                          {formatLatency(trace.durationMs)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === "metrics" && (
          <div className="space-y-5">
            {/* 计数器 */}
            <section className="app-card border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <Zap className="size-5 text-yellow-500" />
                计数器 (Counters)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics?.counters.map((counter) => (
                  <div key={counter.name} className="rounded border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 mb-1">{counter.name}</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {counter.value.toLocaleString()}
                    </div>
                    {Object.keys(counter.labels).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(counter.labels).map(([k, v]) => (
                          <span
                            key={k}
                            className="app-chip border px-2 py-0.5 font-mono text-[10px]"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 仪表盘 */}
            <section className="app-card border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <Activity className="size-5 text-blue-500" />
                仪表盘 (Gauges)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {metrics?.gauges.map((gauge) => (
                  <div key={gauge.name} className="rounded border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 mb-1">{gauge.name}</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {gauge.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 直方图 */}
            <section className="app-card border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="size-5 text-purple-500" />
                直方图 (Histograms)
              </h2>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="size-12 mx-auto mb-3 opacity-30" />
                <p>暂无直方图数据</p>
                <p className="text-sm mt-1">执行 API 请求后自动收集</p>
              </div>
            </section>
          </div>
        )}

        {/* Traces Tab */}
        {activeTab === "traces" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
            {/* 追踪列表 */}
            <section className="app-card border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <GitBranch className="size-5" />
                追踪列表
              </h2>
              <div className="space-y-2">
                {traces.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <GitBranch className="size-12 mx-auto mb-3 opacity-30" />
                    <p>暂无追踪记录</p>
                    <p className="text-sm mt-1">执行 API 请求后自动生成追踪</p>
                  </div>
                ) : (
                  traces.map((trace) => (
                    <div
                      key={trace.id}
                      onClick={() => handleSelectTrace(trace)}
                      className={`cursor-pointer rounded border p-4 transition ${
                        selectedTrace?.id === trace.id
                          ? "border-cyan-400 bg-cyan-50"
                          : "border-gray-200 hover:border-cyan-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="app-chip border px-2 py-1 font-mono text-xs">
                          {trace.id}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatTime(trace.startTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <FileText className="size-4" />
                          {trace.spans?.length || 3} spans
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="size-4" />
                          {formatLatency(trace.durationMs)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 追踪详情 */}
            <section className="app-card border p-5">
              <h2 className="app-title mb-4 flex items-center gap-2 text-lg font-semibold">
                <Activity className="size-5" />
                追踪详情
              </h2>
              {!selectedTrace ? (
                <div className="text-center py-12 text-gray-500">
                  <GitBranch className="size-12 mx-auto mb-3 opacity-30" />
                  <p>选择一个追踪查看详情</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 mb-2">Trace ID</div>
                    <div className="font-mono text-sm">{selectedTrace.id}</div>
                  </div>

                  <div className="rounded border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 mb-2">时间</div>
                    <div className="text-sm">
                      {new Date(selectedTrace.startTime).toLocaleString("zh-CN")}
                    </div>
                  </div>

                  <div className="rounded border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 mb-2">总耗时</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatLatency(selectedTrace.durationMs)}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Spans</h3>
                    <div className="space-y-2">
                      {traceSpans.map((span, index) => (
                        <div
                          key={span.id}
                          className="rounded border border-gray-200 p-3"
                          style={{ marginLeft: `${index * 20}px` }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{span.name}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                span.status === "ok"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {span.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{span.service}</span>
                            <span>{formatLatency(span.durationMs)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    purple: "text-purple-600 bg-purple-50",
  };

  return (
    <div className="app-card border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{title}</span>
        <div className={`rounded-full p-2 ${colorClasses[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  href,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="mb-3 flex items-center gap-3">
        <div className="app-icon-tile border">{icon}</div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="app-card border p-5 block hover:bg-gray-50 transition">
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="app-card border p-5 text-left hover:bg-gray-50 transition w-full"
    >
      {content}
    </button>
  );
}
