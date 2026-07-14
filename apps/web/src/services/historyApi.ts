/**
 * 历史对话 HTTP API 封装
 */
import type { SessionDetail, SessionSummary } from '@/lib/chat-types'
import { SESSION_GONE_MESSAGE } from '@/lib/sessionGone'

/** 拉取历史会话列表*/
export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/history')
  if (!res.ok) throw new Error('加载对话列表失败')
  const data = (await res.json()) as { sessions: SessionSummary[] }
  return data.sessions
}

/** 拉取会话详情*/
export async function fetchSession(sessionCode: string): Promise<SessionDetail> {
  const res = await fetch(`/api/history/${sessionCode}`)
  if (res.status === 404) throw new Error(SESSION_GONE_MESSAGE)
  if (!res.ok) throw new Error('加载对话失败')
  return (await res.json()) as SessionDetail
}

/** 删除单个会话*/
export async function deleteSession(sessionCode: string): Promise<void> {
  const res = await fetch(`/api/history/${sessionCode}`, { method: 'DELETE' })
  if (res.status === 404) throw new Error(SESSION_GONE_MESSAGE)
  if (!res.ok) throw new Error('删除对话失败')
}

/** 批量删除会话*/
export async function deleteSessions(sessionCodes: string[]): Promise<void> {
  const res = await fetch('/api/history/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionCodes }),
  })
  if (res.status === 404) throw new Error(SESSION_GONE_MESSAGE)
  if (!res.ok) throw new Error('批量删除失败')
}
