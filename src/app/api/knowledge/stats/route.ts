/**
 * Knowledge Base API
 * 
 * 提供知识库管理接口:
 * - GET /api/knowledge/stats - 获取知识库统计
 * - DELETE /api/knowledge/documents/[id] - 删除文档
 */

import { NextResponse } from "next/server";
import { listDocuments, getDocumentStats, ensureSearchSchema } from "@/lib/knowledge/search";

export const runtime = "nodejs";

/**
 * GET /api/knowledge/stats
 * 获取知识库统计信息和文档列表
 */
export async function GET() {
  try {
    ensureSearchSchema();
    const stats = getDocumentStats();
    const documents = listDocuments();

    return NextResponse.json({
      success: true,
      stats,
      documents,
    });
  } catch (error) {
    console.error("Failed to get knowledge stats:", error);
    return NextResponse.json(
      { error: "Failed to get knowledge stats", details: String(error) },
      { status: 500 }
    );
  }
}
