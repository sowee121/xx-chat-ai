import type { SessionDetail, SessionSummary } from '@/lib/chat-types'

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/history')
  if (!res.ok) throw new Error('加载会话列表失败')
  const data = (await res.json()) as { sessions: SessionSummary[] }
  return data.sessions
}

export async function fetchSession(sessionCode: string): Promise<SessionDetail> {
  const res = await fetch(`/api/history/${sessionCode}`)
  if (!res.ok) throw new Error('加载会话失败')
  return (await res.json()) as SessionDetail
}

export async function deleteSession(sessionCode: string): Promise<void> {
  const res = await fetch(`/api/history/${sessionCode}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('删除会话失败')
}
