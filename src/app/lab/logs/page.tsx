"use client";

import { useState } from "react";
import { ArrowLeft, ScrollText } from "lucide-react";
import Link from "next/link";

interface AIRunLog {
  id: number;
  route: string;
  modelConfigId: number | null;
  provider: string | null;
  modelId: string | null;
  startTime: string;
  endTime: string | null;
  latencyMs: number | null;
  status: "success" | "error" | "streaming";
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  toolCallCount: number | null;
  attachmentCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface RunStats {
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  avgLatencyMs: number;
  totalTokens: number;
  routes: Record<string, number>;
  models: Record<string, number>;
}

export default function LogsPage() {
  const [runs, setRuns] = useState<AIRunLog[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AIRunLog | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Filters
  const [routeFilter, setRouteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [modelFilter, setModelFilter] = useState("");

  const loadRuns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (routeFilter) params.set("route", routeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (modelFilter) params.set("modelId", modelFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/logs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRuns(data.runs);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load runs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  if (!initialized) {
    loadRuns();
    setInitialized(true);
  }

  const formatLatency = (ms: number | null) => {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTokens = (tokens: number | null) => {
    if (tokens === null) return "-";
    return tokens.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-700";
      case "error":
        return "bg-red-100 text-red-700";
      case "streaming":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "成功";
      case "error":
        return "错误";
      case "streaming":
        return "进行中";
      default:
        return status;
    }
  };

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
          <div className="mb-4 flex items-center gap-4">
            <div className="app-icon-tile grid size-12 place-items-center border">
              <ScrollText className="size-6" />
            </div>
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Observability Module
              </p>
              <h1 className="app-title mt-1 text-3xl font-semibold">运行日志</h1>
            </div>
          </div>
          <p className="app-muted text-sm leading-7">
            查看 AI 请求日志、性能指标和错误信息。追踪模型响应时间、Token 使用量和工具调用情况。
          </p>
        </header>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-5">
            <div className="app-card border p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.totalRuns}</div>
              <div className="text-xs text-gray-500">总请求数</div>
            </div>
            <div className="app-card border p-4">
              <div className="text-2xl font-bold text-green-600">{stats.successRuns}</div>
              <div className="text-xs text-gray-500">成功</div>
            </div>
            <div className="app-card border p-4">
              <div className="text-2xl font-bold text-red-600">{stats.errorRuns}</div>
              <div className="text-xs text-gray-500">失败</div>
            </div>
            <div className="app-card border p-4">
              <div className="text-2xl font-bold text-blue-600">{formatLatency(stats.avgLatencyMs)}</div>
              <div className="text-xs text-gray-500">平均延迟</div>
            </div>
            <div className="app-card border p-4">
              <div className="text-2xl font-bold text-purple-600">{formatTokens(stats.totalTokens)}</div>
              <div className="text-xs text-gray-500">总 Tokens</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 items-center mb-5 p-4 app-card border">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">路由:</label>
            <select
              value={routeFilter}
              onChange={(e) => {
                setRouteFilter(e.target.value);
                setInitialized(false);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">全部</option>
              <option value="/api/chat">/api/chat</option>
              <option value="/api/structured/analyze">/api/structured/analyze</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">状态:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setInitialized(false);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">全部</option>
              <option value="success">成功</option>
              <option value="error">错误</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">模型:</label>
            <input
              type="text"
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setInitialized(false);
              }}
              placeholder="搜索模型..."
              className="px-2 py-1 border border-gray-300 rounded text-sm w-32"
            />
          </div>

          <button
            onClick={() => {
              setInitialized(false);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            刷新
          </button>
        </div>

        {/* Content */}
        <div className="app-card border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <div>暂无运行日志</div>
              <div className="text-sm mt-1">发起一次 AI 请求后即可在此查看</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 font-medium">时间</th>
                    <th className="px-4 py-3 font-medium">路由</th>
                    <th className="px-4 py-3 font-medium">模型</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">延迟</th>
                    <th className="px-4 py-3 font-medium">Tokens</th>
                    <th className="px-4 py-3 font-medium">工具调用</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedRun(run)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(run.createdAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {run.route}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{run.modelId || "-"}</div>
                        {run.provider && (
                          <div className="text-xs text-gray-400">{run.provider}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            run.status
                          )}`}
                        >
                          {getStatusLabel(run.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatLatency(run.latencyMs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatTokens(run.totalTokens)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {run.toolCallCount ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRun(run);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">运行详情</h2>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 overflow-auto max-h-[60vh]">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs text-gray-500 mb-1">运行 ID</div>
                  <div className="text-sm font-mono">{selectedRun.id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">状态</div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      selectedRun.status
                    )}`}
                  >
                    {getStatusLabel(selectedRun.status)}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">开始时间</div>
                  <div className="text-sm">{new Date(selectedRun.startTime).toLocaleString("zh-CN")}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">结束时间</div>
                  <div className="text-sm">
                    {selectedRun.endTime
                      ? new Date(selectedRun.endTime).toLocaleString("zh-CN")
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">延迟</div>
                  <div className="text-sm">{formatLatency(selectedRun.latencyMs)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">工具调用</div>
                  <div className="text-sm">{selectedRun.toolCallCount ?? "-"}</div>
                </div>
              </div>

              {/* Token Usage */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Token 使用量</h3>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <div className="text-xs text-gray-500">输入 Tokens</div>
                    <div className="text-lg font-medium">
                      {formatTokens(selectedRun.promptTokens)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">输出 Tokens</div>
                    <div className="text-lg font-medium">
                      {formatTokens(selectedRun.completionTokens)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">总 Tokens</div>
                    <div className="text-lg font-medium">
                      {formatTokens(selectedRun.totalTokens)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">模型信息</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">路由:</span>
                    <span className="font-mono">{selectedRun.route}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">模型:</span>
                    <span>{selectedRun.modelId || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider:</span>
                    <span>{selectedRun.provider || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Config ID:</span>
                    <span>{selectedRun.modelConfigId || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedRun.errorMessage && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-red-900 mb-3">错误信息</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">
                      {selectedRun.errorMessage}
                    </pre>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedRun.metadata && Object.keys(selectedRun.metadata).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">元数据</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedRun.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
