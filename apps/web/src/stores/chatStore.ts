import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, Provider, ProviderInfo, SessionSummary } from '@/lib/chat-types'
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
  _abort?: AbortController
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
  openSession: (sessionCode: string) => Promise<void>
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
      _abort: undefined,
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

      loadModels: async () => {
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
          // 模型列表加载失败时静默降级，保留配置默认模型
          const fallback = get().model
          set({ models: fallback ? [fallback] : [], model: fallback })
        }
      },

      loadProviders: async () => {
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
      },

      newChat: () => {
        get()._abort?.abort()
        set({ messages: [], sessionCode: undefined, error: undefined, isStreaming: false, _abort: undefined })
      },

      loadSessions: async () => {
        try {
          set({ sessions: await fetchSessions() })
        } catch {
          // 列表加载失败时静默降级，不阻塞主流程
        }
      },

      openSession: async (sessionCode) => {
        if (get().sessionCode === sessionCode && get().messages.length > 0) return
        get()._abort?.abort()
        try {
          const detail = await fetchSession(sessionCode)
          set({
            sessionCode: detail.sessionCode,
            messages: detail.messages.map((m) => ({ id: uid(), role: m.role, content: m.content })),
            isStreaming: false,
            error: undefined,
            _abort: undefined,
          })
        } catch (e) {
          set({ error: e instanceof Error ? e.message : '加载对话失败' })
        }
      },

      removeSession: async (sessionCode) => {
        try {
          await deleteSessionApi(sessionCode)
        } catch {
          // 忽略删除错误，仍尝试刷新列表
        }
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

        const history = state.messages.map((m) => ({ role: m.role, content: m.content }))
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
            onMeta: (meta) => set({ sessionCode: meta.sessionCode }),
            onDelta: appendToAssistant,
            onDone: () => set({ isStreaming: false, _abort: undefined }),
            onError: (message) => set({ error: message, isStreaming: false, _abort: undefined }),
          },
        )

        // 兜底：流程结束后确保状态复位
        if (get().isStreaming) set({ isStreaming: false, _abort: undefined })
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
