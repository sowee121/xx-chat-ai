import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, Provider, ProviderInfo, SessionSummary, StoredMessage } from '@/lib/chat-types'
import { streamChat } from '@/services/sseClient'
import {
  deleteSession as deleteSessionApi,
  deleteSessions as deleteSessionsApi,
  fetchSession,
  fetchSessions,
} from '@/services/historyApi'
import { fetchOpenaiModels, fetchProviders } from '@/services/providerApi'

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/** 合并进行中的同类请求（Strict Mode 下 effect 会执行两次） */
function once<T>(slot: { current: Promise<T> | null }, factory: () => Promise<T>): Promise<T> {
  if (slot.current) return slot.current
  slot.current = factory().finally(() => {
    slot.current = null
  })
  return slot.current
}

const loadProvidersOnce = { current: null as Promise<void> | null }
const loadSessionsOnce = { current: null as Promise<void> | null }
const loadModelsOnce = { current: null as Promise<void> | null }
const sessionDetailInflight = new Map<string, Promise<Awaited<ReturnType<typeof fetchSession>>>>()

function fetchSessionDeduped(sessionCode: string) {
  const existing = sessionDetailInflight.get(sessionCode)
  if (existing) return existing
  const promise = fetchSession(sessionCode).finally(() => {
    if (sessionDetailInflight.get(sessionCode) === promise) sessionDetailInflight.delete(sessionCode)
  })
  sessionDetailInflight.set(sessionCode, promise)
  return promise
}

function isStaleRouteLoad(requestedSeq: number): boolean {
  return requestedSeq !== useChatStore.getState()._routeLoadSeq
}

/** 内存缓存：切回已访问会话时复用同一批 message 对象，避免图片/Markdown 重挂载闪动 */
const sessionMessagesCache = new Map<string, ChatMessage[]>()

function toChatMessages(stored: StoredMessage[]): ChatMessage[] {
  return stored.map((m) => ({
    id: m.id != null ? `msg-${m.id}` : uid(),
    role: m.role,
    content: m.content,
  }))
}

function snapshotMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({ ...m }))
}

function messagesEqual(a: ChatMessage[], b: ChatMessage[]): boolean {
  if (a.length !== b.length) return false
  return a.every((m, i) => m.id === b[i].id && m.role === b[i].role && m.content === b[i].content)
}

function syncSessionCache(sessionCode: string, messages: ChatMessage[]) {
  sessionMessagesCache.set(sessionCode, snapshotMessages(messages))
}

function dropSessionCache(sessionCode: string) {
  sessionMessagesCache.delete(sessionCode)
}

export function getCachedSessionMessages(sessionCode: string): ChatMessage[] | undefined {
  return sessionMessagesCache.get(sessionCode)
}

/** Keep-alive 上限：超出时按 LRU 卸载非当前会话的面板与消息缓存 */
const MAX_MOUNTED_SESSIONS = 10

type ChatStoreSet = (
  partial:
    | Partial<ChatState>
    | ((state: ChatState) => Partial<ChatState>),
) => void
type ChatStoreGet = () => ChatState

function mountSessionCode(get: ChatStoreGet, set: ChatStoreSet, sessionCode: string): void {
  const activeCode = get().sessionCode

  let mounted = [...get().mountedSessionCodes]
  const idx = mounted.indexOf(sessionCode)
  if (idx >= 0) mounted.splice(idx, 1)
  mounted.push(sessionCode)

  const evicted: string[] = []
  while (mounted.length > MAX_MOUNTED_SESSIONS) {
    const victim = mounted.find((c) => c !== sessionCode && c !== activeCode)
    if (!victim) break
    evicted.push(victim)
    mounted = mounted.filter((c) => c !== victim)
  }

  for (const code of evicted) dropSessionCache(code)
  set({ mountedSessionCodes: mounted })
}

interface ChatState {
  messages: ChatMessage[]
  provider: Provider
  providerOptions: ProviderInfo[]
  model?: string
  models: string[]
  sessionCode?: string
  isStreaming: boolean
  error?: string
  sessions: SessionSummary[]
  /** 侧栏历史列表首次加载中（已有数据时静默刷新，不闪骨架） */
  sessionsLoading: boolean
  /** 已挂载的消息列表（keep-alive，切换时隐藏而非卸载） */
  mountedSessionCodes: string[]
  _abort?: AbortController
  /** 路由切换序号，用于丢弃过期的 openSession 结果 */
  _routeLoadSeq: number
  composerPrefillSeq: number
  composerPrefillText: string

  setProvider: (provider: Provider) => void
  setModel: (model: string) => void
  prefillComposer: (text: string) => void
  send: (query: string) => Promise<void>
  stop: () => void
  newChat: () => void
  loadProviders: () => Promise<void>
  loadModels: () => Promise<void>
  loadSessions: () => Promise<void>
  openSession: (sessionCode: string) => Promise<boolean>
  removeSession: (sessionCode: string) => Promise<void>
  removeSessions: (sessionCodes: string[]) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      provider: 'mock',
      providerOptions: [
        { id: 'mock', label: 'Mock', available: true },
        { id: 'openai', label: 'OpenAI', available: false, reason: '正在检测配置…' },
      ],
      model: undefined,
      models: [],
      sessionCode: undefined,
      isStreaming: false,
      error: undefined,
      sessions: [],
      sessionsLoading: true,
      mountedSessionCodes: [],
      _abort: undefined,
      _routeLoadSeq: 0,
      composerPrefillSeq: 0,
      composerPrefillText: '',

      setProvider: (provider) => {
        const option = get().providerOptions.find((p) => p.id === provider)
        if (option && !option.available) {
          set({ error: option.reason ?? '该 Provider 当前不可用' })
          return
        }
        set({ provider, error: undefined })
        if (provider === 'openai') void get().loadModels()
      },

      setModel: (model) => set({ model }),

      prefillComposer: (text) =>
        set((s) => ({
          composerPrefillText: text,
          composerPrefillSeq: s.composerPrefillSeq + 1,
        })),

      loadModels: async () =>
        once(loadModelsOnce, async () => {
          try {
            const data = await fetchOpenaiModels()
            const current = get().model
            const nextModel =
              current && data.models.includes(current)
                ? current
                : data.defaultModel && data.models.includes(data.defaultModel)
                  ? data.defaultModel
                  : data.models[0]
            set({ models: data.models, model: nextModel })
          } catch {
            const fallback = get().model
            set({ models: fallback ? [fallback] : [], model: fallback })
          }
        }),

      loadProviders: async () =>
        once(loadProvidersOnce, async () => {
          try {
            const data = await fetchProviders()
            const current = get().provider
            const currentOption = data.providers.find((p) => p.id === current)
            const nextProvider =
              currentOption?.available === false ? data.defaultProvider : current

            set({
              providerOptions: data.providers,
              provider: nextProvider,
            })

            if (nextProvider === 'openai') {
              await get().loadModels()
            }
          } catch {
            // 探测失败时保留 mock，不阻塞主流程
          }
        }),

      newChat: () => {
        get()._abort?.abort()
        set({
          messages: [],
          sessionCode: undefined,
          error: undefined,
          isStreaming: false,
          _abort: undefined,
          mountedSessionCodes: [],
        })
      },

      loadSessions: async () =>
        once(loadSessionsOnce, async () => {
          const showLoading = get().sessions.length === 0
          if (showLoading) set({ sessionsLoading: true })
          try {
            set({ sessions: await fetchSessions() })
          } catch {
            // 列表加载失败时静默降级，不阻塞主流程
          } finally {
            if (showLoading) set({ sessionsLoading: false })
          }
        }),

      openSession: async (sessionCode) => {
        if (get().sessionCode === sessionCode && get().messages.length > 0) {
          mountSessionCode(get, set, sessionCode)
          return true
        }

        const loadSeqAtCall = get()._routeLoadSeq
        const prevCode = get().sessionCode

        get()._abort?.abort()
        if (prevCode && prevCode !== sessionCode) {
          syncSessionCache(prevCode, get().messages)
        }

        mountSessionCode(get, set, sessionCode)

        const cached = sessionMessagesCache.get(sessionCode)
        if (cached !== undefined) {
          set({
            sessionCode,
            messages: cached,
            error: undefined,
            isStreaming: false,
            _abort: undefined,
          })
          return true
        }

        if (prevCode !== sessionCode) {
          set({
            messages: [],
            sessionCode: undefined,
            error: undefined,
            isStreaming: false,
            _abort: undefined,
          })
        }

        try {
          const detail = await fetchSessionDeduped(sessionCode)
          if (isStaleRouteLoad(loadSeqAtCall)) return true

          const fetched = toChatMessages(detail.messages)
          const prevCached = sessionMessagesCache.get(sessionCode)
          const messages =
            prevCached && messagesEqual(prevCached, fetched) ? prevCached : fetched

          if (messages !== prevCached) syncSessionCache(sessionCode, messages)

          const state = get()
          if (
            state.sessionCode === detail.sessionCode &&
            state.messages === messages &&
            !state.error &&
            !state.isStreaming
          ) {
            return true
          }

          set({
            sessionCode: detail.sessionCode,
            messages,
            isStreaming: false,
            error: undefined,
            _abort: undefined,
          })
          return true
        } catch (e) {
          if (isStaleRouteLoad(loadSeqAtCall)) return true
          set({
            error: e instanceof Error ? e.message : '加载对话失败',
            messages: [],
            sessionCode: undefined,
            isStreaming: false,
            _abort: undefined,
          })
          return false
        }
      },

      removeSession: async (sessionCode) => {
        try {
          await deleteSessionApi(sessionCode)
        } catch {
          // 忽略删除错误，仍尝试刷新列表
        }
        dropSessionCache(sessionCode)
        set((s) => ({
          mountedSessionCodes: s.mountedSessionCodes.filter((c) => c !== sessionCode),
        }))
        if (get().sessionCode === sessionCode) get().newChat()
        await get().loadSessions()
      },

      removeSessions: async (sessionCodes) => {
        if (sessionCodes.length === 0) return
        try {
          await deleteSessionsApi(sessionCodes)
        } catch {
          // 忽略删除错误，仍尝试刷新列表
        }
        for (const code of sessionCodes) dropSessionCache(code)
        set((s) => ({
          mountedSessionCodes: s.mountedSessionCodes.filter((c) => !sessionCodes.includes(c)),
        }))
        const current = get().sessionCode
        if (current && sessionCodes.includes(current)) get().newChat()
        await get().loadSessions()
      },

      stop: () => {
        get()._abort?.abort()
        set({ isStreaming: false, _abort: undefined })
      },

      send: async (query) => {
        const trimmed = query.trim()
        const state = get()
        if (!trimmed || state.isStreaming) return

        const history = state.messages
          .filter((m) => m.role !== 'assistant' || m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content }))
        const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed }
        const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', reasoning: '' }

        const ac = new AbortController()
        set({
          messages: [...state.messages, userMsg, assistantMsg],
          isStreaming: true,
          error: undefined,
          _abort: ac,
        })

        const appendToAssistant = (delta: { type: 'reasoning' | 'text'; content: string }) =>
          set((s) => {
            const messages = s.messages.slice()
            const last = messages[messages.length - 1]
            if (last && last.role === 'assistant') {
              if (delta.type === 'reasoning') {
                messages[messages.length - 1] = {
                  ...last,
                  reasoning: (last.reasoning ?? '') + delta.content,
                }
              } else {
                messages[messages.length - 1] = {
                  ...last,
                  content: last.content + delta.content,
                }
              }
            }
            return { messages }
          })

        await streamChat(
          {
            query: trimmed,
            sessionCode: get().sessionCode,
            provider: get().provider,
            model: get().provider === 'openai' ? get().model : undefined,
            messages: history,
            signal: ac.signal,
          },
          {
            onMeta: (meta) => {
              mountSessionCode(get, set, meta.sessionCode)
              set({ sessionCode: meta.sessionCode })
            },
            onDelta: appendToAssistant,
            onDone: () => set({ isStreaming: false, _abort: undefined }),
            onError: (message) => set({ error: message, isStreaming: false, _abort: undefined }),
          },
        )

        // 兜底：流程结束后确保状态复位
        if (get().isStreaming) set({ isStreaming: false, _abort: undefined })
        const code = get().sessionCode
        if (code) syncSessionCache(code, get().messages)
        // 刷新侧栏会话列表（标题、更新时间、新会话）
        void get().loadSessions()
      },
    }),
    {
      name: 'xx-chat-ai',
      partialize: (s) => ({ provider: s.provider, model: s.model }),
    },
  ),
)
