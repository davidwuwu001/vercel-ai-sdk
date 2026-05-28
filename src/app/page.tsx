"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Bot,
  BrainCircuit,
  DatabaseZap,
  FileUp,
  MessageSquarePlus,
  Moon,
  Orbit,
  Play,
  RadioTower,
  Search,
  Settings,
  Square,
  Sun,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MarkdownMessage } from "@/components/markdown-message";
import { ToolCallInfo, ToolCallStatus, ToolStreamPanel } from "@/components/tool-stream-panel";
import { useTheme } from "./theme-provider";

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  messages: UIMessage[];
};

type ModelOption = {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  enabled: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
};

const STORAGE_KEY = "neon-agent-lab:preferences";
const MAX_STORED_SESSIONS = 12;
const MAX_STORED_MESSAGES = 40;
const initialSession: ChatSession = {
  id: "initial-session",
  title: "Untitled agent session",
  createdAt: 0,
  messages: [],
};

const prompts = [
  "查一下北京正常使用的订单，并总结风险点。",
  "搜索老师资料审核规则，然后给我一份检查清单。",
  "帮我把“生成家长反馈”拆成 Agent 任务计划，风险等级 medium。",
  "现在几点？顺便说明你为什么需要调用工具。",
];

const capabilities = [
  { icon: RadioTower, label: "Streaming", value: "AI SDK UI stream" },
  { icon: DatabaseZap, label: "Tools", value: "订单 / 知识库 / 任务计划" },
  { icon: FileUp, label: "Multimodal", value: "图片与文档附件入口" },
  { icon: BrainCircuit, label: "Agentic", value: "最多 5 步工具循环" },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [sessions, setSessions] = useState<ChatSession[]>([initialSession]);
  const [activeId, setActiveId] = useState(initialSession.id);
  const [storageReady, setStorageReady] = useState(false);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) || sessions[0],
    [activeId, sessions],
  );

  const loadFromLocalStorage = useCallback(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const first = createSession();
      setSessions([first]);
      setActiveId(first.id);
      setStorageReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ChatSession[];
      const nextSessions = parsed.length ? sanitizeSessionsForStorage(parsed) : [createSession()];
      setSessions(nextSessions);
      setActiveId(nextSessions[0].id);
      setStorageReady(true);
    } catch {
      const first = createSession();
      setSessions([first]);
      setActiveId(first.id);
      setStorageReady(true);
    }
  }, []);

  // 从 API 加载会话列表
  useEffect(() => {
    async function loadSessions() {
      try {
        const response = await fetch("/api/chat-sessions");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.sessions?.length > 0) {
            const loadedSessions: ChatSession[] = data.sessions.map((s: { id: string; title: string; createdAt: string; updatedAt: string }) => ({
              id: s.id,
              title: s.title,
              createdAt: new Date(s.createdAt).getTime(),
              updatedAt: new Date(s.updatedAt).getTime(),
              messages: [],
            }));
            setSessions(loadedSessions);
            setActiveId(loadedSessions[0].id);
            setStorageReady(true);
          } else {
            // 没有会话，创建一个新的
            const first = createSession();
            setSessions([first]);
            setActiveId(first.id);
            setStorageReady(true);
          }
        } else {
          // API 不可用，使用 localStorage
          loadFromLocalStorage();
        }
      } catch {
        // API 不可用，使用 localStorage
        loadFromLocalStorage();
      }
    }

    loadSessions();
  }, [loadFromLocalStorage]);

  // 保存到 localStorage 作为备份
  useEffect(() => {
    if (!storageReady) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(sanitizeSessionsForStorage(sessions)),
      );
    }, 900);

    return () => window.clearTimeout(timer);
  }, [sessions, storageReady]);

  async function createNewSession() {
    const session = createSession();
    
    // 尝试通过 API 创建
    try {
      const response = await fetch("/api/chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          session.createdAt = new Date(data.session.createdAt).getTime();
        }
      }
    } catch {
      // API 不可用，继续使用本地创建
    }
    
    setSessions((current) => [session, ...current]);
    setActiveId(session.id);
  }

  async function deleteSession(id: string) {
    // 尝试通过 API 删除
    try {
      await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    } catch {
      // API 不可用，继续本地删除
    }
    
    setSessions((current) => {
      const rest = current.filter((session) => session.id !== id);
      const next = rest.length ? rest : [createSession()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function clearLocalSessions() {
    const session = createSession();
    window.localStorage.removeItem(STORAGE_KEY);
    setSessions([session]);
    setActiveId(session.id);
    setStorageReady(true);
  }

  const updateSessionMessages = useCallback(function updateSessionMessages(
    id: string,
    messages: UIMessage[],
  ) {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== id) return session;
        if (session.messages === messages) return session;
        return {
          ...session,
          title: titleFromMessages(messages) || session.title,
          messages,
        };
      }),
    );
  }, []);

  return (
    <main className="app-shell h-screen h-dvh overflow-hidden">
      <div className="relative grid h-screen h-dvh min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="app-panel z-10 min-h-0 border-b lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex min-h-0 flex-col gap-3 p-3 sm:p-4 lg:h-full lg:gap-0 lg:p-5">
            <div className="flex items-center gap-3 lg:mb-6">
              <div className="app-icon-tile hidden size-10 shrink-0 place-items-center border sm:grid lg:size-11">
                <Orbit className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="app-hot font-mono text-[10px] uppercase tracking-[0.24em] lg:text-xs lg:tracking-[0.34em]">
                  Vercel AI SDK
                </p>
                <h1 className="app-title truncate text-lg font-semibold lg:text-xl">
                  Neon Agent Lab
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 lg:block">
              <button
                className="app-button-hot flex h-9 items-center justify-center gap-1 border px-2 font-mono text-[11px] lg:mb-3 lg:h-11 lg:gap-2 lg:px-4 lg:text-sm"
                onClick={createNewSession}
              >
                <MessageSquarePlus className="size-4" />
                新建
              </button>

              <Link
                className="app-button-accent flex h-9 items-center justify-center gap-1 border px-2 font-mono text-[11px] lg:mb-3 lg:h-11 lg:gap-2 lg:px-4 lg:text-sm"
                href="/admin/models"
              >
                <Settings className="size-4" />
                模型
              </Link>

              <Link
                className="app-button-accent flex h-9 items-center justify-center gap-1 border px-2 font-mono text-[11px] lg:mb-3 lg:h-11 lg:gap-2 lg:px-4 lg:text-sm"
                href="/lab"
              >
                <BrainCircuit className="size-4" />
                实验
              </Link>

              <button
                className="app-panel-soft flex h-9 items-center justify-center gap-1 border px-2 font-mono text-[11px] lg:mb-5 lg:h-11 lg:gap-2 lg:px-4 lg:text-sm"
                onClick={toggleTheme}
                type="button"
              >
                {/* Use CSS to show correct icon based on theme attribute */}
                <span className="theme-toggle-icon">
                  <Moon className="size-4 moon-icon" />
                  <Sun className="size-4 sun-icon" />
                </span>
                <span suppressHydrationWarning>{theme === "day" ? "夜间" : "白天"}</span>
              </button>

              <button
                className="app-panel-soft col-span-2 flex h-9 items-center justify-center gap-1 border px-2 font-mono text-[11px] sm:col-span-1 lg:mb-5 lg:h-10 lg:gap-2 lg:px-4 lg:text-xs"
                onClick={clearLocalSessions}
                type="button"
              >
                <Trash2 className="size-4" />
                清缓存
              </button>
            </div>

            <div className="mb-5 hidden grid-cols-2 gap-2 lg:grid">
              {capabilities.map((item) => (
                <div
                  className="app-card border p-3"
                  key={item.label}
                >
                  <item.icon className="app-accent mb-2 size-4" />
                  <p className="app-accent font-mono text-[11px]">
                    {item.label}
                  </p>
                  <p className="app-muted mt-1 text-xs">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex min-h-0 gap-2 overflow-x-auto lg:flex-1 lg:flex-col lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-1 lg:pr-1">
              {sessions.map((session) => (
                <button
                  className={`group flex min-w-32 items-start justify-between border px-3 py-2 text-left lg:w-full lg:min-w-0 lg:py-3 ${
                    session.id === activeSession.id
                      ? "app-card-active"
                      : "app-card"
                  }`}
                  key={session.id}
                  onClick={() => setActiveId(session.id)}
                >
                  <span className="min-w-0">
                    <span className="app-title block truncate text-xs lg:text-sm">
                      {session.title}
                    </span>
                    <span className="app-subtle mt-1 hidden font-mono text-[11px] sm:block">
                      {session.createdAt
                        ? new Date(session.createdAt).toLocaleString("zh-CN")
                        : "local draft"}
                    </span>
                  </span>
                  <span
                    className="app-subtle ml-2 grid size-7 place-items-center opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSession(session.id);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <Trash2 className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {activeSession ? (
          <ChatPanel
            key={activeSession.id}
            session={activeSession}
            onMessagesChange={updateSessionMessages}
          />
        ) : null}
      </div>
    </main>
  );
}

function ChatPanel({
  session,
  onMessagesChange,
}: {
  session: ChatSession;
  onMessagesChange: (id: string, messages: UIMessage[]) => void;
}) {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, regenerate, error, clearError } =
    useChat({
      id: session.id,
      messages: session.messages,
      experimental_throttle: 120,
      onFinish: ({ messages: finishedMessages }) => {
        onMessagesChange(session.id, finishedMessages);
      },
    });
  const isRunning = status === "submitted" || status === "streaming";
  const selectedModel = modelOptions.find(
    (model) => model.id === selectedModelId,
  );

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/models");
      const data = (await response.json()) as { models?: ModelOption[] };
      const enabledModels = (data.models || []).filter((model) => model.enabled);
      setModelOptions(enabledModels);
      setSelectedModelId((current) => {
        if (current && enabledModels.some((model) => model.id === current)) {
          return current;
        }

        return (
          enabledModels.find((model) => model.isDefault)?.id ||
          enabledModels[0]?.id ||
          null
        );
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, status]);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = input.trim();
    const files = fileInputRef.current?.files;
    if (!text && !files?.length) return;

    setInput("");
    setSelectedFiles([]);
    await sendMessage({
      text: text || "请分析我上传的附件。",
      files: files?.length ? files : undefined,
    }, {
      body: {
        modelConfigId: selectedModelId ?? undefined,
      },
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="app-panel shrink-0 border-b px-3 py-3 md:px-8 md:py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="app-accent mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] md:mb-2 md:text-xs md:tracking-[0.26em]">
              <Terminal className="size-4" />
              Agent Workspace
            </div>
            <h2 className="app-title text-base font-semibold md:text-3xl">
              流式对话 + Tool Calling + 多模态入口
            </h2>
          </div>
          <div className="hidden grid-cols-2 gap-2 sm:grid md:grid-cols-4">
            {["Ark", "Next.js", "AI SDK v6", "Tools"].map((item) => (
              <span
                className="app-chip border px-3 py-2 text-center font-mono text-xs"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto grid max-w-5xl gap-5 py-8 lg:grid-cols-[1.2fr_.8fr]">
            <div className="app-panel border p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="app-invert-tile grid size-10 place-items-center">
                  <Bot className="size-5" />
                </div>
                <div>
                  <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                    Prototype Ready
                  </p>
                  <h3 className="app-title text-xl font-semibold">
                    这是一个可扩展的公司级 Agent 原型
                  </h3>
                </div>
              </div>
              <p className="app-muted max-w-2xl text-sm leading-7">
                后端通过 Vercel AI SDK 连接火山引擎 OpenAI-compatible
                接口，支持流式输出、工具调用循环、附件输入入口和本地会话保存。工具现在接的是
                mock 数据，后续可以替换成汤仔助手订单、服务日历、飞书和知识库 API。
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {prompts.map((prompt) => (
                  <button
                    className="app-card border p-4 text-left text-sm transition hover:brightness-105"
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <div className="app-panel-soft border p-6">
              <p className="app-hot mb-4 font-mono text-xs uppercase tracking-[0.28em]">
                Try Tool Calling
              </p>
              <div className="app-muted space-y-3 text-sm">
                <p className="flex gap-2">
                  <Zap className="app-accent mt-1 size-4 shrink-0" />
                  问“现在几点”会触发时间工具。
                </p>
                <p className="flex gap-2">
                  <DatabaseZap className="app-accent mt-1 size-4 shrink-0" />
                  问“查北京订单”会触发订单查询工具。
                </p>
                <p className="flex gap-2">
                  <Search className="app-accent mt-1 size-4 shrink-0" />
                  问“SOP / 审核规则”会触发知识库检索工具。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="mx-4 mb-3 border border-rose-300/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100 md:mx-8">
          <div className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            <button className="font-mono text-xs underline" onClick={clearError}>
              clear
            </button>
          </div>
        </div>
      ) : null}

      <form
        className="app-panel shrink-0 border-t p-3 md:px-8 md:py-4"
        onSubmit={submit}
      >
        <div className="mx-auto max-w-5xl">
          {selectedFiles.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file) => (
                <span
                  className="app-chip border px-2 py-1 font-mono text-xs"
                  key={`${file.name}-${file.size}`}
                >
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mb-2 grid gap-2 md:mb-3 md:grid-cols-[minmax(220px,360px)_1fr] md:items-center">
            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 md:block">
              <span className="app-subtle font-mono text-[11px] uppercase tracking-[0.18em]">
                Model
              </span>
              <select
                className="app-input h-10 w-full border px-3 text-sm outline-none md:mt-1"
                disabled={isRunning || modelOptions.length === 0}
                onChange={(event) =>
                  setSelectedModelId(Number(event.target.value) || null)
                }
                value={selectedModelId || ""}
              >
                {modelOptions.length === 0 ? (
                  <option value="">暂无可用模型</option>
                ) : null}
                {modelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {model.isDefault ? " / default" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="app-subtle hidden text-xs leading-5 md:block">
              {selectedModel ? (
                <>
                  当前使用{" "}
                  <span className="app-accent font-mono">
                    {selectedModel.modelId}
                  </span>
                  ，Key 来源：
                  {selectedModel.hasApiKey ? "后台已保存" : "环境变量"}
                </>
              ) : (
                "请先到模型管理后台启用至少一个模型。"
              )}
            </div>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 md:gap-3">
            <label className="app-button-accent grid h-12 cursor-pointer place-items-center border px-4 transition">
              <FileUp className="size-5" />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.txt,.md,.csv,.json"
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files || []))
                }
              />
            </label>
            <textarea
              className="app-input min-h-12 resize-none border px-4 py-3 text-sm leading-6 outline-none transition"
              placeholder="输入任务，例如：查一下北京正常使用的订单，并生成风险摘要..."
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            {isRunning ? (
              <button
                className="flex h-12 items-center justify-center gap-2 border border-rose-300/40 bg-rose-400/10 px-3 font-mono text-xs text-rose-100 md:px-5 md:text-sm"
                type="button"
                onClick={() => void stop()}
              >
                <Square className="size-4" />
                <span className="hidden sm:inline">STOP</span>
              </button>
            ) : (
              <button
                className="app-button-hot flex h-12 items-center justify-center gap-2 border px-3 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-40 md:px-5 md:text-sm"
                disabled={!input.trim() && selectedFiles.length === 0}
                type="submit"
              >
                <Play className="size-4" />
                <span className="hidden sm:inline">RUN</span>
              </button>
            )}
          </div>

          <div className="app-subtle mt-3 hidden flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.18em] sm:flex">
            <span>Enter 发送 / Shift+Enter 换行</span>
            <button
              className="app-accent disabled:opacity-45"
              disabled={!messages.length || isRunning}
              onClick={() =>
                void regenerate({
                  body: {
                    modelConfigId: selectedModelId ?? undefined,
                  },
                })
              }
              type="button"
            >
              Regenerate last response
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  // 计算工具调用步骤
  const toolSteps = message.parts
    .map((part, idx) => (part.type.startsWith("tool-") ? idx + 1 : -1))
    .filter((idx) => idx !== -1);

  return (
    <article
      className={`message-bubble flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser ? (
        <div className="app-icon-tile mt-1 grid size-9 shrink-0 place-items-center border">
          <Bot className="size-4" />
        </div>
      ) : null}
      <div
        className={`max-w-[min(820px,100%)] border px-4 py-3 ${
          isUser
            ? "app-button-hot"
            : "app-card"
        }`}
      >
        <div className="app-subtle mb-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          {isUser ? "Operator" : "Agent"}
        </div>
        <div className="space-y-3">
          {message.parts.map((part, index) => {
            const isToolPart = part.type.startsWith("tool-");
            const toolStepIndex = isToolPart
              ? toolSteps.indexOf(index + 1) + 1
              : undefined;
            return (
              <MessagePartView
                key={`${message.id}-${index}`}
                part={part}
                step={toolStepIndex}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}

function MessagePartView({ part, step }: { part: UIMessage["parts"][number]; step?: number }) {
  if (part.type === "text") {
    return <MarkdownMessage content={part.text} />;
  }

  if (part.type === "file") {
    const isImage = part.mediaType.startsWith("image/");
    return (
      <div className="app-panel-soft border p-3">
        <div className="app-accent mb-2 flex items-center gap-2 font-mono text-xs">
          <FileUp className="size-4" />
          {part.filename || part.mediaType}
        </div>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={part.filename || "uploaded image"}
            className="max-h-72 border object-contain"
            src={part.url}
          />
        ) : (
          <p className="app-muted text-sm">{part.mediaType}</p>
        )}
      </div>
    );
  }

  if (part.type.startsWith("tool-")) {
    return <ToolPartView part={part} step={step} />;
  }

  if (part.type === "reasoning") {
    return (
      <details className="border border-yellow-300/20 bg-yellow-300/5 p-3">
        <summary className="cursor-pointer font-mono text-xs text-yellow-100">
          reasoning
        </summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-yellow-50/80">
          {part.text}
        </p>
      </details>
    );
  }

  return (
    <pre className="app-panel-soft overflow-x-auto border p-3 text-xs">
      {JSON.stringify(part, null, 2)}
    </pre>
  );
}

function ToolPartView({ part, step }: { part: UIMessage["parts"][number]; step?: number }) {
  const record = part as unknown as Record<string, unknown>;
  const toolName = String(record.type || "tool").replace("tool-", "");
  const state = typeof record.state === "string" ? record.state : "running";
  const output = record.output;
  const input = record.input;

  const status: ToolCallStatus = state === "output-available" ? "success" : state === "error" ? "error" : "running";

  const toolCall: ToolCallInfo = {
    toolName,
    status,
    input,
    output,
    error: record.error as string | undefined,
    startTime: typeof record.startTime === "number" ? record.startTime : undefined,
    endTime: typeof record.endTime === "number" ? record.endTime : undefined,
  };

  return (
    <ToolStreamPanel
      step={step || 1}
      toolCall={toolCall}
    />
  );
}

function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(16).slice(2)}`,
    title: "Untitled agent session",
    createdAt: now,
    messages: [],
  };
}

function titleFromMessages(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts.find((part) => part.type === "text");
  if (!text || text.type !== "text") return "";
  return text.text.slice(0, 32) || "";
}

function sanitizeSessionsForStorage(sessions: ChatSession[]) {
  return sessions.slice(0, MAX_STORED_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages
      .slice(-MAX_STORED_MESSAGES)
      .map(sanitizeMessageForStorage),
  }));
}

function sanitizeMessageForStorage(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "file") return part;

      return {
        ...part,
        url: part.url.startsWith("data:") ? "" : part.url,
      };
    }),
  };
}
