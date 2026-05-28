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

/**
 * 创建新会话
 */
export function createSession(id: string, modelConfigId?: number): ChatSessionRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_sessions (id, model_config_id, title)
    VALUES (?, ?, ?)
  `).run(id, modelConfigId ?? null, "Untitled");

  const row = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id) as ChatSessionRow;
  return row;
}

/**
 * 获取会话
 */
export function getSession(sessionId: string): ChatSessionRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(sessionId) as ChatSessionRow | null;
}

/**
 * 更新会话标题
 */
export function updateSessionTitle(sessionId: string, title: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title, sessionId);
}

/**
 * 更新会话模型
 */
export function updateSessionModel(sessionId: string, modelConfigId: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE chat_sessions SET model_config_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(modelConfigId, sessionId);
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
}

/**
 * 获取最近会话列表
 */
export function listRecentSessions(limit = 20): ChatSessionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM chat_sessions
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit) as ChatSessionRow[];
}

/**
 * 保存消息
 */
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
  `).run(id, sessionId, role, JSON.stringify(parts));

  // 更新会话时间
  db.prepare(`
    UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(sessionId);

  return db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as ChatMessageRow;
}

/**
 * 获取会话的所有消息
 */
export function getSessionMessages(sessionId: string): ChatMessageRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as ChatMessageRow[];
}

/**
 * 将消息行转换为 UIMessage
 */
export function rowToMessage(row: ChatMessageRow): UIMessage {
  // 过滤掉 tool 角色的消息，因为 UIMessage 不支持 tool 角色
  if (row.role === "tool") {
    return {
      id: row.id,
      role: "assistant" as const,
      parts: JSON.parse(row.parts) as UIMessage["parts"],
    };
  }
  return {
    id: row.id,
    role: row.role as "user" | "system" | "assistant",
    parts: JSON.parse(row.parts) as UIMessage["parts"],
  };
}

/**
 * 删除消息
 */
export function deleteMessage(messageId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_messages WHERE id = ?").run(messageId);
}

/**
 * 清空会话消息
 */
export function clearSessionMessages(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
}
