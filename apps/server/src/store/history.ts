import { randomUUID } from 'node:crypto';
import type { Role } from '../types.js';

export interface StoredMessage {
  role: Role;
  content: string;
  ts: number;
}

export interface Session {
  sessionCode: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export interface SessionSummary {
  sessionCode: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * 历史会话存储接口。第 2 步用内存实现，第 5 步换成 better-sqlite3，保持接口不变。
 */
export interface HistoryStore {
  listSessions(): SessionSummary[];
  getSession(sessionCode: string): Session | undefined;
  /** 确保会话存在（不存在则以 title 创建），返回会话。 */
  ensureSession(sessionCode: string | undefined, title: string): Session;
  appendMessage(sessionCode: string, role: Role, content: string): void;
  deleteSession(sessionCode: string): void;
}

function titleFromQuery(query: string): string {
  const t = query.trim().replace(/\s+/g, ' ');
  return t.length > 30 ? `${t.slice(0, 30)}…` : t || '新对话';
}

class InMemoryHistoryStore implements HistoryStore {
  private sessions = new Map<string, Session>();

  listSessions(): SessionSummary[] {
    return [...this.sessions.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        sessionCode: s.sessionCode,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      }));
  }

  getSession(sessionCode: string): Session | undefined {
    return this.sessions.get(sessionCode);
  }

  ensureSession(sessionCode: string | undefined, title: string): Session {
    if (sessionCode) {
      const existing = this.sessions.get(sessionCode);
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
    this.sessions.set(session.sessionCode, session);
    return session;
  }

  appendMessage(sessionCode: string, role: Role, content: string): void {
    const session = this.sessions.get(sessionCode);
    if (!session) return;
    session.messages.push({ role, content, ts: Date.now() });
    session.updatedAt = Date.now();
  }

  deleteSession(sessionCode: string): void {
    this.sessions.delete(sessionCode);
  }
}

/** 内存实现，保留作为无 SQLite 环境的回退 / 测试用途；运行时默认使用 SqliteHistoryStore。 */
export { InMemoryHistoryStore, titleFromQuery };
