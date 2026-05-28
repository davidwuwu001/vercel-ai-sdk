/**
 * Logs API
 * 
 * 用于查询和展示 AI 运行日志
 */

import { NextResponse } from "next/server";
import { queryRuns, getRunStats, type AIRunFilter } from "@/lib/observability/log-run";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filter: AIRunFilter = {};

    // 解析查询参数
    const route = searchParams.get("route");
    if (route) filter.route = route;

    const status = searchParams.get("status") as AIRunFilter["status"];
    if (status) filter.status = status;

    const modelId = searchParams.get("modelId");
    if (modelId) filter.modelId = modelId;

    const provider = searchParams.get("provider");
    if (provider) filter.provider = provider;

    const startDate = searchParams.get("startDate");
    if (startDate) filter.startDate = startDate;

    const endDate = searchParams.get("endDate");
    if (endDate) filter.endDate = endDate;

    const limit = searchParams.get("limit");
    if (limit) filter.limit = parseInt(limit, 10);

    const offset = searchParams.get("offset");
    if (offset) filter.offset = parseInt(offset, 10);

    // 查询运行日志
    const result = queryRuns(filter);

    // 获取统计数据
    const stats = getRunStats();

    return NextResponse.json({
      success: true,
      runs: result.runs,
      total: result.total,
      stats,
    });
  } catch (error) {
    console.error("Failed to query runs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query runs",
      },
      { status: 500 }
    );
  }
}
