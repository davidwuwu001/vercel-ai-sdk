/**
 * Vector Search API
 * 
 * POST /api/vector/search - 搜索相似向量
 * POST /api/vector/add - 添加向量
 * GET  /api/vector/stats - 获取存储统计
 * GET  /api/vector/list - 列出所有向量
 * DELETE /api/vector/{id} - 删除向量
 */

import { NextRequest, NextResponse } from "next/server";
import { searchVectors, addVector, addVectors, deleteVector, getStoreStats, listVectors } from "@/lib/ai/vector-store";

/**
 * POST /api/vector/search
 * 搜索相似向量
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, id, text, metadata, options } = body;

    // 搜索向量
    if (action === "search" || (!action && query)) {
      if (!query) {
        return NextResponse.json(
          { error: "Query is required for search" },
          { status: 400 }
        );
      }

      const results = await searchVectors(query, {
        topK: options?.topK || 5,
        threshold: options?.threshold || 0.5,
      });

      return NextResponse.json({
        success: true,
        results,
        query,
        totalResults: results.length,
      });
    }

    // 添加单个向量
    if (action === "add" || (!action && id && text)) {
      if (!id || !text) {
        return NextResponse.json(
          { error: "id and text are required for adding vectors" },
          { status: 400 }
        );
      }

      const entry = await addVector(id, text, metadata);

      return NextResponse.json({
        success: true,
        entry: {
          id: entry.id,
          text: entry.text,
          vectorLength: entry.vector.length,
          metadata: entry.metadata,
        },
      });
    }

    // 批量添加向量
    if (action === "batchAdd" || action === "addMany") {
      if (!Array.isArray(body.entries)) {
        return NextResponse.json(
          { error: "entries array is required for batch add" },
          { status: 400 }
        );
      }

      const entries = await addVectors(
        body.entries.map((e: { id: string; text: string; metadata?: Record<string, unknown> }) => ({
          id: e.id,
          text: e.text,
          metadata: e.metadata,
        }))
      );

      return NextResponse.json({
        success: true,
        count: entries.length,
        entries: entries.map(e => ({
          id: e.id,
          text: e.text,
          vectorLength: e.vector.length,
        })),
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing required parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Vector API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vector/search
 * 获取存储统计或列出向量
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  try {
    if (action === "stats") {
      const stats = getStoreStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    if (action === "list") {
      const vectors = listVectors();
      return NextResponse.json({
        success: true,
        vectors,
        total: vectors.length,
      });
    }

    // 默认返回统计
    const stats = getStoreStats();
    return NextResponse.json({
      success: true,
      stats,
      message: "Use ?action=stats or ?action=list for specific data",
    });
  } catch (error) {
    console.error("Vector API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vector/search?id=xxx
 * 删除向量
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "id is required for deletion" },
      { status: 400 }
    );
  }

  try {
    const deleted = deleteVector(id);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `Vector ${id} deleted`,
      });
    } else {
      return NextResponse.json(
        { error: `Vector ${id} not found` },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Vector API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
