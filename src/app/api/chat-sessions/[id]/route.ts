/**
 * 聊天会话详情 API
 *
 * GET: 获取会话详情和消息
 * PUT: 更新会话（标题、模型、消息快照）
 * DELETE: 删除会话
 */

import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import {
  clearSessionMessages,
  deleteSession,
  getSession,
  getSessionMessages,
  replaceSessionMessages,
  rowToMessage,
  updateSessionModel,
  updateSessionTitle,
} from "@/lib/chat-store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const messages = getSessionMessages(id).map(rowToMessage);

    return NextResponse.json({
      success: true,
      session: toSessionPayload(session),
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

    if (body.clearMessages === true) {
      clearSessionMessages(id);
    }

    if (body.title !== undefined) {
      updateSessionTitle(id, String(body.title));
    }

    if (body.modelConfigId !== undefined) {
      updateSessionModel(
        id,
        body.modelConfigId === null ? null : Number(body.modelConfigId)
      );
    }

    if (Array.isArray(body.messages)) {
      replaceSessionMessages(id, body.messages as UIMessage[]);
    }

    const nextSession = getSession(id);
    const messages = getSessionMessages(id).map(rowToMessage);

    return NextResponse.json({
      success: true,
      session: nextSession ? toSessionPayload(nextSession) : null,
      messages,
    });
  } catch (error) {
    console.error("[chat-sessions/:id] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}

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

function toSessionPayload(session: {
  id: string;
  title: string;
  model_config_id: number | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: session.id,
    title: session.title,
    modelConfigId: session.model_config_id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}
