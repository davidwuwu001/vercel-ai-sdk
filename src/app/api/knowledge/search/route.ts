/**
 * Knowledge Base Search API
 * 
 * POST /api/knowledge/search - 搜索知识库
 */

import { NextRequest, NextResponse } from "next/server";
import { searchKnowledgeBase } from "@/lib/knowledge/search";

export const runtime = "nodejs";

/**
 * POST /api/knowledge/search
 * 搜索知识库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK, threshold, enableRerank } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const results = await searchKnowledgeBase(query, {
      topK: topK || 5,
      threshold: threshold || 0.5,
      enableRerank: enableRerank !== false,
    });

    return NextResponse.json({
      success: true,
      results: results.results.map((r) => ({
        chunk: {
          id: r.chunk.id,
          content: r.chunk.content,
          metadata: {
            chunkIndex: r.chunk.metadata.chunkIndex,
            chunkType: r.chunk.metadata.chunkType,
            heading: r.chunk.metadata.heading,
            estimatedTokens: r.chunk.metadata.estimatedTokens,
          },
        },
        score: r.score,
        documentId: r.documentId,
        documentName: r.documentName,
      })),
      totalCandidates: results.totalCandidates,
      rerankEnabled: results.rerankEnabled,
      provider: results.provider,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 }
    );
  }
}
