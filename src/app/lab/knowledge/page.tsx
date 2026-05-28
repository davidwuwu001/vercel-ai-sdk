"use client";

/**
 * 知识库管理页面 - Phase 7 RAG UI
 * 
 * 提供:
 * - 文档上传与分块
 * - 知识库管理 (列表/统计/删除)
 * - 语义检索
 * - RAG 问答
 */

import { useCallback, useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  FileUp,
  Search,
  Bot,
  Send,
  Loader2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ParsedDocument, DocumentParseError } from "@/lib/documents/types";

interface KnowledgeDocument {
  id: number;
  name: string;
  sourceType: string;
  sourceUrl: string | null;
  chunkCount: number;
  createdAt: string;
}

interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
}

interface SearchResult {
  chunk: {
    id: string;
    content: string;
    metadata: {
      chunkIndex: number;
      chunkType: string;
      heading?: string;
      estimatedTokens: number;
    };
  };
  score: number;
  documentId: number;
  documentName?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    documentName: string;
    score: number;
    excerpt: string;
  }>;
}

type TabType = "upload" | "documents" | "search" | "chat";

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // 文件上传状态
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [uploadError, setUploadError] = useState<DocumentParseError | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexSuccess, setIndexSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载知识库数据
  const loadKnowledgeData = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to load knowledge data:", error);
    }
  }, []);

  useEffect(() => {
    void loadKnowledgeData();
  }, [loadKnowledgeData]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 解析文件
  const parseFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setParsedDocument(null);
    setIndexSuccess(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setUploadError(data.error || { code: "UNKNOWN", message: "解析失败" });
        return;
      }

      setParsedDocument(data.document);
    } catch (err) {
      setUploadError({
        code: "NETWORK_ERROR",
        message: "网络请求失败",
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsUploading(false);
    }
  }, []);

  // 保存到知识库
  const saveToKnowledgeBase = useCallback(async () => {
    if (!parsedDocument) return;

    setIsIndexing(true);
    setUploadError(null);

    try {
      const response = await fetch("/api/knowledge/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsedDocument.metadata.fileName,
          content: parsedDocument.markdown,
          sourceType: parsedDocument.metadata.documentType,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setUploadError(data.error || { code: "UNKNOWN", message: "保存失败" });
        return;
      }

      setIndexSuccess(true);
      void loadKnowledgeData();

      // 3秒后切换到文档列表
      setTimeout(() => {
        setActiveTab("documents");
        setParsedDocument(null);
        setIndexSuccess(false);
      }, 1500);
    } catch (err) {
      setUploadError({
        code: "NETWORK_ERROR",
        message: "保存到知识库失败",
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsIndexing(false);
    }
  }, [parsedDocument, loadKnowledgeData]);

  // 删除文档
  const deleteDocument = useCallback(async (docId: number) => {
    if (!confirm("确定要删除这个文档吗？相关分块和嵌入也会被删除。")) return;

    try {
      const response = await fetch(`/api/knowledge/documents/${docId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        void loadKnowledgeData();
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }, [loadKnowledgeData]);

  // 搜索
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });

      const data = await response.json();

      if (response.ok && data.results) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // RAG 问答
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput };
    setChatInput("");
    setIsChatLoading(true);

    try {
      // 调用 RAG API
      const response = await fetch("/api/knowledge/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: chatInput,
          includeCitations: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.answer) {
        setChatMessages((prev) => [
          ...prev,
          userMessage,
          {
            role: "assistant",
            content: data.answer,
            citations: data.citations?.map((c: { documentName: string; score: number; excerpt: string }) => ({
              documentName: c.documentName,
              score: c.score,
              excerpt: c.excerpt,
            })),
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          userMessage,
          {
            role: "assistant",
            content: data.error?.message || "抱歉，RAG 问答失败。请确保知识库中有足够的文档。",
          },
        ]);
      }
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "请求失败",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading]);

  // 拖放处理
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void parseFile(file);
      }
    },
    [parseFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void parseFile(file);
      }
    },
    [parseFile]
  );

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendChatMessage();
      }
    },
    [sendChatMessage]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void performSearch();
      }
    },
    [performSearch]
  );

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "upload", label: "上传", icon: <FileUp className="size-4" /> },
    { id: "documents", label: "文档库", icon: <FileText className="size-4" /> },
    { id: "search", label: "检索", icon: <Search className="size-4" /> },
    { id: "chat", label: "RAG 问答", icon: <Bot className="size-4" /> },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>

          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Phase 7
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                知识库管理
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                上传文档并建立知识库，支持语义检索和 RAG 问答。文档将被分块、嵌入后存储到向量数据库。
              </p>
            </div>

            {/* Stats */}
            {stats && (
              <div className="app-card-active border px-4 py-3 font-mono text-xs">
                <p className="app-subtle uppercase tracking-[0.18em]">Statistics</p>
                <div className="mt-2 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="app-accent text-lg">{stats.totalDocuments}</p>
                    <p className="app-subtle text-[10px]">文档</p>
                  </div>
                  <div>
                    <p className="app-accent text-lg">{stats.totalChunks}</p>
                    <p className="app-subtle text-[10px]">分块</p>
                  </div>
                  <div>
                    <p className="app-accent text-lg">{stats.totalEmbeddings}</p>
                    <p className="app-subtle text-[10px]">向量</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="mt-5 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-xs transition ${
                activeTab === tab.id
                  ? "app-card-active border-cyan-400/40"
                  : "app-card border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="mt-5">
          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <div className="app-panel border p-5">
                <h2 className="app-title mb-5 text-lg font-semibold">文档上传</h2>

                {/* Drop Zone */}
                <div
                  className="relative mb-5 cursor-pointer rounded-lg border-2 border-dashed border-cyan-400/30 bg-cyan-400/5 p-10 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/10"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    accept=".pdf,.docx,.md,.markdown,.txt"
                    className="hidden"
                    type="file"
                    onChange={handleFileSelect}
                  />
                  <FileUp className="app-accent mx-auto mb-3 size-12" />
                  <p className="app-title text-lg font-semibold">点击上传或拖拽文件到此处</p>
                  <p className="app-muted mt-2 text-sm">支持 PDF、DOCX、Markdown、TXT 格式</p>
                </div>

                {/* Loading */}
                {isUploading && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="app-accent size-6 animate-spin" />
                    <span className="app-muted">正在解析文档...</span>
                  </div>
                )}

                {/* Error */}
                {uploadError && (
                  <div className="flex items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
                    <AlertCircle className="size-5 shrink-0 text-rose-400" />
                    <div>
                      <p className="app-title font-semibold">操作失败</p>
                      <p className="app-muted mt-1 text-sm">{uploadError.message}</p>
                      {uploadError.details && (
                        <p className="app-subtle mt-1 text-xs">{uploadError.details}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Success */}
                {indexSuccess && (
                  <div className="flex items-start gap-3 border border-green-500/40 bg-green-950/40 p-4">
                    <CheckCircle2 className="size-5 shrink-0 text-green-400" />
                    <div>
                      <p className="app-title font-semibold">保存成功</p>
                      <p className="app-muted mt-1 text-sm">文档已保存到知识库，正在跳转到文档库...</p>
                    </div>
                  </div>
                )}

                {/* Parsed Document Preview */}
                {parsedDocument && !isUploading && !indexSuccess && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="app-accent size-5" />
                        <span className="app-title font-semibold">解析完成</span>
                      </div>
                      <button
                        onClick={() => {
                          setParsedDocument(null);
                          setUploadError(null);
                        }}
                        className="app-muted rounded p-1 hover:bg-white/10"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="markdown-content max-h-[400px] overflow-auto rounded-lg border bg-black/20 p-4">
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {parsedDocument.markdown.slice(0, 2000)}
                        {parsedDocument.markdown.length > 2000 && "\n\n... (内容已截断)"}
                      </pre>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={saveToKnowledgeBase}
                        disabled={isIndexing}
                        className="app-button-hot flex items-center gap-2 border px-4 py-2.5 font-mono text-sm disabled:opacity-50"
                      >
                        {isIndexing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {isIndexing ? "正在保存..." : "保存到知识库"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div className="app-panel border p-5">
                  <h3 className="app-title mb-4 flex items-center gap-2 font-semibold">
                    <FileText className="size-5" />
                    文档信息
                  </h3>

                  {parsedDocument ? (
                    <dl className="space-y-3">
                      <div>
                        <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                          文件名
                        </dt>
                        <dd className="app-title mt-1 truncate text-sm">
                          {parsedDocument.metadata.fileName}
                        </dd>
                      </div>
                      <div>
                        <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                          类型
                        </dt>
                        <dd className="mt-1">
                          <span className="app-chip border px-2 py-1 font-mono text-xs">
                            {parsedDocument.metadata.documentType.toUpperCase()}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                          字符数
                        </dt>
                        <dd className="app-title mt-1 text-sm">
                          {parsedDocument.plainText.length.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="app-muted text-sm">上传文档后显示详细信息</p>
                  )}
                </div>

                <div className="app-panel border p-5">
                  <h3 className="app-title mb-4 font-semibold">支持的格式</h3>
                  <ul className="space-y-2">
                    <li className="app-muted flex items-center gap-2 text-sm">
                      <span className="app-chip border px-2 py-0.5 font-mono text-xs">PDF</span>
                      Adobe PDF 文档
                    </li>
                    <li className="app-muted flex items-center gap-2 text-sm">
                      <span className="app-chip border px-2 py-0.5 font-mono text-xs">DOCX</span>
                      Word 2007+ 文档
                    </li>
                    <li className="app-muted flex items-center gap-2 text-sm">
                      <span className="app-chip border px-2 py-0.5 font-mono text-xs">MD</span>
                      Markdown 文档
                    </li>
                    <li className="app-muted flex items-center gap-2 text-sm">
                      <span className="app-chip border px-2 py-0.5 font-mono text-xs">TXT</span>
                      纯文本文件
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div className="app-panel border p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="app-title text-lg font-semibold">知识库文档</h2>
                <button
                  onClick={() => void loadKnowledgeData()}
                  className="app-button-accent flex items-center gap-2 border px-3 py-1.5 font-mono text-xs"
                >
                  <Loader2 className="size-3" />
                  刷新
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="app-muted mx-auto mb-4 size-12" />
                  <p className="app-muted text-lg">知识库为空</p>
                  <p className="app-subtle mt-2 text-sm">上传文档以开始构建知识库</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="app-card flex items-center justify-between border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="app-icon-tile grid size-10 place-items-center border">
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <p className="app-title font-semibold">{doc.name}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <span className="app-chip border px-2 py-0.5 font-mono text-xs">
                              {doc.sourceType.toUpperCase()}
                            </span>
                            <span className="app-subtle text-xs">
                              {doc.chunkCount} 个分块
                            </span>
                            <span className="app-subtle text-xs">
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => void deleteDocument(doc.id)}
                        className="app-muted rounded p-2 transition hover:bg-rose-500/20 hover:text-rose-400"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === "search" && (
            <div className="space-y-5">
              {/* Search Input */}
              <div className="app-panel border p-5">
                <h2 className="app-title mb-4 text-lg font-semibold">语义检索</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="输入搜索关键词..."
                    className="app-input flex-1 border px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2"
                  />
                  <button
                    onClick={() => void performSearch()}
                    disabled={!searchQuery.trim() || isSearching}
                    className="app-button-hot flex items-center gap-2 border px-5 py-3 font-mono text-sm disabled:opacity-50"
                  >
                    {isSearching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    搜索
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="flex items-center justify-center gap-3 py-12">
                  <Loader2 className="app-accent size-6 animate-spin" />
                  <span className="app-muted">正在检索...</span>
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-3">
                  <p className="app-subtle font-mono text-xs">
                    找到 {searchResults.length} 个相关结果
                  </p>
                  {searchResults.map((result, index) => (
                    <div key={result.chunk.id} className="app-card border">
                      <button
                        className="flex w-full items-center justify-between p-4 text-left"
                        onClick={() =>
                          setExpandedResult(
                            expandedResult === result.chunk.id ? null : result.chunk.id
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <span className="app-hot font-mono text-xs">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="app-title font-semibold">
                              {result.documentName || "未知文档"}
                            </p>
                            {result.chunk.metadata.heading && (
                              <p className="app-subtle mt-0.5 text-xs">
                                {result.chunk.metadata.heading}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="app-chip border px-2 py-1 font-mono text-xs">
                            {(result.score * 100).toFixed(1)}%
                          </span>
                          {expandedResult === result.chunk.id ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </div>
                      </button>
                      {expandedResult === result.chunk.id && (
                        <div className="border-t p-4">
                          <div className="markdown-content rounded-lg bg-black/20 p-4">
                            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                              {result.chunk.content}
                            </pre>
                          </div>
                          <div className="mt-3 flex items-center gap-4">
                            <span className="app-subtle text-xs">
                              分块类型: {result.chunk.metadata.chunkType}
                            </span>
                            <span className="app-subtle text-xs">
                              预估 Token: {result.chunk.metadata.estimatedTokens}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="app-muted mx-auto mb-4 size-12" />
                  <p className="app-muted text-lg">未找到相关结果</p>
                  <p className="app-subtle mt-2 text-sm">尝试不同的关键词或上传更多文档</p>
                </div>
              )}

              {!isSearching && !searchQuery && (
                <div className="py-12 text-center">
                  <Search className="app-muted mx-auto mb-4 size-12" />
                  <p className="app-muted text-lg">输入关键词开始检索</p>
                  <p className="app-subtle mt-2 text-sm">基于文档语义进行相似度匹配</p>
                </div>
              )}
            </div>
          )}

          {/* RAG Chat Tab */}
          {activeTab === "chat" && (
            <div className="app-panel flex h-[600px] flex-col border">
              {/* Chat Header */}
              <div className="app-panel border-b p-4">
                <div className="flex items-center gap-3">
                  <div className="app-icon-tile grid size-10 place-items-center border">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h2 className="app-title text-lg font-semibold">RAG 问答</h2>
                    <p className="app-muted text-sm">基于知识库的增强检索生成</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Sparkles className="app-muted mb-4 size-12" />
                    <p className="app-muted text-lg">开始与知识库对话</p>
                    <p className="app-subtle mt-2 max-w-sm text-sm">
                      系统会从知识库中检索相关内容来回答你的问题
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`app-card max-w-[85%] border px-4 py-3 ${
                            msg.role === "user" ? "app-card-active" : ""
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            {msg.role === "assistant" && <Bot className="size-4" />}
                            <span className="app-subtle text-xs uppercase">
                              {msg.role === "user" ? "你" : "RAG"}
                            </span>
                          </div>
                          <div className="app-title whitespace-pre-wrap text-sm">
                            {msg.content}
                          </div>
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <p className="app-subtle mb-2 text-xs uppercase">参考来源</p>
                              <div className="space-y-2">
                                {msg.citations.map((citation, cIndex) => (
                                  <div
                                    key={cIndex}
                                    className="app-card border p-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="app-title font-semibold">
                                        {citation.documentName}
                                      </span>
                                      <span className="app-chip border px-1.5 py-0.5 font-mono text-[10px]">
                                        {(citation.score * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <p className="app-muted mt-1 line-clamp-2">
                                      {citation.excerpt}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="app-accent size-4 animate-spin" />
                        <span className="app-muted text-sm">RAG 正在思考...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="app-panel border-t p-4">
                <div className="flex gap-2">
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="输入问题..."
                    disabled={isChatLoading}
                    className="app-input flex-1 resize-none border px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2"
                    rows={1}
                  />
                  <button
                    onClick={() => void sendChatMessage()}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="app-button-hot flex items-center gap-2 border px-5 py-3 disabled:opacity-50"
                  >
                    {isChatLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
