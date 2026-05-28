/**
 * 聊天会话存储
 * 将聊天会话和消息持久化到 SQLite
 */

import { getDb } from "@/lib/db";
import type { UIMessage } from "ai";

export interface ChatSessionRow {
  id: string;
  title: string;
  model_config_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: string;
  created_at: string;
}

export function createSession(id: string, modelConfigId?: number): ChatSessionRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_sessions (id, model_config_id, title)
    VALUES (?, ?, ?)
  `).run(id, modelConfigId ?? null, "Untitled");

  return getSession(id) as ChatSessionRow;
}

export function ensureSession(id: string, modelConfigId?: number): ChatSessionRow {
  const existing = getSession(id);
  if (existing) return existing;
  return createSession(id, modelConfigId);
}

export function getSession(sessionId: string): ChatSessionRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(sessionId) as ChatSessionRow | null;
}

export function updateSessionTitle(sessionId: string, title: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title.trim() || "Untitled", sessionId);
}

export function updateSessionModel(sessionId: string, modelConfigId: number | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE chat_sessions SET model_config_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(modelConfigId, sessionId);
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
}

export function listRecentSessions(limit = 20): ChatSessionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM chat_sessions
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit) as ChatSessionRow[];
}

export function saveMessage(
  id: string,
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  parts: UIMessage["parts"]
): ChatMessageRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, parts)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      role = excluded.role,
      parts = excluded.parts
  `).run(id, sessionId, role, JSON.stringify(parts));

  touchSession(sessionId);
  return db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as ChatMessageRow;
}

export function replaceSessionMessages(sessionId: string, messages: UIMessage[]): void {
  const db = getDb();
  const replace = db.transaction(() => {
    ensureSession(sessionId);
    db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);

    const insert = db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, parts)
      VALUES (?, ?, ?, ?)
    `);

    for (const message of messages) {
      insert.run(
        message.id || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sessionId,
        normalizeRole(message.role),
        JSON.stringify(message.parts || [])
      );
    }

    const title = titleFromMessages(messages);
    if (title) updateSessionTitle(sessionId, title);
    touchSession(sessionId);
  });

  replace();
}

export function getSessionMessages(sessionId: string): ChatMessageRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(sessionId) as ChatMessageRow[];
}

export function rowToMessage(row: ChatMessageRow): UIMessage {
  const role = row.role === "tool" ? "assistant" : row.role;
  return {
    id: row.id,
    role: role as "user" | "system" | "assistant",
    parts: safeParseParts(row.parts),
  };
}

export function deleteMessage(messageId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_messages WHERE id = ?").run(messageId);
}

export function clearSessionMessages(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
  updateSessionTitle(sessionId, "Untitled");
  touchSession(sessionId);
}

function normalizeRole(role: UIMessage["role"] | string): "user" | "assistant" | "system" | "tool" {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
    return role;
  }
  return "assistant";
}

function touchSession(sessionId: string): void {
  getDb()
    .prepare("UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(sessionId);
}

function safeParseParts(parts: string): UIMessage["parts"] {
  try {
    const parsed = JSON.parse(parts) as UIMessage["parts"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function titleFromMessages(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts?.find((part) => part.type === "text");
  if (!text || text.type !== "text") return "";
  return text.text.slice(0, 32) || "";
}
