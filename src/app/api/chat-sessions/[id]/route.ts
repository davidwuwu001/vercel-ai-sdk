/**
 * 聊天会话详情 API
 * 
 * GET: 获取会话详情和消息
 * PUT: 更新会话（标题、模型）
 * DELETE: 删除会话
 */

import { NextResponse } from "next/server";
import {
  getSession,
  getSessionMessages,
  rowToMessage,
  updateSessionTitle,
  updateSessionModel,
  deleteSession,
} from "@/lib/chat-store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取会话详情
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = getSession(id);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const messageRows = getSessionMessages(id);
    const messages = messageRows.map(rowToMessage);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        modelConfigId: session.model_config_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      messages,
    });
  } catch (error) {
    console.error("[chat-sessions/:id] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get session" },
      { status: 500 }
    );
  }
}

/**
 * 更新会话
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = getSession(id);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    if (body.title !== undefined) {
      updateSessionTitle(id, body.title);
    }

    if (body.modelConfigId !== undefined) {
      updateSessionModel(id, body.modelConfigId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat-sessions/:id] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}

/**
 * 删除会话
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = getSession(id);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat-sessions/:id] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
