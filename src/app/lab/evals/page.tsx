"use client";

import { useCallback, useState, useEffect } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock,
  Database,
  Filter,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";

// Types
type EvalPrompt = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  expectedCriteria?: string;
  category: "general" | "reasoning" | "creative" | "analysis";
};

type EvalRun = {
  id?: number;
  evalPromptId: string;
  modelConfigId: number | null;
  modelName: string;
  modelId: string;
  provider: string;
  output: string;
  manualScore?: number;
  judgeScore?: number;
  judgeFeedback?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type EvalResult = {
  id: number;
  evalPrompt: EvalPrompt;
  runs: EvalRun[];
  averageScore: number | null;
  averageJudgeScore: number | null;
  createdAt: string;
};

type EvalDataset = {
  id: string;
  name: string;
  description: string;
  prompts: EvalPrompt[];
  createdAt: string;
};

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

// Built-in datasets (from types.ts)
const BUILTIN_DATASETS: EvalDataset[] = [
  {
    id: "general-capability",
    name: "通用能力测试",
    description: "测试模型的基本理解和回答能力",
    prompts: [
      {
        id: "factual-qa",
        name: "事实问答",
        description: "测试模型对基本事实的准确回答能力",
        prompt: "请简要解释什么是人工智能机器学习，给出3个实际应用例子。",
        category: "general",
        expectedCriteria: "准确解释概念，给出相关例子",
      },
      {
        id: "summarization",
        name: "文本摘要",
        description: "测试模型的文本压缩能力",
        prompt: "请将以下文本压缩为100字以内的摘要：人工智能（AI）是计算机科学的一个分支，致力于开发能够执行通常需要人类智能的任务的系统。这包括视觉感知、语音识别、决策制定和语言翻译等。AI技术已经从实验室走向实际应用，广泛应用于医疗、金融、制造等领域。",
        category: "general",
        expectedCriteria: "保留核心信息，压缩至100字以内",
      },
      {
        id: "reasoning",
        name: "逻辑推理",
        description: "测试模型的推理能力",
        prompt: "如果所有的A都是B，有些B是C，那么下列哪个结论一定正确？A. 有些A是C B. 所有的C都是A C. 所有的A都是C D. 所有的C都是B。请给出推理过程。",
        category: "reasoning",
        expectedCriteria: "正确识别逻辑关系，给出清晰推理",
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "domain-specific",
    name: "领域专业测试",
    description: "测试教育行业相关场景",
    prompts: [
      {
        id: "service-feedback",
        name: "服务反馈生成",
        description: "生成服务反馈的能力",
        prompt: "为一个小学数学课程生成一条服务反馈，包含：1) 本节课学习目标 2) 学生表现 3) 建议家长配合事项。语气要专业且友好。",
        category: "analysis",
        expectedCriteria: "结构清晰，语气合适，内容具体",
      },
      {
        id: "case-analysis",
        name: "案例分析",
        description: "分析学生行为案例",
        prompt: "学生小明在课堂上表现出注意力不集中、作业经常迟交、但考试成绩中等。请分析可能的原因并给出建议的干预措施。",
        category: "analysis",
        expectedCriteria: "分析全面，建议实用",
      },
      {
        id: "creative-writing",
        name: "创意写作",
        description: "测试创意表达能力",
        prompt: "为一个6岁小朋友编写一个关于友谊的睡前故事，要求：1) 故事长度约300字 2) 包含一个简单道理 3) 语言适合儿童理解。",
        category: "creative",
        expectedCriteria: "故事有趣，道理清晰，适合年龄",
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "通用",
  reasoning: "推理",
  creative: "创意",
  analysis: "分析",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "text-blue-400",
  reasoning: "text-purple-400",
  creative: "text-pink-400",
  analysis: "text-emerald-400",
};

export default function EvalsPage() {
  // State
  const [activeTab, setActiveTab] = useState<"run" | "results" | "history">("run");
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [useJudge, setUseJudge] = useState(false);
  const [judgeModelId, setJudgeModelId] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResult[]>([]);
  const [historyRuns, setHistoryRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDataset, setExpandedDataset] = useState<string | null>("general-capability");
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [expandedRun, setExpandedRun] = useState<number | undefined>(undefined);
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterPrompt, setFilterPrompt] = useState<string>("all");
  const [manualScoreInput, setManualScoreInput] = useState<Record<number, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load models
  const loadModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models");
      const data = await response.json();
      const enabledModels = (data.models || []).filter((m: ModelConfig) => m.enabled);
      setModels(enabledModels);
      // Default select first model
      if (enabledModels.length > 0) {
        setSelectedModelIds([enabledModels[0].id]);
        setJudgeModelId(enabledModels[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/evals/history");
      if (response.ok) {
        const data = await response.json();
        setHistoryRuns(data.runs || []);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  // Load history when switching to history tab
  const handleTabChange = useCallback(
    (tab: typeof activeTab) => {
      setActiveTab(tab);
      if (tab === "history") {
        void loadHistory();
      }
    },
    [loadHistory]
  );

  // Toggle model selection
  const toggleModel = (modelId: number) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  // Toggle prompt selection
  const togglePrompt = (promptId: string) => {
    setSelectedPromptIds((prev) =>
      prev.includes(promptId)
        ? prev.filter((id) => id !== promptId)
        : [...prev, promptId]
    );
  };

  // Select all prompts in a dataset
  const selectDatasetPrompts = (datasetId: string, select: boolean) => {
    const dataset = BUILTIN_DATASETS.find((d) => d.id === datasetId);
    if (!dataset) return;

    setSelectedPromptIds((prev) => {
      const otherPrompts = prev.filter(
        (id) => !dataset.prompts.some((p) => p.id === id)
      );
      if (select) {
        return [...otherPrompts, ...dataset.prompts.map((p) => p.id)];
      }
      return otherPrompts;
    });
  };

  // Run evaluation
  const runEvaluation = async () => {
    if (selectedModelIds.length === 0 || selectedPromptIds.length === 0) return;

    setIsRunning(true);
    setActiveTab("results");

    try {
      const response = await fetch("/api/evals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptIds: selectedPromptIds,
          modelConfigIds: selectedModelIds,
          useJudge,
          judgeModelConfigId: useJudge ? judgeModelId : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEvalResults(data.results || []);
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Set manual score
  const setManualScore = async (runId: number, score: number) => {
    try {
      await fetch("/api/evals/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, score }),
      });
      // Update local state
      setEvalResults((prev) =>
        prev.map((result) => ({
          ...result,
          runs: result.runs.map((run) =>
            run.id === runId ? { ...run, manualScore: score } : run
          ),
        }))
      );
    } catch {
      // Ignore errors
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get all prompts
  const allPrompts = BUILTIN_DATASETS.flatMap((d) => d.prompts);

  // Filter history
  const filteredHistory = historyRuns.filter((run) => {
    if (filterModel !== "all" && run.modelId !== filterModel) return false;
    if (filterPrompt !== "all" && run.evalPromptId !== filterPrompt) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    totalRuns: evalResults.reduce((sum, r) => sum + r.runs.length, 0),
    avgJudgeScore:
      evalResults.filter((r) => r.averageJudgeScore !== null).length > 0
        ? evalResults.reduce((sum, r) => sum + (r.averageJudgeScore || 0), 0) /
          evalResults.filter((r) => r.averageJudgeScore !== null).length
        : null,
    avgManualScore:
      evalResults.filter((r) => r.averageScore !== null).length > 0
        ? evalResults.reduce((sum, r) => sum + (r.averageScore || 0), 0) /
          evalResults.filter((r) => r.averageScore !== null).length
        : null,
    byModel: evalResults.reduce(
      (acc, result) => {
        result.runs.forEach((run) => {
          if (!acc[run.modelId]) {
            acc[run.modelId] = { count: 0, totalJudgeScore: 0, totalManualScore: 0 };
          }
          acc[run.modelId].count++;
          if (run.judgeScore !== undefined) {
            acc[run.modelId].totalJudgeScore += run.judgeScore;
          }
          if (run.manualScore !== undefined) {
            acc[run.modelId].totalManualScore += run.manualScore;
          }
        });
        return acc;
      },
      {} as Record<string, { count: number; totalJudgeScore: number; totalManualScore: number }>
    ),
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
        <header className="mb-5">
          <Link
            className="app-accent mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Phase 9
              </p>
              <h1 className="app-title mt-1 text-2xl font-semibold md:text-3xl">
                模型评估
              </h1>
              <p className="app-muted mt-2 text-sm">
                评估不同模型在各类任务上的表现，支持 LLM-as-Judge 自动评分
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`app-chip border px-3 py-2 font-mono text-xs transition ${
                  activeTab === "run" ? "app-card-active" : ""
                }`}
                onClick={() => handleTabChange("run")}
              >
                <Play className="mr-1.5 inline size-3" />
                评估
              </button>
              <button
                className={`app-chip border px-3 py-2 font-mono text-xs transition ${
                  activeTab === "results" ? "app-card-active" : ""
                }`}
                onClick={() => handleTabChange("results")}
              >
                <TrendingUp className="mr-1.5 inline size-3" />
                结果
                {evalResults.length > 0 && (
                  <span className="ml-1.5 rounded bg-cyan-500/20 px-1.5 py-0.5 text-cyan-400">
                    {evalResults.length}
                  </span>
                )}
              </button>
              <button
                className={`app-chip border px-3 py-2 font-mono text-xs transition ${
                  activeTab === "history" ? "app-card-active" : ""
                }`}
                onClick={() => handleTabChange("history")}
              >
                <Clock className="mr-1.5 inline size-3" />
                历史
              </button>
            </div>
          </div>
        </header>

        {/* Run Tab */}
        {activeTab === "run" && (
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            {/* Left: Configuration */}
            <aside className="space-y-4">
              {/* Model Selection */}
              <section className="app-panel border p-4">
                <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                  <Bot className="size-4" />
                  选择模型 ({selectedModelIds.length})
                </h2>
                <div className="space-y-2">
                  {models.length === 0 ? (
                    <p className="app-muted text-xs">暂无启用的模型</p>
                  ) : (
                    models.map((model) => (
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
                    ))
                  )}
                </div>
              </section>

              {/* LLM-as-Judge */}
              <section className="app-panel border p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useJudge}
                    onChange={(e) => setUseJudge(e.target.checked)}
                    className="size-4 accent-cyan-400"
                  />
                  <div>
                    <p className="font-medium">启用 LLM-as-Judge</p>
                    <p className="app-muted text-xs">
                      使用 AI 模型自动评估回答质量
                    </p>
                  </div>
                </label>
                {useJudge && (
                  <div className="mt-3">
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Judge 模型
                    </label>
                    <select
                      className="field-input w-full"
                      value={judgeModelId || ""}
                      onChange={(e) => setJudgeModelId(Number(e.target.value))}
                    >
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </section>

              {/* Run Button */}
              <button
                className="app-button-hot flex w-full items-center justify-center gap-2"
                disabled={
                  isRunning ||
                  selectedModelIds.length === 0 ||
                  selectedPromptIds.length === 0
                }
                onClick={() => void runEvaluation()}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    运行中...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    开始评估
                  </>
                )}
              </button>
              {selectedModelIds.length === 0 && (
                <p className="text-center text-xs text-amber-400">
                  请选择至少一个模型
                </p>
              )}
              {selectedPromptIds.length === 0 && (
                <p className="text-center text-xs text-amber-400">
                  请选择至少一个 Prompt
                </p>
              )}
            </aside>

            {/* Right: Dataset Selection */}
            <main className="space-y-4">
              <section className="app-panel border p-4">
                <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                  <Database className="size-4" />
                  Prompt 数据集
                  <span className="ml-auto text-cyan-400">
                    {selectedPromptIds.length} / {allPrompts.length} 已选
                  </span>
                </h2>
                <div className="space-y-3">
                  {BUILTIN_DATASETS.map((dataset) => {
                    const isExpanded = expandedDataset === dataset.id;
                    const selectedCount = dataset.prompts.filter((p) =>
                      selectedPromptIds.includes(p.id)
                    ).length;
                    const isAllSelected = selectedCount === dataset.prompts.length;

                    return (
                      <div key={dataset.id} className="border">
                        <button
                          className="flex w-full items-center justify-between p-4 transition hover:bg-white/5"
                          onClick={() =>
                            setExpandedDataset(isExpanded ? null : dataset.id)
                          }
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                            <div className="text-left">
                              <p className="font-medium">{dataset.name}</p>
                              <p className="app-muted text-xs">
                                {dataset.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="app-chip border px-2 py-1 font-mono text-xs">
                              {selectedCount} / {dataset.prompts.length}
                            </span>
                            <button
                              className={`app-chip border px-2 py-1 font-mono text-xs transition ${
                                isAllSelected
                                  ? "bg-cyan-500/20 text-cyan-400"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectDatasetPrompts(dataset.id, !isAllSelected);
                              }}
                            >
                              {isAllSelected ? "取消全选" : "全选"}
                            </button>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t p-4">
                            <div className="space-y-2">
                              {dataset.prompts.map((prompt) => (
                                <label
                                  key={prompt.id}
                                  className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                                    selectedPromptIds.includes(prompt.id)
                                      ? "app-card-active border-cyan-500/30"
                                      : "border-transparent hover:border-white/10"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedPromptIds.includes(
                                      prompt.id
                                    )}
                                    onChange={() => togglePrompt(prompt.id)}
                                    className="mt-0.5 size-4 accent-cyan-400"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {prompt.name}
                                      </span>
                                      <span
                                        className={`app-chip border px-1.5 py-0.5 font-mono text-[10px] ${
                                          CATEGORY_COLORS[prompt.category]
                                        }`}
                                      >
                                        {CATEGORY_LABELS[prompt.category]}
                                      </span>
                                    </div>
                                    <p className="app-muted mt-1 text-xs">
                                      {prompt.description}
                                    </p>
                                    {prompt.expectedCriteria && (
                                      <p className="app-subtle mt-2 text-xs">
                                        评分标准：{prompt.expectedCriteria}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </main>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && (
          <div className="space-y-4">
            {evalResults.length === 0 ? (
              <div className="app-panel border p-8 text-center">
                <BarChart3 className="app-accent mx-auto size-12" />
                <p className="app-muted mt-4">暂无评估结果</p>
                <p className="app-subtle mt-2 text-sm">
                  运行评估后将在此显示结果
                </p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="app-card border p-4">
                    <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <TrendingUp className="size-4" />
                      总运行数
                    </div>
                    <p className="app-title text-2xl font-semibold">
                      {stats.totalRuns}
                    </p>
                  </div>
                  {stats.avgJudgeScore !== null && (
                    <div className="app-card border p-4">
                      <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                        <Star className="size-4 text-amber-400" />
                        平均 Judge 分数
                      </div>
                      <p className="app-title text-2xl font-semibold text-amber-400">
                        {stats.avgJudgeScore.toFixed(1)}
                        <span className="text-sm">/10</span>
                      </p>
                    </div>
                  )}
                  {stats.avgManualScore !== null && (
                    <div className="app-card border p-4">
                      <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                        <Star className="size-4 text-cyan-400" />
                        平均手动分数
                      </div>
                      <p className="app-title text-2xl font-semibold text-cyan-400">
                        {stats.avgManualScore.toFixed(1)}
                        <span className="text-sm">/10</span>
                      </p>
                    </div>
                  )}
                  <div className="app-card border p-4">
                    <div className="app-subtle mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <Database className="size-4" />
                      评估 Prompt
                    </div>
                    <p className="app-title text-2xl font-semibold">
                      {evalResults.length}
                    </p>
                  </div>
                </div>

                {/* Model Comparison */}
                {Object.keys(stats.byModel).length > 1 && (
                  <div className="app-panel border p-4">
                    <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <Trophy className="size-4" />
                      模型对比
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(stats.byModel)
                        .sort(([, a], [, b]) => {
                          const avgA = a.totalJudgeScore / a.count;
                          const avgB = b.totalJudgeScore / b.count;
                          return avgB - avgA;
                        })
                        .map(([modelId, data], index) => {
                          const avgJudge = data.totalJudgeScore / data.count;
                          const model = models.find((m) => m.modelId === modelId);
                          return (
                            <div
                              key={modelId}
                              className={`rounded border p-4 ${
                                index === 0
                                  ? "border-amber-500/50 bg-amber-500/5"
                                  : "border-white/10 bg-white/5"
                              }`}
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {model?.name || modelId}
                                  </p>
                                  <p className="app-subtle font-mono text-xs">
                                    {data.count} 次运行
                                  </p>
                                </div>
                                {index === 0 && (
                                  <span className="app-chip border border-amber-500/50 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-400">
                                    BEST
                                  </span>
                                )}
                              </div>
                              {avgJudge > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-500"
                                      style={{ width: `${(avgJudge / 10) * 100}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-sm text-cyan-400">
                                    {avgJudge.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Results by Prompt */}
                <div className="space-y-3">
                  {evalResults.map((result) => {
                    const isExpanded = expandedResult === result.id;
                    const avgJudge =
                      result.runs.filter((r) => r.judgeScore !== undefined)
                        .length > 0
                        ? result.runs.reduce(
                            (sum, r) => sum + (r.judgeScore || 0),
                            0
                          ) /
                          result.runs.filter((r) => r.judgeScore !== undefined)
                            .length
                        : null;

                    return (
                      <div key={result.id} className="app-card border">
                        <button
                          className="flex w-full items-center justify-between p-4 transition hover:bg-white/5"
                          onClick={() =>
                            setExpandedResult(isExpanded ? null : result.id)
                          }
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {result.evalPrompt.name}
                                </span>
                                <span
                                  className={`app-chip border px-1.5 py-0.5 font-mono text-[10px] ${
                                    CATEGORY_COLORS[result.evalPrompt.category]
                                  }`}
                                >
                                  {CATEGORY_LABELS[result.evalPrompt.category]}
                                </span>
                              </div>
                              <p className="app-muted text-xs">
                                {result.evalPrompt.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {avgJudge !== null && (
                              <span className="app-chip border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-400">
                                {avgJudge.toFixed(1)}
                              </span>
                            )}
                            <span className="app-chip border px-2 py-1 font-mono text-xs">
                              {result.runs.length} 模型
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t p-4">
                            {/* Prompt */}
                            <div className="mb-4">
                              <h4 className="app-subtle mb-2 font-mono text-xs uppercase tracking-wider">
                                Prompt
                              </h4>
                              <pre className="whitespace-pre-wrap rounded border border-white/10 bg-black/20 p-3 font-mono text-xs">
                                {result.evalPrompt.prompt}
                              </pre>
                            </div>

                            {/* Runs */}
                            <div className="space-y-3">
                              {result.runs.map((run) => (
                                <div
                                  key={run.id}
                                  className="rounded border border-white/10 bg-white/5"
                                >
                                  <button
                                    className="flex w-full items-center justify-between p-3 transition hover:bg-white/5"
                                    onClick={() =>
                                      setExpandedRun(
                                        expandedRun === run.id ? undefined : run.id
                                      )
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      {expandedRun === run.id ? (
                                        <ChevronDown className="size-4" />
                                      ) : (
                                        <ChevronRight className="size-4" />
                                      )}
                                      <span className="font-medium">
                                        {run.modelName}
                                      </span>
                                      <span className="app-subtle font-mono text-xs">
                                        {run.modelId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {run.judgeScore !== undefined && (
                                        <span className="app-chip border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-400">
                                          Judge: {run.judgeScore}
                                        </span>
                                      )}
                                      {run.manualScore !== undefined && (
                                        <span className="app-chip border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-xs text-cyan-400">
                                          Manual: {run.manualScore}
                                        </span>
                                      )}
                                    </div>
                                  </button>

                                  {expandedRun === run.id && (
                                    <div className="border-t p-3">
                                      {/* Scores */}
                                      <div className="mb-3 flex flex-wrap items-center gap-4">
                                        {run.judgeScore !== undefined && (
                                          <div>
                                            <span className="app-subtle font-mono text-xs uppercase">
                                              Judge Score:
                                            </span>
                                            <span className="ml-2 font-mono text-lg text-amber-400">
                                              {run.judgeScore}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <span className="app-subtle font-mono text-xs uppercase">
                                            Manual:
                                          </span>
                                          <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            className="field-input w-16"
                                            value={manualScoreInput[run.id!] ?? ""}
                                            onChange={(e) =>
                                              setManualScoreInput((prev) => ({
                                                ...prev,
                                                [run.id!]: Number(
                                                  e.target.value
                                                ),
                                              }))
                                            }
                                            placeholder={String(
                                              run.manualScore ?? "-"
                                            )}
                                          />
                                          <button
                                            className="app-chip border px-2 py-1"
                                            onClick={() =>
                                              void setManualScore(
                                                run.id!,
                                                manualScoreInput[run.id!] || 0
                                              )
                                            }
                                          >
                                            <Check className="size-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Output */}
                                      <div className="mb-3">
                                        <div className="mb-2 flex items-center justify-between">
                                          <h4 className="app-subtle font-mono text-xs uppercase tracking-wider">
                                            Output
                                          </h4>
                                          <button
                                            className="app-accent flex items-center gap-1 font-mono text-xs"
                                            onClick={() =>
                                              copyToClipboard(
                                                run.output,
                                                `output-${run.id}`
                                              )
                                            }
                                          >
                                            {copiedId === `output-${run.id}` ? (
                                              <>
                                                <Check className="size-3" />
                                                Copied
                                              </>
                                            ) : (
                                              <>
                                                <Clipboard className="size-3" />
                                                Copy
                                              </>
                                            )}
                                          </button>
                                        </div>
                                        <pre className="whitespace-pre-wrap rounded border border-white/10 bg-black/20 p-3 font-mono text-xs">
                                          {run.output}
                                        </pre>
                                      </div>

                                      {/* Judge Feedback */}
                                      {run.judgeFeedback && (
                                        <div>
                                          <h4 className="app-subtle mb-2 font-mono text-xs uppercase tracking-wider">
                                            Judge Feedback
                                          </h4>
                                          <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
                                            {run.judgeFeedback}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="app-panel border p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="size-4" />
                  <span className="app-subtle font-mono text-xs uppercase tracking-wider">
                    筛选:
                  </span>
                </div>
                <select
                  className="field-input"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                >
                  <option value="all">所有模型</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.modelId}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field-input"
                  value={filterPrompt}
                  onChange={(e) => setFilterPrompt(e.target.value)}
                >
                  <option value="all">所有 Prompt</option>
                  {allPrompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))}
                </select>
                <button
                  className="app-chip border px-3 py-1.5"
                  onClick={() => void loadHistory()}
                >
                  <RefreshCw className="mr-1.5 inline size-3" />
                  刷新
                </button>
              </div>
            </div>

            {/* History List */}
            {filteredHistory.length === 0 ? (
              <div className="app-panel border p-8 text-center">
                <Clock className="app-accent mx-auto size-12" />
                <p className="app-muted mt-4">暂无历史记录</p>
                <p className="app-subtle mt-2 text-sm">
                  运行评估后将在此显示历史记录
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((run) => {
                  const prompt = allPrompts.find(
                    (p) => p.id === run.evalPromptId
                  );
                  return (
                    <div key={run.id} className="app-card border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{run.modelName}</span>
                            {run.judgeScore !== undefined && (
                              <span className="app-chip border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs text-amber-400">
                                {run.judgeScore}
                              </span>
                            )}
                            {run.manualScore !== undefined && (
                              <span className="app-chip border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-xs text-cyan-400">
                                {run.manualScore}
                              </span>
                            )}
                          </div>
                          <p className="app-subtle mt-1 font-mono text-xs">
                            {prompt?.name || run.evalPromptId}
                          </p>
                          {run.createdAt && (
                            <p className="app-subtle mt-1 font-mono text-xs">
                              {new Date(run.createdAt).toLocaleString("zh-CN")}
                            </p>
                          )}
                        </div>
                        <button
                          className="app-chip border px-2 py-1"
                          onClick={() => copyToClipboard(run.output, `history-${run.id}`)}
                        >
                          {copiedId === `history-${run.id}` ? (
                            <Check className="size-3" />
                          ) : (
                            <Clipboard className="size-3" />
                          )}
                        </button>
                      </div>
                      <pre className="app-panel-soft mt-3 max-h-32 overflow-auto rounded border border-white/10 p-3 font-mono text-xs">
                        {run.output.slice(0, 500)}
                        {run.output.length > 500 && "..."}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
