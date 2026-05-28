/**
 * Evaluation Score API
 * 
 * 设置评估运行的手动评分
 */

import { NextResponse } from "next/server";
import { setManualScore } from "@/lib/evals/run-eval";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.runId || typeof body.runId !== "number") {
      return NextResponse.json(
        { success: false, error: "Invalid runId" },
        { status: 400 }
      );
    }

    if (body.score === undefined || typeof body.score !== "number") {
      return NextResponse.json(
        { success: false, error: "Invalid score" },
        { status: 400 }
      );
    }

    const score = Math.min(10, Math.max(0, body.score));
    setManualScore(body.runId, score);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set manual score:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to set score",
      },
      { status: 500 }
    );
  }
}
