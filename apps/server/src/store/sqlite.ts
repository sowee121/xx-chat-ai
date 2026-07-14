/**
 * SQLite 历史存储：会话、消息、reasoning
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Role } from '../types.js';
import type { HistoryStore, Session, SessionSummary, StoredMessage } from './history.js';
import { SessionNotFoundError, titleFromQuery } from './history.js';

const DB_PATH = process.env.XX_DB_PATH
  ? resolve(process.env.XX_DB_PATH)
  : resolve(process.cwd(), 'data/chat.db');

/**
 * 基于 better-sqlite3 的历史会话持久化实现（第 5 步）
 * sessions 一对多 messages；删除会话时消息经外键级联删除
 */
export class SqliteHistoryStore implements HistoryStore {
  private readonly db: Database.Database;

  /** 打开或创建 SQLite 库并迁移表结构 */
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
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        session_code  TEXT    NOT NULL REFERENCES sessions(session_code) ON DELETE CASCADE,
        role          TEXT    NOT NULL,
        content       TEXT    NOT NULL,
        reasoning     TEXT,
        error_message TEXT,
        error_detail  TEXT,
        status_message TEXT,
        ts            INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_code, id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
    `);

    // 兼容已有库：补齐 reasoning / error_* 列
    const cols = this.db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[];
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('reasoning')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN reasoning TEXT`);
    }
    if (!colNames.has('error_message')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN error_message TEXT`);
    }
    if (!colNames.has('error_detail')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN error_detail TEXT`);
    }
    if (!colNames.has('status_message')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN status_message TEXT`);
    }
  }

  /** 列出会话摘要*/
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

  /** 按 code 获取会话详情*/
  getSession(sessionCode: string): Session | undefined {
    const row = this.db
      .prepare(
        `SELECT session_code AS sessionCode, title, created_at AS createdAt, updated_at AS updatedAt
         FROM sessions WHERE session_code = ?`,
      )
      .get(sessionCode) as Omit<Session, 'messages'> | undefined;
    if (!row) return undefined;

    const messages = this.db
      .prepare(
        `SELECT id, role, content, reasoning,
                error_message AS errorMessage, error_detail AS errorDetail,
                status_message AS statusMessage, ts
         FROM messages WHERE session_code = ? ORDER BY id ASC`,
      )
      .all(sessionCode) as StoredMessage[];

    return {
      ...row,
      messages: messages.map((m) => ({
        ...m,
        reasoning: m.reasoning || undefined,
        errorMessage: m.errorMessage || undefined,
        errorDetail: m.errorDetail || undefined,
        statusMessage: m.statusMessage || undefined,
      })),
    };
  }

  /** 已有 sessionCode 则复用；不存在则抛错；无 code 则新建 UUID */
  ensureSession(sessionCode: string | undefined, title: string): Session {
    if (sessionCode) {
      const existing = this.getSession(sessionCode);
      if (existing) return existing;
      throw new SessionNotFoundError(sessionCode);
    }
    const now = Date.now();
    const session: Session = {
      sessionCode: randomUUID(),
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

  /** 追加消息并刷新会话 updated_at；返回 message id */
  appendMessage(
    sessionCode: string,
    role: Role,
    content: string,
    options?: {
      reasoning?: string;
      errorMessage?: string;
      errorDetail?: string;
      statusMessage?: string;
    },
  ): number {
    const now = Date.now();
    const result = this.db.transaction(() => {
      const insert = this.db
        .prepare(
          `INSERT INTO messages
             (session_code, role, content, reasoning, error_message, error_detail, status_message, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionCode,
          role,
          content,
          options?.reasoning || null,
          options?.errorMessage || null,
          options?.errorDetail || null,
          options?.statusMessage || null,
          now,
        );
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
      return insert;
    })();
    return Number(result.lastInsertRowid);
  }

  /** 末条若为 user 则删除 */
  deleteLastUserMessage(sessionCode: string): boolean {
    const last = this.db
      .prepare(
        `SELECT id, role FROM messages WHERE session_code = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(sessionCode) as { id: number; role: string } | undefined;
    if (!last || last.role !== 'user') return false;
    const now = Date.now();
    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM messages WHERE id = ?`).run(last.id);
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
    })();
    return true;
  }

  /** 末条若为 assistant 则删除 */
  deleteLastAssistantMessage(sessionCode: string): boolean {
    const last = this.db
      .prepare(
        `SELECT id, role FROM messages WHERE session_code = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(sessionCode) as { id: number; role: string } | undefined;
    if (!last || last.role !== 'assistant') return false;
    const now = Date.now();
    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM messages WHERE id = ?`).run(last.id);
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
    })();
    return true;
  }

  /** 保留前 keepCount 条（按 id 升序），删除其后所有消息 */
  truncateMessagesAfter(sessionCode: string, keepCount: number): number {
    const safeKeep = Math.max(0, Math.floor(keepCount));
    const now = Date.now();
    return this.db.transaction(() => {
      const ids = this.db
        .prepare(
          `SELECT id FROM messages WHERE session_code = ? ORDER BY id ASC`,
        )
        .all(sessionCode) as { id: number }[];
      if (ids.length <= safeKeep) return 0;
      const dropIds = ids.slice(safeKeep).map((r) => r.id);
      const placeholders = dropIds.map(() => '?').join(', ');
      const result = this.db
        .prepare(`DELETE FROM messages WHERE id IN (${placeholders})`)
        .run(...dropIds);
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
      return result.changes;
    })();
  }

  /** 删除单个会话*/
  deleteSession(sessionCode: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM sessions WHERE session_code = ?`)
      .run(sessionCode);
    return result.changes > 0;
  }

  /** 批量删除会话*/
  deleteSessions(sessionCodes: string[]): number {
    if (sessionCodes.length === 0) return 0;
    const placeholders = sessionCodes.map(() => '?').join(', ');
    const result = this.db
      .prepare(`DELETE FROM sessions WHERE session_code IN (${placeholders})`)
      .run(...sessionCodes);
    return result.changes;
  }
}

export const historyStore: HistoryStore = new SqliteHistoryStore();
