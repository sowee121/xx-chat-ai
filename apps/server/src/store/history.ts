/**
 * 历史存储接口与内存实现（无 SQLite 时回退）
 */
import { randomUUID } from 'node:crypto';
import type { Role, StreamChunk } from '../types.js';

/** 客户端传入的 sessionCode 在库中不存在 */
export class SessionNotFoundError extends Error {
  /** 标记会话不存在错误 */
  constructor(sessionCode: string) {
    super(`session not found: ${sessionCode}`);
    this.name = 'SessionNotFoundError';
  }
}

export interface StoredMessage {
  id?: number;
  role: Role;
  content: string;
  /** 思考过程；仅 assistant 可选；展示用，不回传上游 */
  reasoning?: string;
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
 * 历史会话存储接口。第 2 步用内存实现，第 5 步换成 better-sqlite3，保持接口不变
 */
export interface HistoryStore {
  /** 列出会话摘要*/
  listSessions(): SessionSummary[];
  /** 按 code 获取会话详情*/
  getSession(sessionCode: string): Session | undefined;
  /**
   * 确保会话存在并返回
   * - 无 sessionCode：新建（服务端生成 UUID）
   * - 有 sessionCode 且存在：返回已有会话
   * - 有 sessionCode 但不存在：抛出 SessionNotFoundError（不静默建空壳）
   */
  ensureSession(sessionCode: string | undefined, title: string): Session;
  /** 追加一条消息*/
  appendMessage(sessionCode: string, role: Role, content: string, reasoning?: string): number;
  /**
   * 若会话最后一条是 user，则删除之（建连失败回滚孤儿 user）
   * @returns 是否删除成功
   */
  deleteLastUserMessage(sessionCode: string): boolean;
  /** 上一条 user+assistant 回合与 query/model 匹配时，返回可回放的流式 delta */
  findReplayDeltas(
    sessionCode: string,
    query: string,
    provider: string,
    model: string,
  ): StreamChunk[] | null;
  /** 保存流式回放缓存*/
  saveStreamCache(
    messageId: number,
    provider: string,
    model: string,
    deltas: StreamChunk[],
  ): void;
  /** 删除单个会话*/
  deleteSession(sessionCode: string): boolean;
  /** @returns 实际删除条数 */
  deleteSessions(sessionCodes: string[]): number;
}

/** 由首条提问生成会话标题*/
export function titleFromQuery(query: string): string {
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

  /** 查找末轮 assistant 消息 id */
  private findLastAssistantMessageId(sessionCode: string): number | undefined {
    const session = this.sessions.get(sessionCode);
    if (!session || session.messages.length < 2) return undefined;
    const last = session.messages[session.messages.length - 1];
    const prev = session.messages[session.messages.length - 2];
    if (last.role !== 'assistant' || prev.role !== 'user' || last.id == null) return undefined;
    return last.id;
  }

  /** 列出会话摘要*/
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

  /** 按 code 获取会话详情*/
  getSession(sessionCode: string): Session | undefined {
    return this.sessions.get(sessionCode);
  }

  /** 确保会话存在并返回*/
  ensureSession(sessionCode: string | undefined, title: string): Session {
    if (sessionCode) {
      const existing = this.sessions.get(sessionCode);
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
    this.sessions.set(session.sessionCode, session);
    return session;
  }

  /** 追加一条消息*/
  appendMessage(sessionCode: string, role: Role, content: string, reasoning?: string): number {
    const session = this.sessions.get(sessionCode);
    if (!session) return 0;
    const id = this.nextMessageId++;
    const msg: StoredMessage = { id, role, content, ts: Date.now() };
    if (reasoning) msg.reasoning = reasoning;
    session.messages.push(msg);
    session.updatedAt = Date.now();
    return id;
  }

  /** 删除末条 user 消息*/
  deleteLastUserMessage(sessionCode: string): boolean {
    const session = this.sessions.get(sessionCode);
    if (!session || session.messages.length === 0) return false;
    const last = session.messages[session.messages.length - 1];
    if (last.role !== 'user') return false;
    session.messages.pop();
    session.updatedAt = Date.now();
    return true;
  }

  /** 查找可回放的流式缓存*/
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

  /** 保存流式回放缓存*/
  saveStreamCache(
    messageId: number,
    provider: string,
    model: string,
    deltas: StreamChunk[],
  ): void {
    this.streamCache.set(messageId, { provider, model, deltas });
  }

  /** 删除单个会话*/
  deleteSession(sessionCode: string): boolean {
    const session = this.sessions.get(sessionCode);
    if (!session) return false;
    for (const message of session.messages) {
      if (message.id != null) this.streamCache.delete(message.id);
    }
    this.sessions.delete(sessionCode);
    return true;
  }

  /** 批量删除会话*/
  deleteSessions(sessionCodes: string[]): number {
    let deleted = 0;
    for (const sessionCode of sessionCodes) {
      if (this.deleteSession(sessionCode)) deleted += 1;
    }
    return deleted;
  }
}

/** 内存实现，保留作为无 SQLite 环境的回退 / 测试用途；运行时默认使用 SqliteHistoryStore*/
export { InMemoryHistoryStore };
