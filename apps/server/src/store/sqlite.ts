import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Role } from '../types.js';
import type { HistoryStore, Session, SessionSummary, StoredMessage } from './history.js';
import { titleFromQuery } from './history.js';

const DB_PATH = process.env.XX_DB_PATH
  ? resolve(process.env.XX_DB_PATH)
  : resolve(process.cwd(), 'data/chat.db');

/**
 * 基于 better-sqlite3 的历史会话持久化实现（第 5 步）。
 * sessions 一对多 messages；删除会话时消息经外键级联删除。
 */
export class SqliteHistoryStore implements HistoryStore {
  private readonly db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_code TEXT PRIMARY KEY,
        title        TEXT    NOT NULL,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        session_code TEXT    NOT NULL REFERENCES sessions(session_code) ON DELETE CASCADE,
        role         TEXT    NOT NULL,
        content      TEXT    NOT NULL,
        ts           INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_code, id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
    `);
  }

  listSessions(): SessionSummary[] {
    return this.db
      .prepare(
        `SELECT s.session_code AS sessionCode,
                s.title        AS title,
                s.created_at   AS createdAt,
                s.updated_at   AS updatedAt,
                (SELECT COUNT(*) FROM messages m WHERE m.session_code = s.session_code) AS messageCount
         FROM sessions s
         ORDER BY s.updated_at DESC`,
      )
      .all() as SessionSummary[];
  }

  getSession(sessionCode: string): Session | undefined {
    const row = this.db
      .prepare(
        `SELECT session_code AS sessionCode, title, created_at AS createdAt, updated_at AS updatedAt
         FROM sessions WHERE session_code = ?`,
      )
      .get(sessionCode) as Omit<Session, 'messages'> | undefined;
    if (!row) return undefined;

    const messages = this.db
      .prepare(`SELECT role, content, ts FROM messages WHERE session_code = ? ORDER BY id ASC`)
      .all(sessionCode) as StoredMessage[];

    return { ...row, messages };
  }

  ensureSession(sessionCode: string | undefined, title: string): Session {
    if (sessionCode) {
      const existing = this.getSession(sessionCode);
      if (existing) return existing;
    }
    const now = Date.now();
    const session: Session = {
      sessionCode: sessionCode ?? randomUUID(),
      title: titleFromQuery(title),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.db
      .prepare(
        `INSERT INTO sessions (session_code, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      )
      .run(session.sessionCode, session.title, now, now);
    return session;
  }

  appendMessage(sessionCode: string, role: Role, content: string): void {
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .prepare(`INSERT INTO messages (session_code, role, content, ts) VALUES (?, ?, ?, ?)`)
        .run(sessionCode, role, content, now);
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
    })();
  }

  deleteSession(sessionCode: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE session_code = ?`).run(sessionCode);
  }

  deleteSessions(sessionCodes: string[]): void {
    if (sessionCodes.length === 0) return;
    const placeholders = sessionCodes.map(() => '?').join(', ');
    this.db
      .prepare(`DELETE FROM sessions WHERE session_code IN (${placeholders})`)
      .run(...sessionCodes);
  }
}

export const historyStore: HistoryStore = new SqliteHistoryStore();
