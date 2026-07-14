/**
 * 历史存储接口与内存实现（无 SQLite 时回退）
 */
import { randomUUID } from 'node:crypto';
import type { Role } from '../types.js';

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
  /** 本轮失败面向用户的中文说明；与 content 分离 */
  errorMessage?: string;
  /** 上游明细，形如 `type: message` */
  errorDetail?: string;
  /** 软状态提示（如已停止生成）；非错误、不入多轮 */
  statusMessage?: string;
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
  /** 追加一条消息（assistant 可带 reasoning / 错误字段） */
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
  ): number;
  /**
   * 若会话最后一条是 user，则删除之（保留接口；业务错误路径不再调用）
   * @returns 是否删除成功
   */
  deleteLastUserMessage(sessionCode: string): boolean;
  /**
   * 若会话最后一条是 assistant，则删除之（重新生成前清掉旧助手）
   * @returns 是否删除成功
   */
  deleteLastAssistantMessage(sessionCode: string): boolean;
  /**
   * 按顺序保留前 keepCount 条，删除之后全部（重新生成截断后续）
   * @returns 实际删除条数
   */
  truncateMessagesAfter(sessionCode: string, keepCount: number): number;
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
    const session = this.sessions.get(sessionCode);
    if (!session) return 0;
    const id = this.nextMessageId++;
    const msg: StoredMessage = { id, role, content, ts: Date.now() };
    if (options?.reasoning) msg.reasoning = options.reasoning;
    if (options?.errorMessage) msg.errorMessage = options.errorMessage;
    if (options?.errorDetail) msg.errorDetail = options.errorDetail;
    if (options?.statusMessage) msg.statusMessage = options.statusMessage;
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

  /** 删除末条 assistant 消息 */
  deleteLastAssistantMessage(sessionCode: string): boolean {
    const session = this.sessions.get(sessionCode);
    if (!session || session.messages.length === 0) return false;
    const last = session.messages[session.messages.length - 1];
    if (last.role !== 'assistant') return false;
    session.messages.pop();
    session.updatedAt = Date.now();
    return true;
  }

  /** 保留前 keepCount 条，删除其后所有消息 */
  truncateMessagesAfter(sessionCode: string, keepCount: number): number {
    const session = this.sessions.get(sessionCode);
    if (!session) return 0;
    const safeKeep = Math.max(0, Math.floor(keepCount));
    if (session.messages.length <= safeKeep) return 0;
    const removed = session.messages.length - safeKeep;
    session.messages = session.messages.slice(0, safeKeep);
    session.updatedAt = Date.now();
    return removed;
  }

  /** 删除单个会话*/
  deleteSession(sessionCode: string): boolean {
    return this.sessions.delete(sessionCode);
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
