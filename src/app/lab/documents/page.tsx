"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DocumentParserPanel } from "@/components/document-parser-panel";

export default function DocumentsPage() {
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
                AI Agent Lab
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                文档解析实验室
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                上传 PDF、DOCX 或 Markdown 文档，提取文本内容用于后续 RAG
                或分析流程。解析后的内容可以发送到聊天或保存到知识库。
              </p>
            </div>
            <div className="app-card-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Supported</p>
              <p className="app-accent mt-1 text-lg">PDF / DOCX / MD</p>
            </div>
          </div>
        </header>

        <section className="mt-5">
          <DocumentParserPanel />
        </section>
      </div>
    </main>
  );
}
