/**
 * Knowledge Base Document API
 * 
 * DELETE /api/knowledge/documents/[id] - 删除文档
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteDocument } from "@/lib/knowledge/search";

export const runtime = "nodejs";

/**
 * DELETE /api/knowledge/documents/[id]
 * 删除知识库中的文档
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: `Document ${documentId} deleted`,
    });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document", details: String(error) },
      { status: 500 }
    );
  }
}
