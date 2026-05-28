import { getDb } from "@/lib/db";

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

export type ToolEventRecord = {
  id: number;
  tool_name: string;
  status: string;
  input: string;
  output: string;
  error: string;
  duration_ms: number;
  source: string;
  created_at: string;
};

export function recordToolEvent(event: ToolEventInput) {
  const durationMs = Math.max(event.finishedAt - event.startedAt, 0);
  const outputRecord = toRecord(event.output);
  const source = event.source || inferSource(outputRecord);

  getDb()
    .prepare(
      `
        INSERT INTO tool_calls (
          run_id, tool_name, input, output, error, started_at, finished_at, duration_ms
        ) VALUES (
          0, @toolName, @input, @output, @error, @startedAt, @finishedAt, @durationMs
        )
      `,
    )
    .run({
      toolName: event.toolName,
      input: safeStringify(event.input),
      output: safeStringify(event.output),
      error: event.error ? safeStringify(event.error) : "",
      startedAt: new Date(event.startedAt).toISOString(),
      finishedAt: new Date(event.finishedAt).toISOString(),
      durationMs,
    });

  return {
    toolName: event.toolName,
    status: event.status,
    durationMs,
    source,
  };
}

export function listRecentToolEvents(limit = 50): ToolEventRecord[] {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  return getDb()
    .prepare(
      `
        SELECT
          id,
          tool_name,
          CASE WHEN error IS NOT NULL AND error != '' THEN 'error' ELSE 'success' END AS status,
          input,
          output,
          error,
          duration_ms,
          COALESCE(json_extract(output, '$.source'), 'unknown') AS source,
          created_at
        FROM tool_calls
        ORDER BY id DESC
        LIMIT ?
      `,
    )
    .all(safeLimit) as ToolEventRecord[];
}

export async function observeTool<TInput, TOutput>(
  toolName: string,
  input: TInput,
  execute: (input: TInput) => Promise<TOutput> | TOutput,
): Promise<TOutput & { _toolMeta?: { toolName: string; status: string; durationMs: number; source: string } }> {
  const startedAt = Date.now();

  try {
    const output = await execute(input);
    const finishedAt = Date.now();
    const meta = recordToolEvent({
      toolName,
      input,
      output,
      status: "success",
      startedAt,
      finishedAt,
    });

    if (output && typeof output === "object") {
      return {
        ...(output as TOutput),
        _toolMeta: meta,
      } as TOutput & { _toolMeta: typeof meta };
    }

    return output as TOutput & { _toolMeta?: typeof meta };
  } catch (error) {
    const finishedAt = Date.now();
    recordToolEvent({
      toolName,
      input,
      error,
      status: "error",
      startedAt,
      finishedAt,
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

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}
