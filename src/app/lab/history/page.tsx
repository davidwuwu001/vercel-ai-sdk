"use client";

import { ArrowLeft, Clock, Search } from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
          href="/lab"
        >
          <ArrowLeft className="size-4" />
          Back to Lab
        </Link>

        <header className="app-panel border p-5 md:p-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="app-icon-tile grid size-12 place-items-center border">
              <Clock className="size-6" />
            </div>
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Chat History
              </p>
              <h1 className="app-title mt-1 text-3xl font-semibold">对话历史</h1>
            </div>
          </div>
          <p className="app-muted text-sm leading-7">
            历史模块用于查看和管理过往的对话记录，支持对话搜索和导出。此功能正在开发中。
          </p>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="app-card border p-5 opacity-60">
            <div className="app-accent mb-3 font-mono text-xs uppercase tracking-[0.18em]">
              Phase 2
            </div>
            <h2 className="app-title text-lg font-semibold">SQLite 持久化</h2>
            <p className="app-muted mt-2 text-sm">
              将对话会话和消息存储到 SQLite，支持跨会话持久化。
            </p>
          </article>

          <article className="app-card border p-5 opacity-60">
            <div className="app-accent mb-3 font-mono text-xs uppercase tracking-[0.18em]">
              Phase 2
            </div>
            <h2 className="app-title text-lg font-semibold">会话搜索</h2>
            <p className="app-muted mt-2 text-sm">
              按时间、关键词或内容搜索历史对话记录。
            </p>
          </article>

          <article className="app-card border p-5 opacity-60">
            <div className="app-accent mb-3 font-mono text-xs uppercase tracking-[0.18em]">
              Phase 2
            </div>
            <h2 className="app-title text-lg font-semibold">对话导出</h2>
            <p className="app-muted mt-2 text-sm">
              支持 Markdown、JSON 等格式导出对话记录。
            </p>
          </article>

          <article className="app-card border p-5 opacity-60">
            <div className="app-accent mb-3 font-mono text-xs uppercase tracking-[0.18em]">
              Phase 2
            </div>
            <h2 className="app-title text-lg font-semibold">会话管理</h2>
            <p className="app-muted mt-2 text-sm">
              重命名、合并、删除会话，管理会话标签。
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
