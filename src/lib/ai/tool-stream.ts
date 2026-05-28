/**
 * Tool Streaming Utilities
 * 工具调用流式处理工具函数
 */

import type { ToolCallInfo, ToolCallStatus, ToolCallStep } from "@/components/tool-stream-panel";

/** 工具调用事件 (用于事件流) */
export interface ToolCallEvent {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * 生成唯一 ID
 */
export function generateToolCallId(): string {
  return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 格式化 JSON
 */
export function formatJson(obj: unknown): string {
  if (obj === undefined) return "undefined";
  if (obj === null) return "null";
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 格式化执行时长
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 计算工具调用的执行时长
 */
export function calculateDuration(event: ToolCallEvent): number | undefined {
  if (event.startTime && event.endTime) {
    return event.endTime - event.startTime;
  }
  return undefined;
}

/**
 * 创建空工具调用步骤
 */
export function createEmptyStep(step: number): ToolCallStep {
  return {
    step,
    toolCall: {
      toolName: "",
      status: "pending",
    },
  };
}

/**
 * 从 ToolCallEvent 转换为 ToolCallInfo
 */
export function eventToInfo(event: ToolCallEvent): ToolCallInfo {
  return {
    toolName: event.toolName,
    status: event.status,
    input: event.args,
    output: event.result,
    error: event.error,
    startTime: event.startTime,
    endTime: event.endTime,
  };
}

/**
 * 模拟工具调用序列
 * 用于演示和测试
 */
export function createSimulatedToolCalls(): ToolCallEvent[] {
  const now = Date.now();
  return [
    {
      id: generateToolCallId(),
      toolName: "getCurrentTime",
      status: "success",
      args: { timezone: "Asia/Shanghai" },
      result: {
        timezone: "Asia/Shanghai",
        iso: new Date(now).toISOString(),
        local: new Date(now).toLocaleString("zh-CN"),
      },
      startTime: now,
      endTime: now + 45,
    },
    {
      id: generateToolCallId(),
      toolName: "queryOrders",
      status: "success",
      args: { city: "北京", status: "正常使用" },
      result: {
        count: 2,
        orders: [
          { id: "TZ-202605-1001", studentName: "张三", city: "北京" },
          { id: "TZ-202605-1003", studentName: "小雨", city: "北京" },
        ],
      },
      startTime: now + 50,
      endTime: now + 180,
    },
    {
      id: generateToolCallId(),
      toolName: "searchKnowledgeBase",
      status: "success",
      args: { query: "老师资料审核规则", enableRerank: true },
      result: {
        query: "老师资料审核规则",
        results: [
          {
            documentName: "SOP-001-教师资质审核流程.md",
            content: "一、基本资质要求\n1. 必须持有教师资格证",
            score: 0.92,
          },
        ],
      },
      startTime: now + 200,
      endTime: now + 1100,
    },
    {
      id: generateToolCallId(),
      toolName: "createAgentTaskPlan",
      status: "error",
      args: { goal: "生成家长反馈报告", riskLevel: "high" },
      error: "Risk level 'high' requires human approval",
      startTime: now + 1150,
      endTime: now + 1200,
    },
  ];
}

/**
 * 获取状态对应的颜色类名
 */
export function getStatusColor(status: ToolCallStatus): string {
  switch (status) {
    case "pending":
      return "text-yellow-300/60";
    case "running":
      return "text-blue-400";
    case "success":
      return "text-emerald-400";
    case "error":
      return "text-rose-400";
  }
}

/**
 * 获取状态对应的背景色类名
 */
export function getStatusBgColor(status: ToolCallStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-300/10";
    case "running":
      return "bg-blue-400/10";
    case "success":
      return "bg-emerald-400/10";
    case "error":
      return "bg-rose-400/10";
  }
}

/**
 * 状态文字映射
 */
export const STATUS_LABELS: Record<ToolCallStatus, string> = {
  pending: "等待中",
  running: "执行中",
  success: "成功",
  error: "错误",
};

/**
 * 简化版工具调用信息 (用于列表展示)
 */
export interface ToolCallSummary {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  duration?: number;
}
