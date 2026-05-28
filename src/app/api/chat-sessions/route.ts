/**
 * 聊天会话 API
 * 
 * GET: 列出最近的会话
 * POST: 创建新会话
 */

import { NextResponse } from "next/server";
import {
  createSession,
  listRecentSessions,
  getSession,
} from "@/lib/chat-store";

export const runtime = "nodejs";

/**
 * 获取会话列表或创建新会话
 */
export async function GET() {
  try {
    const sessions = listRecentSessions(50);
    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        modelConfigId: s.model_config_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
    });
  } catch (error) {
    console.error("[chat-sessions] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

/**
 * 创建新会话
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.id || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const modelConfigId = body.modelConfigId;

    // 检查是否已存在
    const existing = getSession(sessionId);
    if (existing) {
      return NextResponse.json({
        success: true,
        session: {
          id: existing.id,
          title: existing.title,
          modelConfigId: existing.model_config_id,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
        },
      });
    }

    const session = createSession(sessionId, modelConfigId);
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        modelConfigId: session.model_config_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    });
  } catch (error) {
    console.error("[chat-sessions] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}
