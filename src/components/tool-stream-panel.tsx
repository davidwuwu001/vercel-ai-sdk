"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

/** 工具调用状态 */
export type ToolCallStatus = "pending" | "running" | "success" | "error";

/** 工具调用信息 */
export interface ToolCallInfo {
  toolName: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startTime?: number;
  endTime?: number;
}

/** 工具调用步骤 */
export interface ToolCallStep {
  step: number;
  toolCall: ToolCallInfo;
}

/** 工具调用可视化组件属性 */
interface ToolStreamPanelProps {
  step: number;
  toolCall: ToolCallInfo;
  totalSteps?: number;
}

/** 状态图标映射 */
const StatusIcon = ({ status }: { status: ToolCallStatus }) => {
  switch (status) {
    case "pending":
      return <Circle className="size-4 text-yellow-300/60" />;
    case "running":
      return <Loader2 className="size-4 animate-spin text-blue-400" />;
    case "success":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    case "error":
      return <XCircle className="size-4 text-rose-400" />;
  }
};

/** 状态文字映射 */
const StatusText = ({ status }: { status: ToolCallStatus }) => {
  switch (status) {
    case "pending":
      return <span className="text-yellow-300/60">pending</span>;
    case "running":
      return <span className="text-blue-400">running</span>;
    case "success":
      return <span className="text-emerald-400">success</span>;
    case "error":
      return <span className="text-rose-400">error</span>;
  }
};

/** 可折叠的 JSON 展示组件 */
function CollapsibleJson({
  data,
  label,
  defaultOpen = false,
}: {
  data?: unknown;
  label: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (data === undefined) {
    return null;
  }

  return (
    <div className="border border-cyan-400/10 rounded">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cyan-400/5"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-cyan-400/60" />
        ) : (
          <ChevronRight className="size-4 text-cyan-400/60" />
        )}
        <span className="font-mono text-xs text-cyan-300/80">{label}</span>
        <span className="ml-auto font-mono text-[10px] text-cyan-300/40">
          {isOpen ? "hide" : "show"}
        </span>
      </button>
      {isOpen && (
        <pre className="max-h-64 overflow-auto border-t border-cyan-400/10 bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-cyan-100/70">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** 工具调用可视化面板 */
export function ToolStreamPanel({ step, toolCall, totalSteps = 1 }: ToolStreamPanelProps) {
  const durationMs = toolCall.endTime && toolCall.startTime
    ? toolCall.endTime - toolCall.startTime
    : undefined;

  return (
    <div className="tool-stream-panel border border-emerald-400/25 bg-emerald-400/5">
      {/* 头部 - 时间线步骤和状态 */}
      <div className="flex items-center gap-3 border-b border-emerald-400/15 px-4 py-3">
        {/* 时间线指示器 */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 font-mono text-xs text-emerald-300">
            {step}
          </div>
          {totalSteps > 1 && (
            <span className="font-mono text-[10px] text-emerald-300/50">
              / {totalSteps}
            </span>
          )}
        </div>

        {/* 工具图标和名称 */}
        <Wrench className="size-4 text-emerald-400/70" />
        <span className="font-mono text-sm font-medium text-emerald-200">
          {toolCall.toolName}
        </span>

        {/* 状态指示器 */}
        <div className="ml-auto flex items-center gap-2">
          <StatusIcon status={toolCall.status} />
          <StatusText status={toolCall.status} />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="space-y-2 px-4 py-3">
        {/* 输入参数 */}
        {toolCall.input !== undefined && (
          <CollapsibleJson data={toolCall.input} label="Parameters" />
        )}

        {/* 错误信息 */}
        {toolCall.error && (
          <div className="border border-rose-400/30 bg-rose-400/10">
            <div className="flex items-center gap-2 px-3 py-2">
              <XCircle className="size-4 text-rose-400" />
              <span className="font-mono text-xs text-rose-300">Error</span>
            </div>
            <pre className="border-t border-rose-400/20 px-3 py-2 font-mono text-xs text-rose-200/80">
              {toolCall.error}
            </pre>
          </div>
        )}

        {/* 输出结果 */}
        {toolCall.output !== undefined && (
          <CollapsibleJson data={toolCall.output} label="Result" defaultOpen />
        )}
      </div>

      {/* 底部 - 执行时间 */}
      {durationMs !== undefined && (
        <div className="flex items-center justify-end gap-2 border-t border-emerald-400/10 px-4 py-2">
          <Clock className="size-3 text-emerald-300/50" />
          <span className="font-mono text-[10px] text-emerald-300/60">
            {durationMs < 1000
              ? `${durationMs}ms`
              : `${(durationMs / 1000).toFixed(2)}s`}
          </span>
        </div>
      )}
    </div>
  );
}

/** 工具调用时间线组件 */
export function ToolCallTimeline({
  steps,
  totalDurationMs,
}: {
  steps: ToolCallStep[];
  totalDurationMs?: number;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="tool-call-timeline border border-cyan-400/20 bg-cyan-400/5">
      <div className="flex items-center gap-2 border-b border-cyan-400/15 px-4 py-2">
        <Clock className="size-4 text-cyan-400/70" />
        <span className="font-mono text-xs text-cyan-300">
          Tool Execution Timeline
        </span>
        {totalDurationMs !== undefined && (
          <span className="ml-auto font-mono text-[10px] text-cyan-300/50">
            Total:{" "}
            {totalDurationMs < 1000
              ? `${totalDurationMs}ms`
              : `${(totalDurationMs / 1000).toFixed(2)}s`}
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        {steps.map((item) => (
          <div
            key={`${item.toolCall.toolName}-${item.step}`}
            className="flex items-center gap-3"
          >
            <div
              className={`flex size-5 items-center justify-center rounded-full border font-mono text-[10px] ${
                item.toolCall.status === "success"
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : item.toolCall.status === "error"
                    ? "border-rose-400/50 bg-rose-400/10 text-rose-300"
                    : "border-cyan-400/30 bg-cyan-400/5 text-cyan-300"
              }`}
            >
              {item.step}
            </div>
            <Wrench className="size-3 text-emerald-400/60" />
            <span className="font-mono text-xs text-emerald-200/80">
              {item.toolCall.toolName}
            </span>
            <StatusIcon status={item.toolCall.status} />
            {item.toolCall.startTime && item.toolCall.endTime && (
              <span className="ml-auto font-mono text-[10px] text-emerald-300/50">
                {item.toolCall.endTime - item.toolCall.startTime}ms
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
