/**
 * Evaluation History API
 */

import { NextResponse } from "next/server";
import { queryEvalRuns } from "@/lib/evals/run-eval";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId") || undefined;
    const modelId = searchParams.get("modelId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = queryEvalRuns({ promptId, modelId, limit, offset });

    return NextResponse.json({
      success: true,
      runs: result.runs,
      total: result.total,
    });
  } catch (error) {
    console.error("Failed to query eval history:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query history",
      },
      { status: 500 }
    );
  }
}
