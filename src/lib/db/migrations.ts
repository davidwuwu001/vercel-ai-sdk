/**
 * 数据库 Schema 迁移
 * 支持增量迁移，保留版本历史
 */

import type Database from "better-sqlite3";

/** 当前数据库版本 */
export const CURRENT_VERSION = 2;

/** 迁移记录表名 */
const MIGRATIONS_TABLE = "schema_migrations";

/** 创建迁移记录表 */
function createMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/** 获取当前数据库版本 */
export function getCurrentVersion(db: Database.Database): number {
  createMigrationsTable(db);

  const row = db
    .prepare(`SELECT MAX(version) as version FROM ${MIGRATIONS_TABLE}`)
    .get() as { version: number | null } | undefined;

  return row?.version ?? 0;
}

/** 记录迁移 */
function recordMigration(db: Database.Database, version: number): void {
  db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES (?)`).run(version);
}

/** v1: 初始模型配置表 */
function migrateV1(db: Database.Database): void {
  db.exec(`
    -- 模型配置表
    CREATE TABLE IF NOT EXISTS model_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'volcengine',
      base_url TEXT NOT NULL,
      model_id TEXT NOT NULL,
      api_key_env TEXT NOT NULL DEFAULT 'VOLCENGINE_API_KEY',
      api_key_value TEXT NOT NULL DEFAULT '',
      supports_vision INTEGER NOT NULL DEFAULT 0,
      supports_files INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_model_configs_single_default
      ON model_configs(is_default)
      WHERE is_default = 1;

    -- 添加 api_key_value 列（如果不存在）
    PRAGMA table_info(model_configs);
  `);

  const columns = db
    .prepare("PRAGMA table_info(model_configs)")
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "api_key_value")) {
    db.prepare(
      "ALTER TABLE model_configs ADD COLUMN api_key_value TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  // 如果表为空，插入默认模型
  const count = db
    .prepare("SELECT COUNT(*) as count FROM model_configs")
    .get() as { count: number };

  if (count.count === 0) {
    db.prepare(
      `
      INSERT INTO model_configs (
        name, provider, base_url, model_id, api_key_env,
        supports_vision, supports_files, is_default, enabled, notes
      ) VALUES (
        @name, @provider, @baseUrl, @modelId, @apiKeyEnv,
        @supportsVision, @supportsFiles, 1, 1, @notes
      )
    `
    ).run({
      name: "Volcengine Ark Default",
      provider: "volcengine",
      baseUrl:
        process.env.VOLCENGINE_BASE_URL ||
        process.env.ARK_BASE_URL ||
        "https://ark.cn-beijing.volces.com/api/v3",
      modelId:
        process.env.VOLCENGINE_MODEL ||
        process.env.ARK_MODEL ||
        "doubao-seed-1-6-250615",
      apiKeyEnv:
        process.env.ARK_API_KEY && !process.env.VOLCENGINE_API_KEY
          ? "ARK_API_KEY"
          : "VOLCENGINE_API_KEY",
      supportsVision: 0,
      supportsFiles: 0,
      notes: "Seeded local model config. Store real keys in .env.local.",
    });
  }

  recordMigration(db, 1);
}

/** v2: 添加会话和消息表 */
function migrateV2(db: Database.Database): void {
  db.exec(`
    -- 聊天会话表
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      model_config_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
    );

    -- 聊天消息表
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      parts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- 附件表
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      media_type TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      size INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    );

    -- 文档表
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      mime_type TEXT,
      file_path TEXT,
      size INTEGER,
      chunk_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 文档分块表
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      heading TEXT,
      token_count INTEGER,
      char_count INTEGER,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- 向量嵌入表
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      vector BLOB NOT NULL,
      dimensions INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
    );

    -- AI 运行日志表
    CREATE TABLE IF NOT EXISTS ai_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT NOT NULL,
      model_config_id INTEGER,
      provider TEXT,
      model_id TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      latency_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'streaming',
      error_message TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      tool_call_count INTEGER DEFAULT 0,
      attachment_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
    );

    -- 工具调用表
    CREATE TABLE IF NOT EXISTS tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      input TEXT,
      output TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES ai_runs(id) ON DELETE CASCADE
    );

    -- 评估数据集表
    CREATE TABLE IF NOT EXISTS eval_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      dataset TEXT NOT NULL,
      prompt TEXT NOT NULL,
      expected_output TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 评估运行表
    CREATE TABLE IF NOT EXISTS eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eval_prompt_id TEXT NOT NULL,
      model_config_id INTEGER,
      model_name TEXT,
      model_id TEXT,
      provider TEXT,
      output TEXT,
      manual_score INTEGER,
      judge_score REAL,
      judge_feedback TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eval_prompt_id) REFERENCES eval_prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
    );

    -- 媒体生成表
    CREATE TABLE IF NOT EXISTS media_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      message_id TEXT,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT,
      output_url TEXT,
      metadata TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_session ON attachments(session_id);
    CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_chunk ON embeddings(chunk_id);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_route ON ai_runs(route);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(status);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
    CREATE INDEX IF NOT EXISTS idx_eval_runs_prompt ON eval_runs(eval_prompt_id);
    CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_media_generations_session ON media_generations(session_id);
  `);

  recordMigration(db, 2);
}

/** 迁移映射 */
const migrations: Record<number, (db: Database.Database) => void> = {
  1: migrateV1,
  2: migrateV2,
};

/**
 * 运行所有待执行的迁移
 */
export function runMigrations(db: Database.Database): void {
  createMigrationsTable(db);
  const currentVersion = getCurrentVersion(db);

  for (let version = currentVersion + 1; version <= CURRENT_VERSION; version++) {
    const migration = migrations[version];
    if (migration) {
      migration(db);
    }
  }
}
