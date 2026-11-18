import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const file = process.env.DATABASE_PATH ?? './workbench.sqlite';
fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL, mime_type TEXT NOT NULL,
  size INTEGER NOT NULL, uploaded_at TEXT NOT NULL, extracted_text TEXT NOT NULL, facts_json TEXT NOT NULL,
  text_truncated INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, prompt TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL
);`);
const documentColumns = db.prepare('PRAGMA table_info(documents)').all() as Array<{ name: string }>;
if (!documentColumns.some(column => column.name === 'text_truncated')) {
  db.exec('ALTER TABLE documents ADD COLUMN text_truncated INTEGER NOT NULL DEFAULT 0');
}
