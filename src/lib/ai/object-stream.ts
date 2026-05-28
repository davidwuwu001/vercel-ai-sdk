/**
 * 流式结构化对象生成工具
 * 使用 AI SDK 的 streamObject 实现实时字段更新追踪
 */

import type { ZodSchema } from "zod";

/**
 * 单个字段更新事件
 */
export interface FieldUpdate {
  /** 字段路径，如 "basicInfo.name" 或 "qualificationCheck.certifications[0].name" */
  path: string;
  /** 字段当前值 */
  value: unknown;
  /** 更新类型 */
  type: "add" | "update" | "complete";
  /** 更新时间戳 */
  timestamp: number;
}

/**
 * 流式对象状态
 */
export interface StreamingObjectState<T = Record<string, unknown>> {
  /** 已填充的字段 */
  partial: T;
  /** 是否完成 */
  isComplete: boolean;
  /** 所有字段更新历史 */
  fieldUpdates: FieldUpdate[];
  /** 当前正在生成的字段路径 */
  activeField: string | null;
  /** 完成时间 */
  completedAt?: number;
  /** 开始时间 */
  startedAt: number;
}

/**
 * 流式配置选项
 */
export interface StreamingObjectOptions {
  /** Schema 用于验证 */
  schema: ZodSchema;
  /** 字段更新回调 */
  onFieldUpdate?: (update: FieldUpdate, state: StreamingObjectState) => void;
  /** 完成回调 */
  onComplete?: (result: unknown, state: StreamingObjectState) => void;
  /** 错误回调 */
  onError?: (error: Error, state: StreamingObjectState) => void;
}

/**
 * 创建空的流式状态
 */
export function createStreamingState(): StreamingObjectState {
  return {
    partial: {} as Record<string, unknown>,
    isComplete: false,
    fieldUpdates: [],
    activeField: null,
    startedAt: Date.now(),
  };
}

/**
 * 解析部分对象为字段更新列表
 * 用于检测新增或变化的字段
 */
export function diffPartialObject(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  prefix = ""
): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  const now = Date.now();

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const prevValue = prev[key];
    const nextValue = next[key];

    if (!(key in prev) && key in next) {
      updates.push({
        path: fullPath,
        value: nextValue,
        type: "add",
        timestamp: now,
      });
    } else if (key in prev && key in next && prevValue !== nextValue) {
      if (typeof nextValue === "object" && nextValue !== null && !Array.isArray(nextValue)) {
        const nestedUpdates = diffPartialObject(
          (prevValue as Record<string, unknown>) || {},
          nextValue as Record<string, unknown>,
          fullPath
        );
        updates.push(...nestedUpdates);
      } else {
        updates.push({
          path: fullPath,
          value: nextValue,
          type: "update",
          timestamp: now,
        });
      }
    }
  }

  return updates;
}

/**
 * 从对象路径获取嵌套值
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 设置嵌套值到对象
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const result = { ...obj };
  const parts = path.split(".");
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const nextValue = current[part];

    if (typeof nextValue === "object" && nextValue !== null) {
      current[part] = { ...(nextValue as Record<string, unknown>) };
      current = current[part] as Record<string, unknown>;
    } else {
      current[part] = {};
      current = current[part] as Record<string, unknown>;
    }
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * 获取路径的最后部分（字段名）
 */
export function getFieldName(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 1];
}

/**
 * 获取路径的父路径
 */
export function getParentPath(path: string): string {
  const parts = path.split(".");
  parts.pop();
  return parts.join(".");
}

/**
 * 检测字段更新是否导致父对象结构变化
 */
export function shouldShowParentUpdate(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  path: string
): boolean {
  const parentPath = getParentPath(path);
  if (!parentPath) return true;

  const prevParent = getNestedValue(prev, parentPath);
  const nextParent = getNestedValue(next, parentPath);

  return prevParent !== nextParent;
}

/**
 * 格式化字段路径为可读标签
 */
export function formatFieldLabel(path: string): string {
  return path
    .split(".")
    .map((part) => {
      // 处理数组索引
      if (/^\d+$/.test(part)) {
        return `[${part}]`;
      }
      // 驼峰转空格分隔
      return part
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
    })
    .join(" → ");
}

/**
 * 流式状态到完成状态的转换
 */
export function finalizeStreamingState(
  state: StreamingObjectState,
  finalResult: unknown
): StreamingObjectState {
  return {
    ...state,
    partial: finalResult as Record<string, unknown>,
    isComplete: true,
    activeField: null,
    completedAt: Date.now(),
  };
}

/**
 * 计算流式生成耗时
 */
export function getStreamingDuration(state: StreamingObjectState): {
  elapsed: number;
  total: number | null;
} {
  const elapsed = Date.now() - state.startedAt;
  return {
    elapsed,
    total: state.completedAt ? state.completedAt - state.startedAt : null,
  };
}

/**
 * 获取字段状态分类
 */
export type FieldStatus = "pending" | "generating" | "complete";

/**
 * 判断字段状态
 */
export function getFieldStatus(
  fieldPath: string,
  updates: FieldUpdate[],
  activeField: string | null
): FieldStatus {
  if (activeField === fieldPath || fieldPath.startsWith(activeField + ".")) {
    return "generating";
  }

  const hasUpdate = updates.some(
    (u) => u.path === fieldPath || fieldPath.startsWith(u.path + ".")
  );

  return hasUpdate ? "complete" : "pending";
}
