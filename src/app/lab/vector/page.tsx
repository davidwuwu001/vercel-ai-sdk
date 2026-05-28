"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Database,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

type VectorEntry = {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
};

type SearchResult = {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
};

type StoreStats = {
  totalVectors: number;
  dimensions: number;
};

export default function VectorSearchPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [stats, setStats] = useState<StoreStats>({ totalVectors: 0, dimensions: 0 });
  const [entries, setEntries] = useState<VectorEntry[]>([]);

  // 添加向量表单
  const [newId, setNewId] = useState("");
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // 加载统计信息
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/vector/search?action=stats");
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch {
      // 静默处理
    }
  }, []);

  // 加载向量列表
  const loadEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/vector/search?action=list");
      const data = await response.json();
      if (data.success) {
        setEntries(data.vectors || []);
      }
    } catch {
      // 静默处理
    }
  }, []);

  // 初始化加载
  useState(() => {
    void loadStats();
    void loadEntries();
  });

  // 搜索
  const performSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch("/api/vector/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: query.trim(),
          options: {
            topK,
            threshold,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // 静默处理
    } finally {
      setIsSearching(false);
    }
  };

  // 添加向量
  const addEntry = async () => {
    if (!newId.trim() || !newText.trim()) {
      setAddError("ID and text are required");
      return;
    }

    setIsAdding(true);
    setAddError("");

    try {
      const response = await fetch("/api/vector/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          id: newId.trim(),
          text: newText.trim(),
        }),
      });

      if (response.ok) {
        setNewId("");
        setNewText("");
        await loadStats();
        await loadEntries();
      } else {
        const data = await response.json();
        setAddError(data.error || "Failed to add vector");
      }
    } catch (err) {
      setAddError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  // 删除向量
  const deleteEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/vector/search?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadStats();
        await loadEntries();
      }
    } catch {
      // 静默处理
    }
  };

  // 格式化相似度分数
  const formatScore = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

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
            Vector Search
          </h1>
          <p className="app-muted mt-2 text-sm">
            简单的向量存储和相似度搜索（基于内存）
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* 左侧：统计和添加 */}
          <aside className="space-y-4">
            {/* 统计信息 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <Database className="size-4" />
                Store Stats
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="app-chip border px-3 py-2 text-center">
                  <p className="app-subtle text-[10px] uppercase tracking-wider">Vectors</p>
                  <p className="font-mono text-lg text-cyan-400">{stats.totalVectors}</p>
                </div>
                <div className="app-chip border px-3 py-2 text-center">
                  <p className="app-subtle text-[10px] uppercase tracking-wider">Dimensions</p>
                  <p className="font-mono text-lg text-cyan-400">{stats.dimensions || "N/A"}</p>
                </div>
              </div>
            </section>

            {/* 添加向量 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <Plus className="size-4" />
                Add Vector
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                    ID
                  </label>
                  <input
                    type="text"
                    className="field-input w-full font-mono text-sm"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="unique-vector-id"
                  />
                </div>
                <div>
                  <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                    Text
                  </label>
                  <textarea
                    className="field-input min-h-24 w-full resize-y font-mono text-sm"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Text content to embed..."
                  />
                </div>
                {addError && (
                  <p className="text-xs text-rose-400">{addError}</p>
                )}
                <button
                  className="app-button flex w-full items-center justify-center gap-2"
                  disabled={isAdding || !newId.trim() || !newText.trim()}
                  onClick={() => void addEntry()}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Add Vector
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* 向量列表 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <Database className="size-4" />
                Stored Vectors ({entries.length})
              </h2>
              {entries.length === 0 ? (
                <p className="app-subtle text-center text-sm">No vectors stored yet</p>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-start gap-2 rounded border border-white/5 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-cyan-400">
                          {entry.id}
                        </p>
                        <p className="app-subtle line-clamp-2 text-xs">
                          {entry.text.slice(0, 100)}
                          {entry.text.length > 100 ? "..." : ""}
                        </p>
                      </div>
                      <button
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => void deleteEntry(entry.id)}
                      >
                        <Trash2 className="size-4 text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          {/* 右侧：搜索 */}
          <main className="space-y-4">
            {/* 搜索表单 */}
            <section className="app-panel border p-4">
              <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <Search className="size-4" />
                Search
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                    Query
                  </label>
                  <textarea
                    className="field-input min-h-24 w-full resize-y font-mono text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter search query..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        void performSearch();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Top K: {topK}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-wider">
                      Threshold: {threshold}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
                <button
                  className="app-button-hot flex w-full items-center justify-center gap-2"
                  disabled={isSearching || !query.trim()}
                  onClick={() => void performSearch()}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* 搜索结果 */}
            {searchResults !== null && (
              <section className="app-panel border p-4">
                <h2 className="app-accent mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                  <Search className="size-4" />
                  Results ({searchResults.length})
                </h2>
                {searchResults.length === 0 ? (
                  <p className="app-subtle text-center text-sm">
                    No matching vectors found. Try lowering the threshold.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((result, index) => (
                      <div
                        key={result.id}
                        className="rounded border border-white/5 bg-black/20 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="app-chip border px-2 py-1 font-mono text-xs">
                              #{index + 1}
                            </span>
                            <span className="font-mono text-xs text-cyan-400">
                              {result.id}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-emerald-400">
                            {formatScore(result.score)}
                          </span>
                        </div>
                        <p className="text-sm">{result.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </main>
  );
}
