"use client";

import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Circle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FieldUpdate, StreamingObjectState } from "@/lib/ai/object-stream";

interface StreamingObjectViewerProps {
  /** 流式状态 */
  state: StreamingObjectState;
  /** 是否显示时间戳 */
  showTimestamps?: boolean;
  /** 字段高亮持续时间（毫秒） */
  highlightDuration?: number;
  /** 紧凑模式 */
  compact?: boolean;
}

/**
 * 流式对象查看器组件
 * 实时显示对象的增量构建过程
 */
export function StreamingObjectViewer({
  state,
  showTimestamps = false,
  highlightDuration = 1500,
  compact = false,
}: StreamingObjectViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [recentUpdates, setRecentUpdates] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevFieldUpdatesLength = useRef(0);

  // 追踪新的字段更新
  useEffect(() => {
    const currentLength = state.fieldUpdates.length;
    if (currentLength > prevFieldUpdatesLength.current) {
      const latestUpdates = state.fieldUpdates.slice(prevFieldUpdatesLength.current);
      const newPaths = new Set(latestUpdates.map((u) => u.path));

      setRecentUpdates((prev) => {
        const combined = new Set([...prev, ...newPaths]);
        return combined;
      });

      // 设置定时器清除高亮
      newPaths.forEach((path) => {
        if (!timeoutRef.current.has(path)) {
          const timeout = setTimeout(() => {
            setRecentUpdates((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            timeoutRef.current.delete(path);
          }, highlightDuration);
          timeoutRef.current.set(path, timeout);
        }
      });
    }
    prevFieldUpdatesLength.current = currentLength;
  }, [state.fieldUpdates, highlightDuration]);

  // 清理高亮状态的定时器
  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // 递归渲染函数（非 useCallback）
  const renderValue = (
    value: unknown,
    path: string,
    depth: number
  ): React.ReactNode => {
    if (value === null || value === undefined) {
      return (
        <span className="streaming-null">
          {state.isComplete ? "null" : "..."}
        </span>
      );
    }

    if (typeof value === "boolean") {
      return value ? (
        <span className="streaming-boolean streaming-true">true</span>
      ) : (
        <span className="streaming-boolean streaming-false">false</span>
      );
    }

    if (typeof value === "number") {
      return <span className="streaming-number">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="streaming-string">&ldquo;{value}&rdquo;</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="streaming-empty">[]</span>;
      }
      const isExpanded = expandedPaths.has(path);
      return (
        <div className="streaming-array">
          {isExpanded ? (
            <>
              <button
                className="streaming-toggle"
                onClick={() => toggleExpand(path)}
              >
                <ChevronDown className="streaming-icon-sm" />
              </button>
              <span className="streaming-bracket">[</span>
              <div className="streaming-children">
                {value.map((item, index) => (
                  <div key={index} className="streaming-item">
                    <span className="streaming-index">{index}: </span>
                    {renderValue(item, `${path}[${index}]`, depth + 1)}
                  </div>
                ))}
              </div>
              <span className="streaming-bracket">]</span>
            </>
          ) : (
            <>
              <button
                className="streaming-toggle"
                onClick={() => toggleExpand(path)}
              >
                <ChevronRight className="streaming-icon-sm" />
              </button>
              <span className="streaming-preview">
                [{value.length} items]
              </span>
            </>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="streaming-empty">{"{}"}</span>;
      }
      const isExpanded = expandedPaths.has(path);
      return (
        <div className="streaming-object">
          {isExpanded ? (
            <>
              <button
                className="streaming-toggle"
                onClick={() => toggleExpand(path)}
              >
                <ChevronDown className="streaming-icon-sm" />
              </button>
              <span className="streaming-bracket">{"{"}</span>
              <div className="streaming-children">
                {entries.map(([key, val]) => {
                  const fieldPath = path ? `${path}.${key}` : key;
                  const isRecent = recentUpdates.has(fieldPath);
                  const isActive =
                    state.activeField === fieldPath ||
                    fieldPath.startsWith(state.activeField || "");
                  const isGenerating = !state.isComplete && isActive;

                  return (
                    <div
                      key={key}
                      className={`streaming-field ${isRecent ? "streaming-field-recent" : ""} ${isGenerating ? "streaming-field-generating" : ""}`}
                    >
                      <span className="streaming-key">{key}: </span>
                      {renderValue(val, fieldPath, depth + 1)}
                      {isGenerating && (
                        <span className="streaming-generating-indicator">
                          <Loader2 className="streaming-spin-icon" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="streaming-bracket">{"}"}</span>
            </>
          ) : (
            <>
              <button
                className="streaming-toggle"
                onClick={() => toggleExpand(path)}
              >
                <ChevronRight className="streaming-icon-sm" />
              </button>
              <span className="streaming-preview">
                {"{"}
                {Object.keys(value).length} keys{"}"}
              </span>
            </>
          )}
        </div>
      );
    }

    return <span className="streaming-unknown">{String(value)}</span>;
  };

  // 使用已知的 elapsed 时间而非 Date.now()
  const duration = useMemo(() => {
    if (state.completedAt) {
      return state.completedAt - state.startedAt;
    }
    // 使用当前时间，但只在完成时使用
    return 0;
  }, [state.completedAt, state.startedAt]);

  const fieldCount = useMemo(() => {
    const countNested = (obj: unknown): number => {
      if (obj === null || obj === undefined) return 0;
      if (typeof obj !== "object") return 1;
      if (Array.isArray(obj)) {
        return obj.reduce((acc, item) => acc + countNested(item), 0);
      }
      return Object.values(obj).reduce((acc, val) => acc + countNested(val), 0);
    };
    return countNested(state.partial);
  }, [state.partial]);

  return (
    <div className={`streaming-viewer ${compact ? "streaming-viewer-compact" : ""}`}>
      {/* 头部信息 */}
      <div className="streaming-header">
        <div className="streaming-status">
          {state.isComplete ? (
            <>
              <CheckCircle2 className="streaming-icon-success" />
              <span className="streaming-status-text">完成</span>
            </>
          ) : (
            <>
              <Sparkles className="streaming-icon-generating" />
              <span className="streaming-status-text">生成中</span>
            </>
          )}
        </div>
        <div className="streaming-meta">
          <span className="streaming-duration">
            <Clock className="streaming-icon-sm" />
            {duration > 0 ? `${duration}ms` : "..."}
          </span>
          <span className="streaming-field-count">
            {fieldCount} 字段
          </span>
        </div>
      </div>

      {/* 对象内容 */}
      <div className="streaming-content">
        {renderValue(state.partial, "", 0)}
      </div>

      {/* 更新历史（可选） */}
      {showTimestamps && state.fieldUpdates.length > 0 && (
        <div className="streaming-history">
          <div className="streaming-history-title">更新历史</div>
          <div className="streaming-history-list">
            {state.fieldUpdates.slice(-10).map((update, index) => (
              <div key={index} className="streaming-history-item">
                <span className="streaming-history-path">{update.path}</span>
                <span className="streaming-history-time">
                  +{update.timestamp - state.startedAt}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 字段状态指示器组件
 */
interface FieldStatusIndicatorProps {
  status: "pending" | "generating" | "complete";
  fieldName: string;
}

export function FieldStatusIndicator({
  status,
  fieldName,
}: FieldStatusIndicatorProps) {
  return (
    <div className={`field-status field-status-${status}`}>
      {status === "pending" && (
        <>
          <Circle className="field-status-icon field-status-icon-pending" />
          <span className="field-status-text">{fieldName}</span>
        </>
      )}
      {status === "generating" && (
        <>
          <Loader2 className="field-status-icon field-status-icon-generating" />
          <span className="field-status-text">{fieldName}</span>
        </>
      )}
      {status === "complete" && (
        <>
          <CheckCircle2 className="field-status-icon field-status-icon-complete" />
          <span className="field-status-text">{fieldName}</span>
        </>
      )}
    </div>
  );
}

/**
 * 实时 JSON 预览组件
 */
interface LiveJsonPreviewProps {
  partial: Record<string, unknown>;
  isComplete: boolean;
}

export function LiveJsonPreview({ partial, isComplete }: LiveJsonPreviewProps) {
  const jsonRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (jsonRef.current) {
      jsonRef.current.scrollTop = jsonRef.current.scrollHeight;
    }
  }, [partial]);

  return (
    <div className="live-json-preview">
      <pre
        ref={jsonRef}
        className="live-json-content"
      >
        {JSON.stringify(partial, null, 2)}
        {!isComplete && <span className="live-json-cursor">|</span>}
      </pre>
    </div>
  );
}

/**
 * 字段进度列表组件
 */
interface FieldProgressListProps {
  updates: FieldUpdate[];
  activeField: string | null;
  totalFields: number;
}

export function FieldProgressList({
  updates,
  activeField,
  totalFields,
}: FieldProgressListProps) {
  const uniqueFields = useMemo(() => {
    const seen = new Set<string>();
    const fields: Array<{ path: string; status: "complete" | "generating" | "pending" }> = [];

    for (const update of updates) {
      if (!seen.has(update.path)) {
        seen.add(update.path);
        fields.push({
          path: update.path,
          status: "complete",
        });
      }
    }

    if (activeField) {
      fields.push({
        path: activeField,
        status: "generating",
      });
    }

    return fields;
  }, [updates, activeField]);

  return (
    <div className="field-progress-list">
      <div className="field-progress-header">
        <span>字段进度</span>
        <span className="field-progress-count">
          {uniqueFields.filter((f) => f.status === "complete").length} / {totalFields}
        </span>
      </div>
      <div className="field-progress-items">
        {uniqueFields.map((field) => (
          <FieldStatusIndicator
            key={field.path}
            status={field.status}
            fieldName={field.path}
          />
        ))}
      </div>
    </div>
  );
}

export default StreamingObjectViewer;
