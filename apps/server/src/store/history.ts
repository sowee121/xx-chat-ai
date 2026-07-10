import { randomUUID } from 'node:crypto';
import type { Role, StreamChunk } from '../types.js';

export interface StoredMessage {
  id?: number;
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
  appendMessage(sessionCode: string, role: Role, content: string): number;
  /** 上一条 user+assistant 回合与 query/model 匹配时，返回可回放的流式 delta */
  findReplayDeltas(
    sessionCode: string,
    query: string,
    provider: string,
    model: string,
  ): StreamChunk[] | null;
  saveStreamCache(
    messageId: number,
    provider: string,
    model: string,
    deltas: StreamChunk[],
  ): void;
  deleteSession(sessionCode: string): void;
  deleteSessions(sessionCodes: string[]): void;
}

function titleFromQuery(query: string): string {
  const t = query.trim().replace(/\s+/g, ' ');
  return t.length > 30 ? `${t.slice(0, 30)}…` : t || '新建对话';
}

class InMemoryHistoryStore implements HistoryStore {
  private sessions = new Map<string, Session>();
  private nextMessageId = 1;
  private streamCache = new Map<
    number,
    { provider: string; model: string; deltas: StreamChunk[] }
  >();

  private findLastAssistantMessageId(sessionCode: string): number | undefined {
    const session = this.sessions.get(sessionCode);
    if (!session || session.messages.length < 2) return undefined;
    const last = session.messages[session.messages.length - 1];
    const prev = session.messages[session.messages.length - 2];
    if (last.role !== 'assistant' || prev.role !== 'user' || last.id == null) return undefined;
    return last.id;
  }

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

  appendMessage(sessionCode: string, role: Role, content: string): number {
    const session = this.sessions.get(sessionCode);
    if (!session) return 0;
    const id = this.nextMessageId++;
    session.messages.push({ id, role, content, ts: Date.now() });
    session.updatedAt = Date.now();
    return id;
  }

  findReplayDeltas(
    sessionCode: string,
    query: string,
    provider: string,
    model: string,
  ): StreamChunk[] | null {
    const session = this.sessions.get(sessionCode);
    if (!session || session.messages.length < 2) return null;

    const last = session.messages[session.messages.length - 1];
    const prev = session.messages[session.messages.length - 2];
    if (last.role !== 'assistant' || prev.role !== 'user') return null;
    if (prev.content !== query.trim()) return null;
    if (last.id == null) return null;

    const cached = this.streamCache.get(last.id);
    if (!cached || cached.provider !== provider || cached.model !== model) return null;
    return cached.deltas;
  }

  saveStreamCache(
    messageId: number,
    provider: string,
    model: string,
    deltas: StreamChunk[],
  ): void {
    this.streamCache.set(messageId, { provider, model, deltas });
  }

  deleteSession(sessionCode: string): void {
    const session = this.sessions.get(sessionCode);
    if (session) {
      for (const message of session.messages) {
        if (message.id != null) this.streamCache.delete(message.id);
      }
    }
    this.sessions.delete(sessionCode);
  }

  deleteSessions(sessionCodes: string[]): void {
    for (const sessionCode of sessionCodes) {
      this.deleteSession(sessionCode);
    }
  }
}

/** 内存实现，保留作为无 SQLite 环境的回退 / 测试用途；运行时默认使用 SqliteHistoryStore。 */
export { InMemoryHistoryStore, titleFromQuery };
