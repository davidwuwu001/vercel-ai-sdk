"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  Database,
  Eye,
  FileText,
  Globe,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Sun,
  Trash2,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../theme-provider";

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
  gatewayTokenEnv: string;
  fallbackModelIds: string;
  hasGatewayConfig: boolean;
  supportsVision: boolean;
  supportsFiles: boolean;
  isDefault: boolean;
  enabled: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ModelFormState = Omit<
  ModelConfig,
  "id" | "hasApiKey" | "hasGatewayConfig" | "createdAt" | "updatedAt"
> & {
  apiKey: string;
  clearApiKey: boolean;
};

const emptyForm: ModelFormState = {
  name: "",
  provider: "volcengine",
  strategy: "direct",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  modelId: "",
  apiKeyEnv: "VOLCENGINE_API_KEY",
  apiKey: "",
  clearApiKey: false,
  gatewaySlug: "",
  gatewayTokenEnv: "VERCEL_GATEWAY_TOKEN",
  fallbackModelIds: "",
  supportsVision: false,
  supportsFiles: false,
  isDefault: false,
  enabled: true,
  notes: "",
};

const PROVIDER_PRESETS: Record<
  string,
  { baseUrl: string; apiKeyEnv: string; strategy: "direct" | "gateway" }
> = {
  volcengine: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyEnv: "VOLCENGINE_API_KEY",
    strategy: "direct",
  },
  bailian: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    strategy: "direct",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    strategy: "direct",
  },
  gateway: {
    baseUrl: "https://gateway.ai.cloudflare.com",
    apiKeyEnv: "",
    strategy: "gateway",
  },
};

export default function ModelAdminPage() {
  const { theme, toggleTheme } = useTheme();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ModelFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  const editingModel = useMemo(
    () => models.find((model) => model.id === editingId),
    [editingId, models],
  );

  const selectModel = useCallback(function selectModel(model: ModelConfig) {
    setEditingId(model.id);
    setForm({
      name: model.name,
      provider: model.provider,
      strategy: model.strategy,
      baseUrl: model.baseUrl,
      modelId: model.modelId,
      apiKeyEnv: model.apiKeyEnv,
      apiKey: "",
      clearApiKey: false,
      gatewaySlug: model.gatewaySlug,
      gatewayTokenEnv: model.gatewayTokenEnv,
      fallbackModelIds: model.fallbackModelIds,
      supportsVision: model.supportsVision,
      supportsFiles: model.supportsFiles,
      isDefault: model.isDefault,
      enabled: model.enabled,
      notes: model.notes,
    });
  }, []);

  const loadModels = useCallback(
    async function loadModels({ selectFirst = false } = {}) {
      setLoading(true);
      try {
        const response = await fetch("/api/models");
        const data = await response.json();
        setModels(data.models || []);
        if (selectFirst && data.models?.[0]) {
          selectModel(data.models[0]);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectModel],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModels({ selectFirst: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadModels]);

  function createNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setMessage("");
  }

  function applyProviderPreset(provider: string) {
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setForm({
        ...form,
        provider,
        strategy: preset.strategy,
        baseUrl: preset.baseUrl,
        apiKeyEnv: preset.apiKeyEnv,
      });
    } else {
      setForm({ ...form, provider });
    }
  }

  async function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/models/${editingId}` : "/api/models",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "保存失败");
      setMessage("模型配置已保存");
      await loadModels();
      if (data.model) selectModel(data.model);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function testModelConnection() {
    if (!editingId) {
      setMessage("请先保存模型配置，再进行连接测试。");
      return;
    }

    setTesting(true);
    setMessage("正在测试模型连接...");
    try {
      const response = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelConfigId: editingId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "模型连接测试失败");
      setMessage(`连接正常 · ${data.provider}/${data.modelId} · ${data.latencyMs}ms · ${data.text}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型连接测试失败");
    } finally {
      setTesting(false);
    }
  }

  async function deleteModel() {
    if (!editingId) return;
    if (!window.confirm("确定删除这个模型配置？")) return;

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/models/${editingId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "删除失败");
      setMessage("模型配置已删除");
      setEditingId(null);
      setForm({ ...emptyForm });
      await loadModels({ selectFirst: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="cyber-grid" />
      <div className="scanline" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 md:px-6">
        <header className="app-panel mb-5 flex flex-col gap-4 border p-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              className="app-accent mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Back to Agent Lab
            </Link>
            <h1 className="app-title text-2xl font-semibold md:text-3xl">
              模型配置管理后台
            </h1>
            <p className="app-muted mt-2 max-w-2xl text-sm leading-6">
              配置会保存到本地 SQLite。生产环境建议只保存环境变量名；本地实验可临时保存 API Key。
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <button
              className="app-panel-soft flex h-10 items-center justify-center gap-2 border px-4 font-mono text-xs transition hover:brightness-105"
              onClick={toggleTheme}
              type="button"
            >
              <span className="theme-toggle-icon">
                <Moon className="size-4 moon-icon" />
                <Sun className="size-4 sun-icon" />
              </span>
              <span suppressHydrationWarning>{theme === "day" ? "夜间" : "白天"}</span>
            </button>
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <Stat label="Models" value={String(models.length)} />
              <Stat
                label="Default"
                value={models.find((m) => m.isDefault)?.name || "-"}
              />
              <Stat label="DB" value="SQLite" />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[360px_1fr]">
          <section className="app-panel border p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="app-accent flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em]">
                <Database className="size-4" />
                Local Models
              </div>
              <button
                className="app-button-accent grid size-9 place-items-center border"
                onClick={() => void loadModels()}
                type="button"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <button
              className="app-button-hot mb-4 flex h-11 w-full items-center justify-center gap-2 border font-mono text-sm"
              onClick={createNew}
              type="button"
            >
              <Plus className="size-4" />
              新增模型
            </button>

            <div className="space-y-2">
              {models.map((model) => (
                <button
                  className={`w-full border p-3 text-left transition ${
                    model.id === editingId
                      ? "app-card-active"
                      : "app-card hover:brightness-105"
                  }`}
                  key={model.id}
                  onClick={() => selectModel(model)}
                  type="button"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="app-title truncate text-sm font-medium">
                      {model.name}
                    </span>
                    {model.isDefault ? (
                      <span className="border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 font-mono text-[10px] text-emerald-100">
                        DEFAULT
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="app-accent truncate font-mono text-xs">
                      {model.modelId}
                    </span>
                    {model.strategy === "gateway" && (
                      <Globe className="size-3 text-cyan-400" />
                    )}
                  </div>
                  <p className="app-subtle mt-1 truncate text-xs">
                    {model.baseUrl}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="app-panel border p-5 backdrop-blur-xl">
            <form className="grid gap-5" onSubmit={saveModel}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="app-hot font-mono text-xs uppercase tracking-[0.22em]">
                    {editingModel ? `Editing #${editingModel.id}` : "Create Model"}
                  </p>
                  <h2 className="app-title mt-1 text-xl font-semibold">
                    {editingModel?.name || "新的模型配置"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingId ? (
                    <button
                      className="app-button-accent flex h-10 items-center gap-2 border px-4 font-mono text-sm"
                      disabled={saving || testing}
                      onClick={() => void testModelConnection()}
                      type="button"
                    >
                      <Wifi className={`size-4 ${testing ? "animate-pulse" : ""}`} />
                      测试连接
                    </button>
                  ) : null}
                  {editingId ? (
                    <button
                      className="flex h-10 items-center gap-2 border border-rose-300/40 bg-rose-400/10 px-4 font-mono text-sm text-rose-100"
                      disabled={saving || testing}
                      onClick={() => void deleteModel()}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                      删除
                    </button>
                  ) : null}
                  <button
                    className="app-button-accent flex h-10 items-center gap-2 border px-4 font-mono text-sm"
                    disabled={saving || testing}
                    type="submit"
                  >
                    <Save className="size-4" />
                    保存
                  </button>
                </div>
              </div>

              {message ? (
                <div className="app-card-active border px-4 py-3 text-sm">
                  {message}
                </div>
              ) : null}

              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <h3 className="app-accent mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em]">
                  <Globe className="size-4" />
                  连接方式
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="app-muted mb-2 block font-mono text-xs uppercase tracking-[0.18em]">
                      路由策略
                    </label>
                    <div className="flex gap-2">
                      <button
                        className={`flex flex-1 items-center justify-center gap-2 border px-4 py-2 font-mono text-sm transition ${
                          form.strategy === "direct"
                            ? "app-card-active border-cyan-500/50"
                            : "app-card hover:brightness-105"
                        }`}
                        onClick={() => setForm({ ...form, strategy: "direct" })}
                        type="button"
                      >
                        <Globe className="size-4" />
                        Direct
                      </button>
                      <button
                        className={`flex flex-1 items-center justify-center gap-2 border px-4 py-2 font-mono text-sm transition ${
                          form.strategy === "gateway"
                            ? "app-card-active border-cyan-500/50"
                            : "app-card hover:brightness-105"
                        }`}
                        onClick={() => setForm({ ...form, strategy: "gateway" })}
                        type="button"
                      >
                        <Globe className="size-4" />
                        Gateway
                      </button>
                    </div>
                  </div>
                  <Field label="Provider 预设">
                    <select
                      className="field-input"
                      value={form.provider}
                      onChange={(e) => applyProviderPreset(e.target.value)}
                    >
                      <option value="volcengine">火山引擎 Ark</option>
                      <option value="bailian">阿里云百炼</option>
                      <option value="openai">OpenAI</option>
                      <option value="gateway">Vercel Gateway</option>
                    </select>
                  </Field>
                </div>

                {form.strategy === "gateway" ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field
                      hint="Vercel AI Gateway URL"
                      label="Gateway Base URL"
                    >
                      <input
                        className="field-input"
                        value={form.baseUrl}
                        onChange={(e) =>
                          setForm({ ...form, baseUrl: e.target.value })
                        }
                        placeholder="https://gateway.ai.cloudflare.com"
                      />
                    </Field>
                    <Field
                      hint="Gateway slug 标识符"
                      label="Gateway Slug"
                    >
                      <input
                        className="field-input"
                        value={form.gatewaySlug}
                        onChange={(e) =>
                          setForm({ ...form, gatewaySlug: e.target.value })
                        }
                        placeholder="my-gateway"
                      />
                    </Field>
                    <Field
                      hint="Token 环境变量名"
                      label="Gateway Token Env"
                    >
                      <input
                        className="field-input font-mono"
                        value={form.gatewayTokenEnv}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            gatewayTokenEnv: e.target.value.trim().toUpperCase(),
                          })
                        }
                        placeholder="VERCEL_GATEWAY_TOKEN"
                      />
                    </Field>
                    <Field
                      hint="备用模型 ID，逗号分隔"
                      label="Fallback Model IDs"
                    >
                      <input
                        className="field-input"
                        value={form.fallbackModelIds}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fallbackModelIds: e.target.value,
                          })
                        }
                        placeholder="model-1, model-2"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="模型名称">
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Volcengine Doubao Pro"
                    required
                  />
                </Field>
                <Field label="模型 / Endpoint ID">
                  <input
                    className="field-input"
                    value={form.modelId}
                    onChange={(event) =>
                      setForm({ ...form, modelId: event.target.value })
                    }
                    placeholder="doubao-seed-1-6-250615"
                    required
                  />
                </Field>
                {form.strategy === "direct" ? (
                  <>
                    <Field label="Base URL">
                      <input
                        className="field-input"
                        value={form.baseUrl}
                        onChange={(event) =>
                          setForm({ ...form, baseUrl: event.target.value })
                        }
                        placeholder="https://ark.cn-beijing.volces.com/api/v3"
                        required
                      />
                    </Field>
                    <Field
                      hint="这里只填变量名，例如 VOLCENGINE_API_KEY。真实 API Key 建议写到 .env.local。"
                      label="API Key 环境变量名"
                    >
                      <input
                        className="field-input font-mono"
                        value={form.apiKeyEnv}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            apiKeyEnv: event.target.value.trim().toUpperCase(),
                          })
                        }
                        placeholder="VOLCENGINE_API_KEY"
                        pattern="[A-Z][A-Z0-9_]*"
                        required
                      />
                    </Field>
                    <Field
                      hint={
                        editingModel?.hasApiKey
                          ? "已保存过 API Key。留空表示不修改；输入新 Key 会覆盖；勾选清除会删除已保存 Key。"
                          : "本地实验可以直接保存 API Key；生产环境建议改为只使用环境变量。"
                      }
                      label="直接保存 API Key"
                    >
                      <input
                        autoComplete="new-password"
                        className="field-input font-mono"
                        value={form.apiKey}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            apiKey: event.target.value,
                            clearApiKey: false,
                          })
                        }
                        placeholder={
                          editingModel?.hasApiKey ? "已保存，留空不修改" : "sk-..."
                        }
                        type="password"
                      />
                      {editingModel?.hasApiKey ? (
                        <label className="app-subtle mt-2 flex items-center gap-2 text-xs">
                          <input
                            checked={form.clearApiKey}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                clearApiKey: event.target.checked,
                                apiKey: "",
                              })
                            }
                            type="checkbox"
                          />
                          清除已保存的 API Key
                        </label>
                      ) : null}
                    </Field>
                  </>
                ) : null}
                <Field label="能力标签">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Toggle
                      active={form.supportsVision}
                      icon={<Eye className="size-4" />}
                      label="支持识图"
                      onClick={() =>
                        setForm({
                          ...form,
                          supportsVision: !form.supportsVision,
                        })
                      }
                    />
                    <Toggle
                      active={form.supportsFiles}
                      icon={<FileText className="size-4" />}
                      label="支持文件"
                      onClick={() =>
                        setForm({ ...form, supportsFiles: !form.supportsFiles })
                      }
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Toggle
                  active={form.isDefault}
                  icon={<Check className="size-4" />}
                  label="设为默认聊天模型"
                  onClick={() => setForm({ ...form, isDefault: !form.isDefault })}
                />
                <Toggle
                  active={form.enabled}
                  icon={<Bot className="size-4" />}
                  label="启用这个模型"
                  onClick={() => setForm({ ...form, enabled: !form.enabled })}
                />
              </div>

              <Field label="备注">
                <textarea
                  className="field-input min-h-28 resize-y"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="记录用途、模型特点、价格、上下文窗口或注意事项。"
                />
              </Field>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  hint,
  label,
  children,
}: {
  hint?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="app-muted mb-2 block font-mono text-xs uppercase tracking-[0.18em]">
        {label}
      </span>
      {children}
      {hint ? <span className="app-subtle mt-2 block text-xs">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-11 items-center justify-center gap-2 border px-4 font-mono text-sm transition ${
        active
          ? "app-card-active"
          : "app-card app-muted hover:brightness-105"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-chip min-w-24 border px-3 py-2">
      <p className="app-subtle text-[10px] uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-1 truncate">{value}</p>
    </div>
  );
}
