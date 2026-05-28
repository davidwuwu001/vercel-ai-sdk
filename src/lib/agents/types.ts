/**
 * Agent 类型定义 - 定义 Agent 的元数据、工具和配置
 */

import type { z } from "zod";
import type { Tool } from "ai";

/** Agent 唯一标识符 */
export type AgentId = string;

/** Agent 能力要求 */
export interface AgentModelRequirements {
  /** 最小上下文窗口 token 数 */
  minContextWindow?: number;
  /** 是否需要视觉/多模态支持 */
  supportsVision?: boolean;
  /** 是否支持结构化输出 */
  supportsStructuredOutput?: boolean;
  /** 推荐温度范围 */
  recommendedTemperature?: [number, number];
}

/** Agent 工具定义 */
export interface AgentToolDefinition<InputSchema = z.ZodTypeAny> {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入 schema */
  inputSchema: InputSchema;
}

/** Agent 元数据 */
export interface AgentMetadata {
  /** 唯一标识符 */
  id: AgentId;
  /** 显示名称 */
  name: string;
  /** Agent 用途描述 */
  purpose: string;
  /** 详细指令 */
  instructions?: string;
  /** 使用的工具列表 */
  tools?: AgentToolDefinition[];
  /** 模型要求 */
  modelRequirements?: AgentModelRequirements;
  /** 标签分类 */
  tags?: string[];
  /** 版本号 */
  version?: string;
}

/** Agent 配置 */
export interface AgentConfig {
  /** Agent 元数据 */
  metadata: AgentMetadata;
  /** 运行时工具映射 (名称 -> AI SDK 工具) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Record<string, any>;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大迭代步数 */
  maxSteps?: number;
  /** 温度 */
  temperature?: number;
}

/** 工具调用记录 */
export interface ToolCallRecord {
  /** 工具名称 */
  toolName: string;
  /** 输入参数 */
  input: unknown;
  /** 输出结果 */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 调用时间戳 */
  timestamp: Date;
  /** 执行耗时 (毫秒) */
  durationMs?: number;
}

/** Agent 运行结果 */
export interface AgentRunResult {
  /** 最终文本响应 */
  text: string;
  /** 工具调用记录 */
  toolCalls: ToolCallRecord[];
  /** 是否因达到最大步数而停止 */
  stoppedAtMaxSteps?: boolean;
  /** 总执行步数 */
  totalSteps: number;
  /** 总执行耗时 (毫秒) */
  totalDurationMs?: number;
  /** 错误信息 (如有) */
  error?: string;
}

/** 工具定义到 AI SDK 工具的映射函数类型 */
export type ToolDefinitionMapper<T extends AgentToolDefinition = AgentToolDefinition> = (
  toolDef: T
) => Tool | null;

/** Agent 执行器接口 */
export interface AgentExecutor {
  /** 执行 Agent */
  execute(
    input: string,
    options?: {
      modelConfigId?: number;
      maxSteps?: number;
      temperature?: number;
      onToolCall?: (call: ToolCallRecord) => void;
    }
  ): Promise<AgentRunResult>;

  /** 获取 Agent 元数据 */
  getMetadata(): AgentMetadata;

  /** 获取可用工具列表 */
  getTools(): Record<string, Tool>;
}

/** 流式 Agent 执行器接口 */
export interface StreamingAgentExecutor extends AgentExecutor {
  /** 流式执行 Agent */
  executeStream(
    input: string,
    options?: {
      modelConfigId?: number;
      maxSteps?: number;
      temperature?: number;
      onToolCall?: (call: ToolCallRecord) => void;
    }
  ): Promise<ReadableStream>;
}

// ============================================================
// ToolLoopAgent 类型定义 - 正式 Agent 循环模式
// ============================================================

/** Agent 运行模式 */
export type AgentLoopMode = "tool-loop" | "once";

/** Agent 步骤类型 */
export type AgentStepType = "tool-call" | "tool-result" | "text" | "complete" | "error";

/** Agent 单个步骤 */
export interface AgentStep {
  /** 步骤类型 */
  type: AgentStepType;
  /** 工具名称 (仅 tool-call 时有) */
  toolName?: string;
  /** 工具参数 (仅 tool-call 时有) */
  args?: Record<string, unknown>;
  /** 工具执行结果 (仅 tool-result 时有) */
  result?: unknown;
  /** 文本内容 (仅 text/complete 时有) */
  text?: string;
  /** 错误信息 (仅 error 时有) */
  error?: string;
  /** 步骤索引 */
  stepIndex: number;
  /** 时间戳 */
  timestamp: Date;
}

/** ToolLoopAgent 实例接口 */
export interface ToolLoopAgentInstance {
  /** 运行 Agent (非流式) */
  run(input: string, options?: AgentRunOptions): Promise<AgentRunResult>;
  /** 流式运行 Agent */
  stream(input: string, options?: AgentRunOptions): AsyncGenerator<AgentStep>;
  /** 获取 Agent 元数据 */
  getMetadata(): AgentMetadata;
}

/** Agent 运行选项 */
export interface AgentRunOptions {
  /** 模型配置 ID */
  modelConfigId?: number;
  /** 最大迭代步数 */
  maxSteps?: number;
  /** 温度 */
  temperature?: number;
  /** 是否返回中间步骤 */
  includeIntermediateSteps?: boolean;
  /** 工具调用回调 */
  onToolCall?: (call: ToolCallRecord) => void;
}

/** ToolLoopAgent 配置 */
export interface ToolLoopAgentConfig {
  /** Agent 元数据 */
  metadata: AgentMetadata;
  /** 运行时工具映射 */
  tools: Record<string, Tool>;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大迭代步数 */
  maxSteps?: number;
  /** 温度 */
  temperature?: number;
  /** 运行模式: tool-loop (循环直到无工具调用) 或 once (仅一次) */
  loopMode?: AgentLoopMode;
  /** 是否在结果中包含中间步骤 */
  intermediateSteps?: boolean;
}

/** Agent 步骤记录 (用于追踪) */
export interface AgentStepRecord {
  /** 步骤索引 */
  step: number;
  /** 工具名称 */
  toolName?: string;
  /** 输入参数 */
  args?: Record<string, unknown>;
  /** 输出结果 */
  output?: unknown;
  /** 执行耗时 (毫秒) */
  durationMs?: number;
}
