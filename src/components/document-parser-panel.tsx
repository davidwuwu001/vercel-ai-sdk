"use client";

import { FileText, Send, Loader2, AlertCircle, CheckCircle2, Save, Copy, FileUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { ParsedDocument, DocumentParseError } from "@/lib/documents/types";

type ViewMode = "text" | "markdown";

export function DocumentParserPanel() {
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<DocumentParseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setParsedDocument(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || { code: "UNKNOWN", message: "解析失败" });
        return;
      }

      setParsedDocument(data.document);
    } catch (err) {
      setError({
        code: "NETWORK_ERROR",
        message: "网络请求失败",
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
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

  const copyToClipboard = useCallback(() => {
    if (parsedDocument) {
      const text = viewMode === "markdown" ? parsedDocument.markdown : parsedDocument.plainText;
      void navigator.clipboard.writeText(text);
    }
  }, [parsedDocument, viewMode]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="app-panel border p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="app-title text-lg font-semibold">文档上传</h2>
          <div className="flex gap-2">
            <button
              className={`app-button-accent flex items-center gap-2 border px-3 py-2 font-mono text-xs ${
                viewMode === "text" ? "" : "opacity-50"
              }`}
              onClick={() => setViewMode("text")}
              type="button"
            >
              纯文本
            </button>
            <button
              className={`app-button-accent flex items-center gap-2 border px-3 py-2 font-mono text-xs ${
                viewMode === "markdown" ? "" : "opacity-50"
              }`}
              onClick={() => setViewMode("markdown")}
              type="button"
            >
              Markdown
            </button>
          </div>
        </div>

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
            accept=".pdf,.docx,.md,.markdown"
            className="hidden"
            type="file"
            onChange={handleFileSelect}
          />
          <FileUp className="app-accent mx-auto mb-3 size-12" />
          <p className="app-title text-lg font-semibold">点击上传或拖拽文件到此处</p>
          <p className="app-muted mt-2 text-sm">支持 PDF、DOCX、Markdown 格式，最大 10MB</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="app-accent size-6 animate-spin" />
            <span className="app-muted">正在解析文档...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
            <AlertCircle className="size-5 shrink-0 text-rose-400" />
            <div>
              <p className="app-title font-semibold">解析失败</p>
              <p className="app-muted mt-1 text-sm">{error.message}</p>
              {error.details && (
                <p className="app-subtle mt-1 text-xs">{error.details}</p>
              )}
            </div>
          </div>
        )}

        {parsedDocument && !isLoading && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="app-accent size-5" />
                <span className="app-title font-semibold">解析完成</span>
              </div>
              <button
                className="app-button-accent flex items-center gap-2 border px-3 py-1.5 font-mono text-xs"
                onClick={copyToClipboard}
                type="button"
              >
                <Copy className="size-4" />
                复制内容
              </button>
            </div>

            <div className="markdown-content max-h-[600px] overflow-auto rounded-lg border bg-black/20 p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {viewMode === "markdown" ? parsedDocument.markdown : parsedDocument.plainText}
              </pre>
            </div>
          </div>
        )}
      </div>

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
                  大小
                </dt>
                <dd className="app-title mt-1 text-sm">
                  {formatFileSize(parsedDocument.metadata.fileSize)}
                </dd>
              </div>
              {parsedDocument.metadata.pageCount && (
                <div>
                  <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                    页数
                  </dt>
                  <dd className="app-title mt-1 text-sm">
                    {parsedDocument.metadata.pageCount} 页
                  </dd>
                </div>
              )}
              {parsedDocument.title && (
                <div>
                  <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                    标题
                  </dt>
                  <dd className="app-title mt-1 text-sm">{parsedDocument.title}</dd>
                </div>
              )}
              <div>
                <dt className="app-subtle font-mono text-xs uppercase tracking-wider">
                  字符数
                </dt>
                <dd className="app-title mt-1 text-sm">
                  {parsedDocument.plainText.length.toLocaleString()} 字符
                </dd>
              </div>
            </dl>
          ) : (
            <p className="app-muted text-sm">上传文档后显示详细信息</p>
          )}
        </div>

        <div className="app-panel border p-5">
          <h3 className="app-title mb-4 font-semibold">操作</h3>
          <div className="space-y-2">
            <button
              className="app-button-hot flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!parsedDocument}
              type="button"
            >
              <Send className="size-4" />
              发送到聊天
            </button>
            <button
              className="app-button-accent flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!parsedDocument}
              type="button"
            >
              <Save className="size-4" />
              保存到知识库
            </button>
          </div>
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
          </ul>
        </div>
      </div>
    </div>
  );
}
