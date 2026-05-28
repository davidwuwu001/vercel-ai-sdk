/**
 * Knowledge Base Index API
 * 
 * POST /api/knowledge/index - 将文档内容索引到知识库
 */

import { NextRequest, NextResponse } from "next/server";
import { indexDocument } from "@/lib/knowledge/search";

export const runtime = "nodejs";

/**
 * POST /api/knowledge/index
 * 将文档内容索引到知识库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, content, sourceType, sourceUrl, metadata } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: "name and content are required" },
        { status: 400 }
      );
    }

    const result = await indexDocument(name, content, {
      sourceType: sourceType || "text",
      sourceUrl,
      metadata,
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    console.error("Failed to index document:", error);
    return NextResponse.json(
      { error: "Failed to index document", details: String(error) },
      { status: 500 }
    );
  }
}
