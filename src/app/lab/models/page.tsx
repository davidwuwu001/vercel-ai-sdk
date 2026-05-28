"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Copy,
  Globe,
  Loader2,
  MessageSquare,
  Play,
  Send,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";

type ModelConfig = {
  id: number;
  name: string;
  provider: string;
  strategy: "direct" | "gateway";
  baseUrl: string;
  modelId: string;
  apiKeyEnv: string;
  hasApiKey: boolean;
  gatewaySlug: string;
  hasGatewayConfig: boolean;
  supportsVision: boolean;
  supportsFiles: boolean;
  isDefault: boolean;
  enabled: boolean;
};

type CompareResult = {
  modelId: string;
  modelName: string;
  provider: string;
  success: boolean;
  error?: string;
  output?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  };
  latencyMs: number;
  outputLength: number;
  completedAt: string;
};

type CompareResponse = {
  success: boolean;
  results: CompareResult[];
  rankings: {
    byLatency: CompareResult[];
    byLength: CompareResult[];
    byTokens: CompareResult[];
  };
  summary: {
    totalModels: number;
    successCount: number;
    failedCount: number;
    totalLatencyMs: number;
  };
};

export default function ModelsComparePage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);
  const [prompt, setPrompt] = useState(
    "请简要介绍一下你自己，包括你的能力、特点和局限性。"
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载模型列表
  const loadModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models");
      const data = await response.json();
      const enabledModels = (data.models || []).filter(
        (m: ModelConfig) => m.enabled
      );
      setModels(enabledModels);
      // 默认选择前两个模型
      if (enabledModels.length >= 2) {
        setSelectedModelIds([enabledModels[0].id, enabledModels[1].id]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useState(() => {
    void loadModels();
  });

  // 切换模型选择
  const toggleModel = (modelId: number) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : prev.length < 5
          ? [...prev, modelId]
          : prev
    );
  };

  // 运行对比
  const runComparison = async () => {
    if (selectedModelIds.length < 2 || !prompt.trim()) return;

    setIsComparing(true);
    setResults(null);

    try {
      const response = await fetch("/api/models/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelConfigIds: selectedModelIds,
          prompt: prompt.trim(),
          system: systemPrompt.trim() || undefined,
          temperature,
          maxOutputTokens: maxTokens,
        }),
      });

      if (response.ok) {
        const data: CompareResponse = await response.json();
        setResults(data);
      }
    } catch {
      // 静默处理
    } finally {
      setIsComparing(false);
    }
  };

  // 复制输出
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  // 格式化延迟
  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 格式化 token
  const formatTokens = (tokens?: number) => {
    if (!tokens) return "N/A";
    if (tokens < 1000) return `${tokens}`;
    return `${(tokens / 1000).toFixed(1)}k`;
  };

  if (loading) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="app-accent size-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="cyber-grid" />
      <div className="scanline" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 md:px-6">
        <header className="mb-5">
          <Link
            className="app-accent mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
          <h1 className="app-title text-2xl font-semibold md:text-3xl">
            Model Comparison
          </h1>
          <p className="app-muted mt-2 text-sm">
            选择 2-5 个模型，发送相同提示词，对比输出结果
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* 左侧：模型选择和设置 */}
          <aside className="space-y-4">
            {/* 模型选择 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <Bot className="size-4" />
                Select Models ({selectedModelIds.length}/5)
              </h2>
              <div className="space-y-2">
                {models.map((model) => (
                  <label
                    key={model.id}
                    className={`flex cursor-pointer items-center gap-3 rounded border p-3 transition ${
                      selectedModelIds.includes(model.id)
                        ? "app-card-active border-cyan-500/50"
                        : "app-card border-transparent hover:border-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModelIds.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                      className="size-4 accent-cyan-400"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{model.name}</p>
                      <p className="app-subtle truncate font-mono text-xs">
                        {model.modelId}
                      </p>
                    </div>
                    {model.strategy === "gateway" && (
                      <Globe className="size-4 text-cyan-400" />
                    )}
                  </label>
                ))}
              </div>
              {models.length < 2 && (
                <p className="mt-3 text-xs text-amber-400">
                  请先在模型管理页面配置至少 2 个模型
                </p>
              )}
            </section>

            {/* 设置 */}
            <section className="app-panel border p-4">
              <button
                className="mb-4 flex w-full items-center justify-between"
                onClick={() => setShowSettings(!showSettings)}
              >
                <h2 className="app-accent flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                  <Settings className="size-4" />
                  Settings
                </h2>
                {showSettings ? (
                  <X className="size-4" />
                ) : (
                  <Settings className="size-4" />
                )}
              </button>

              {showSettings && (
                <div className="space-y-4">
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Temperature: {temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Max Tokens: {maxTokens}
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="8000"
                      step="100"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* 运行按钮 */}
            <button
              className="app-button-hot flex w-full items-center justify-center gap-2"
              disabled={
                isComparing ||
                selectedModelIds.length < 2 ||
                !prompt.trim()
              }
              onClick={() => void runComparison()}
            >
              {isComparing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Run Comparison
                </>
              )}
            </button>
          </aside>

          {/* 右侧：输入和结果 */}
          <main className="space-y-4">
            {/* 提示词输入 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <MessageSquare className="size-4" />
                Prompt
              </h2>
              <textarea
                className="field-input min-h-32 w-full resize-y font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
              />
              {systemPrompt !== undefined && (
                <div className="mt-3">
                  <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                    System Prompt (optional)
                  </label>
                  <textarea
                    className="field-input min-h-20 w-full resize-y font-mono text-sm"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Optional system instructions..."
                  />
                </div>
              )}
            </section>

            {/* 结果 */}
            {results && (
              <section className="space-y-4">
                {/* 摘要 */}
                <div className="app-panel border p-4">
                  <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                    <TrendingUp className="size-4" />
                    Summary
                  </h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard
                      label="Models"
                      value={String(results.summary.totalModels)}
                    />
                    <StatCard
                      label="Success"
                      value={String(results.summary.successCount)}
                      highlight="green"
                    />
                    <StatCard
                      label="Failed"
                      value={String(results.summary.failedCount)}
                      highlight={results.summary.failedCount > 0 ? "red" : undefined}
                    />
                    <StatCard
                      label="Total Time"
                      value={formatLatency(results.summary.totalLatencyMs)}
                    />
                  </div>
                </div>

                {/* 排名 */}
                <div className="grid gap-4 md:grid-cols-3">
                  <RankingCard
                    title="Fastest"
                    icon={<Clock className="size-4" />}
                    results={results.rankings.byLatency}
                    formatLatency={formatLatency}
                    formatTokens={formatTokens}
                    copyToClipboard={copyToClipboard}
                  />
                  <RankingCard
                    title="Longest Output"
                    icon={<MessageSquare className="size-4" />}
                    results={results.rankings.byLength}
                    formatLatency={formatLatency}
                    formatTokens={formatTokens}
                    copyToClipboard={copyToClipboard}
                  />
                  <RankingCard
                    title="Most Tokens"
                    icon={<TrendingUp className="size-4" />}
                    results={results.rankings.byTokens}
                    formatLatency={formatLatency}
                    formatTokens={formatTokens}
                    copyToClipboard={copyToClipboard}
                  />
                </div>

                {/* 详细结果 */}
                <div className="space-y-3">
                  {results.results.map((result, index) => (
                    <div
                      key={index}
                      className={`app-panel border p-4 ${
                        result.success ? "" : "border-rose-500/30"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="app-chip border px-2 py-1 font-mono text-xs">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{result.modelName}</p>
                            <p className="app-subtle font-mono text-xs">
                              {result.modelId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {result.success ? (
                            <>
                              <span className="flex items-center gap-1 font-mono text-xs">
                                <Clock className="size-3" />
                                {formatLatency(result.latencyMs)}
                              </span>
                              <span className="flex items-center gap-1 font-mono text-xs">
                                <TrendingUp className="size-3" />
                                {formatTokens(result.usage?.totalTokens)}
                              </span>
                              <button
                                className="app-chip border px-2 py-1"
                                onClick={() =>
                                  result.output && copyToClipboard(result.output)
                                }
                              >
                                <Copy className="size-3" />
                              </button>
                            </>
                          ) : (
                            <span className="text-rose-400">
                              <X className="size-4" />
                            </span>
                          )}
                        </div>
                      </div>
                      {result.success ? (
                        <div className="rounded border border-white/5 bg-black/20 p-3">
                          <pre className="whitespace-pre-wrap text-sm">
                            {result.output}
                          </pre>
                        </div>
                      ) : (
                        <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red";
}) {
  const highlightClass = highlight === "green" ? "text-emerald-400" : highlight === "red" ? "text-rose-400" : "";
  return (
    <div className="app-chip border px-3 py-2 text-center">
      <p className="app-subtle text-[10px] uppercase tracking-wider">{label}</p>
      <p className={`mt-1 font-mono text-lg ${highlightClass}`}>{value}</p>
    </div>
  );
}

function RankingCard({
  title,
  icon,
  results,
  formatLatency,
  formatTokens,
  copyToClipboard,
}: {
  title: string;
  icon: React.ReactNode;
  results: CompareResult[];
  formatLatency: (ms: number) => string;
  formatTokens: (tokens?: number) => string;
  copyToClipboard: (text: string) => void;
}) {
  return (
    <div className="app-panel border p-4">
      <h3 className="app-accent mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className={`rounded border p-2 ${
              index === 0
                ? "border-cyan-500/50 bg-cyan-500/5"
                : "border-white/5 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{result.modelName}</p>
                <p className="app-subtle font-mono text-[10px]">
                  {formatLatency(result.latencyMs)} / {formatTokens(result.usage?.totalTokens)} tokens
                </p>
              </div>
              {index === 0 && (
                <span className="app-chip border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
                  BEST
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
