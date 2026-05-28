/**
 * Run Evaluation API
 */

import { NextResponse } from "next/server";
import { runEvaluation } from "@/lib/evals/run-eval";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await runEvaluation({
      promptIds: body.promptIds,
      modelConfigIds: body.modelConfigIds,
      useJudge: body.useJudge,
      judgeModelConfigId: body.judgeModelConfigId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Evaluation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Evaluation failed",
      },
      { status: 500 }
    );
  }
}
