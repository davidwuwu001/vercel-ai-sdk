export type ToolEventInput = {
  toolName: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  status: "success" | "error";
  startedAt: number;
  finishedAt: number;
  source?: string;
};

export type ToolEventSummary = {
  toolName: string;
  status: "success" | "error";
  durationMs: number;
  source: string;
};

export function summarizeToolEvent(event: ToolEventInput): ToolEventSummary {
  const outputRecord = toRecord(event.output);
  return {
    toolName: event.toolName,
    status: event.status,
    durationMs: Math.max(event.finishedAt - event.startedAt, 0),
    source: event.source || inferSource(outputRecord),
  };
}

export async function observeTool<TInput, TOutput>(
  toolName: string,
  input: TInput,
  execute: (input: TInput) => Promise<TOutput> | TOutput,
): Promise<TOutput & { _toolMeta?: ToolEventSummary }> {
  const startedAt = Date.now();

  try {
    const output = await execute(input);
    const meta = summarizeToolEvent({
      toolName,
      input,
      output,
      status: "success",
      startedAt,
      finishedAt: Date.now(),
    });

    if (output && typeof output === "object") {
      return {
        ...(output as TOutput),
        _toolMeta: meta,
      } as TOutput & { _toolMeta: ToolEventSummary };
    }

    return output as TOutput & { _toolMeta?: ToolEventSummary };
  } catch (error) {
    summarizeToolEvent({
      toolName,
      input,
      error,
      status: "error",
      startedAt,
      finishedAt: Date.now(),
    });
    throw error;
  }
}

function inferSource(record: Record<string, unknown>) {
  return typeof record.source === "string" ? record.source : "unknown";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
