/**
 * Agent Registry - 简化的 stub 实现
 */

import type { AgentMetadata } from "./types";
import type { Tool } from "ai";

/** Agent 配置 (简化版) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentConfig = any;

/** 获取所有 Agent 元数据 */
export function listAgents(): AgentMetadata[] {
  return [];
}

/** 根据 ID 获取 Agent 配置 */
export function getAgent(id: string): AgentConfig | undefined {
  return undefined;
}

/** 创建 Agent 执行器 */
export function createAgentExecutor(id: string): null {
  return null;
}

/** 创建流式 Agent 执行器 */
export function createStreamingAgentExecutor(id: string): null {
  return null;
}

/** 创建 ToolLoopAgent 执行器 */
export function createToolLoopAgentExecutor(id: string): null {
  return null;
}

/** 注册 ToolLoopAgent */
export function registerToolLoopAgent(config: unknown): void {
  // stub
}
