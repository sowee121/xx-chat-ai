/**
 * 历史对话 HTTP API 封装。
 */
import type { SessionDetail, SessionSummary } from '@/lib/chat-types'

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/history')
  if (!res.ok) throw new Error('加载对话列表失败')
  const data = (await res.json()) as { sessions: SessionSummary[] }
  return data.sessions
}

export async function fetchSession(sessionCode: string): Promise<SessionDetail> {
  const res = await fetch(`/api/history/${sessionCode}`)
  if (res.status === 404) throw new Error('对话不存在或已删除')
  if (!res.ok) throw new Error('加载对话失败')
  return (await res.json()) as SessionDetail
}

export async function deleteSession(sessionCode: string): Promise<void> {
  const res = await fetch(`/api/history/${sessionCode}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('删除对话失败')
}

export async function deleteSessions(sessionCodes: string[]): Promise<void> {
  const res = await fetch('/api/history/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionCodes }),
  })
  if (!res.ok) throw new Error('批量删除失败')
}
