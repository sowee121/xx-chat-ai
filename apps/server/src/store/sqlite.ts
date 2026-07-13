/**
 * SQLite 历史存储：会话、消息、reasoning、流回放缓存。
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Role, StreamChunk } from '../types.js';
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
        reasoning    TEXT,
        ts           INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_code, id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
      CREATE TABLE IF NOT EXISTS stream_replay_cache (
        message_id   INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
        provider     TEXT    NOT NULL,
        model        TEXT    NOT NULL,
        deltas_json  TEXT    NOT NULL
      );
    `);

    // 兼容已有库：旧表无 reasoning 列时补上
    const cols = this.db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[];
    if (!cols.some((c) => c.name === 'reasoning')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN reasoning TEXT`);
    }
  }

  /** 取会话末尾 user+assistant 对，供防重查询 */
  private getLastMessagePair(sessionCode: string): { user: StoredMessage; assistant: StoredMessage } | null {
    const rows = this.db
      .prepare(
        `SELECT id, role, content, ts
         FROM messages
         WHERE session_code = ?
         ORDER BY id ASC`,
      )
      .all(sessionCode) as StoredMessage[];

    if (rows.length < 2) return null;
    const assistant = rows[rows.length - 1];
    const user = rows[rows.length - 2];
    if (assistant.role !== 'assistant' || user.role !== 'user' || assistant.id == null) return null;
    return { user, assistant };
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
      .prepare(
        `SELECT id, role, content, reasoning, ts FROM messages WHERE session_code = ? ORDER BY id ASC`,
      )
      .all(sessionCode) as StoredMessage[];

    return {
      ...row,
      messages: messages.map((m) => ({
        ...m,
        reasoning: m.reasoning || undefined,
      })),
    };
  }

  /** 已有 sessionCode 则复用；否则新建（含客户端传入但尚不存在的 code） */
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

  /** 追加消息并刷新会话 updated_at；返回 message id */
  appendMessage(sessionCode: string, role: Role, content: string, reasoning?: string): number {
    const now = Date.now();
    const result = this.db.transaction(() => {
      const insert = this.db
        .prepare(
          `INSERT INTO messages (session_code, role, content, reasoning, ts) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(sessionCode, role, content, reasoning || null, now);
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE session_code = ?`)
        .run(now, sessionCode);
      return insert;
    })();
    return Number(result.lastInsertRowid);
  }

  /** 末轮 user 文案与 provider/model 均匹配时返回缓存 delta（含 reasoning） */
  findReplayDeltas(
    sessionCode: string,
    query: string,
    provider: string,
    model: string,
  ): StreamChunk[] | null {
    const pair = this.getLastMessagePair(sessionCode);
    if (!pair) return null;
    if (pair.user.content !== query.trim()) return null;

    const cache = this.db
      .prepare(
        `SELECT provider, model, deltas_json
         FROM stream_replay_cache
         WHERE message_id = ?`,
      )
      .get(pair.assistant.id) as
      | { provider: string; model: string; deltas_json: string }
      | undefined;

    if (!cache || cache.provider !== provider || cache.model !== model) return null;

    try {
      return JSON.parse(cache.deltas_json) as StreamChunk[];
    } catch {
      return null;
    }
  }

  /** 按 assistant message_id 覆盖写入完整流缓存 */
  saveStreamCache(
    messageId: number,
    provider: string,
    model: string,
    deltas: StreamChunk[],
  ): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO stream_replay_cache (message_id, provider, model, deltas_json)
         VALUES (?, ?, ?, ?)`,
      )
      .run(messageId, provider, model, JSON.stringify(deltas));
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
