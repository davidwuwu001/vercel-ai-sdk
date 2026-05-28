import {
  ArrowLeft,
  AudioLines,
  Bot,
  Boxes,
  Braces,
  DatabaseZap,
  FileText,
  History,
  Image,
  Route,
  ScrollText,
  Wrench,
  Terminal,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

const modules = [
  {
    title: "Chat",
    status: "Active",
    href: "/",
    summary: "Streaming chat, model switching, multimodal message entry.",
    icon: Bot,
  },
  {
    title: "Structured",
    status: "Active",
    href: "/lab/structured",
    summary: "JSON schema output for audit, extraction, scoring, and forms.",
    icon: Braces,
  },
  {
    title: "Documents",
    status: "Active",
    href: "/lab/documents",
    summary: "Parse PDF, DOCX, Markdown, text, CSV, and JSON uploads.",
    icon: FileText,
  },
  {
    title: "Vector",
    status: "Active",
    href: "/lab/vector",
    summary: "Simple vector store with cosine similarity search.",
    icon: DatabaseZap,
  },
  {
    title: "Knowledge",
    status: "Active",
    href: "/lab/knowledge",
    summary: "Chunk documents, embed content, retrieve context, and answer.",
    icon: DatabaseZap,
  },
  {
    title: "Agents",
    status: "Active",
    summary: "Explore ToolLoopAgent and task-specific company agents.",
    icon: Boxes,
    href: "/lab/agents",
  },
  {
    title: "Media",
    status: "Active",
    href: "/lab/media",
    summary: "Image understanding, image generation, speech to text, and TTS.",
    icon: Image,
  },
  {
    title: "Models",
    status: "Active",
    href: "/lab/models",
    summary: "SQLite-backed model configs, API keys, capabilities, routing.",
    icon: Route,
  },
  {
    title: "Logs",
    status: "Active",
    href: "/lab/logs",
    summary: "Timing, errors, token usage, tool traces, and model comparisons.",
    icon: ScrollText,
  },
  {
    title: "Tools",
    status: "Active",
    href: "/lab/tools",
    summary: "Inspect tool calls, arguments, outputs, errors, and execution times.",
    icon: Wrench,
  },
  {
    title: "History",
    status: "Active",
    href: "/lab/history",
    summary: "Edit, delete, and regenerate messages in conversation history.",
    icon: History,
  },
  {
    title: "Voice",
    status: "Active",
    href: "/lab/voice",
    summary: "Mobile-style voice input and generated speech playback.",
    icon: AudioLines,
  },
  {
    title: "MCP",
    status: "Active",
    href: "/lab/mcp",
    summary: "Connect to MCP servers, access external tools ecosystem.",
    icon: Terminal,
  },
  {
    title: "Observability",
    status: "Active",
    href: "/lab/observability",
    summary: "Real-time traces, metrics, and performance dashboards.",
    icon: Eye,
  },
];

interface ModuleItem {
  title: string;
  status: string;
  href?: string | null;
  summary: string;
  icon: LucideIcon;
}

function ModuleCard({ item }: { item: ModuleItem }) {
  const content = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="app-icon-tile grid size-10 place-items-center border">
          <item.icon className="size-5" />
        </div>
        <span className="app-chip border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          {item.status}
        </span>
      </div>
      <h2 className="app-title text-lg font-semibold">{item.title}</h2>
      <p className="app-muted mt-2 text-sm leading-6">{item.summary}</p>
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="app-card block border p-4 transition hover:brightness-105">
        {content}
      </Link>
    );
  }

  return (
    <div className="app-card border p-4 opacity-60">
      {content}
    </div>
  );
}

export default function LabPage() {
  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/"
          >
            <ArrowLeft className="size-4" />
            Back to chat
          </Link>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Vercel AI SDK Lab
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                功能实验室路线图
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                这里用来系统探索 AI SDK 的核心能力：聊天、多模态、工具调用、结构化输出、RAG、正式 Agent、媒体生成和运行观测。
              </p>
            </div>
            <div className="app-card-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Status</p>
              <p className="app-accent mt-1 text-lg">Foundation ready</p>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {modules.map((item) => (
            <ModuleCard item={item} key={item.title} />
          ))}
        </section>
      </div>
    </main>
  );
}
