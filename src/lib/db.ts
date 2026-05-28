import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { runMigrations } from "./db/migrations";

const dbPath =
  process.env.SQLITE_DB_PATH || join(process.cwd(), "data", "agent-lab.sqlite");

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
  }

  return db;
}
