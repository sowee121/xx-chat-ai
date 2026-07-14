/**
 * 聊天全局状态：SSE 发送、会话缓存、Keep-Alive 与 Provider/模型
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, Provider, ProviderInfo, SessionSummary, StoredMessage } from '@/lib/chat-types'
import { isPendingSessionCode, PENDING_SESSION_CODE } from '@/lib/pendingSession'
import { GENERATION_STOPPED_MESSAGE } from '@/lib/generationStopped'
import { REASONING_ONLY_PLACEHOLDER } from '@/lib/reasoningPlaceholder'
import { isSessionGoneMessage } from '@/lib/sessionGone'
import { streamChat } from '@/services/sseClient'
import {
  deleteSession as deleteSessionApi,
  deleteSessions as deleteSessionsApi,
  fetchSession,
  fetchSessions,
} from '@/services/historyApi'
import { fetchOpenaiModels, fetchProviders } from '@/services/providerApi'
import { showToast } from '@/stores/toastStore'

/** 生成前端临时消息 id*/
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
/** 同一 sessionCode 详情请求去重（Strict Mode 双 effect） */
const sessionDetailInflight = new Map<string, Promise<Awaited<ReturnType<typeof fetchSession>>>>()

/** 同一会话详情请求去重*/
function fetchSessionDeduped(sessionCode: string) {
  const existing = sessionDetailInflight.get(sessionCode)
  if (existing) return existing
  const promise = fetchSession(sessionCode).finally(() => {
    if (sessionDetailInflight.get(sessionCode) === promise) sessionDetailInflight.delete(sessionCode)
  })
  sessionDetailInflight.set(sessionCode, promise)
  return promise
}

/** 路由竞态：序号变化则丢弃过期 openSession 结果 */
function isStaleRouteLoad(requestedSeq: number): boolean {
  return requestedSeq !== useChatStore.getState()._routeLoadSeq
}

/** 内存缓存：切回已访问会话时复用同一批 message 对象，避免图片/Markdown 重挂载闪动 */
const sessionMessagesCache = new Map<string, ChatMessage[]>()

/** 服务端 id → 稳定前端 id，减少重挂载闪动 */
function toChatMessages(stored: StoredMessage[]): ChatMessage[] {
  return stored.map((m) => ({
    id: m.id != null ? `msg-${m.id}` : uid(),
    role: m.role,
    content: m.content,
    ...(m.reasoning ? { reasoning: m.reasoning } : {}),
    ...(m.errorMessage ? { errorMessage: m.errorMessage } : {}),
    ...(m.errorDetail ? { errorDetail: m.errorDetail } : {}),
    ...(m.statusMessage ? { statusMessage: m.statusMessage } : {}),
  }))
}

/** 深拷贝消息列表快照*/
function snapshotMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({ ...m }))
}

/** 比较两批消息内容是否一致*/
function messagesEqual(a: ChatMessage[], b: ChatMessage[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (m, i) =>
      m.id === b[i].id &&
      m.role === b[i].role &&
      m.content === b[i].content &&
      (m.reasoning ?? '') === (b[i].reasoning ?? '') &&
      (m.errorMessage ?? '') === (b[i].errorMessage ?? '') &&
      (m.errorDetail ?? '') === (b[i].errorDetail ?? '') &&
      (m.statusMessage ?? '') === (b[i].statusMessage ?? ''),
  )
}

/** 将会话消息写入内存缓存*/
function syncSessionCache(sessionCode: string, messages: ChatMessage[]) {
  if (isPendingSessionCode(sessionCode)) return
  sessionMessagesCache.set(sessionCode, snapshotMessages(messages))
}

/** 丢弃指定会话的消息缓存*/
function dropSessionCache(sessionCode: string) {
  if (isPendingSessionCode(sessionCode)) return
  sessionMessagesCache.delete(sessionCode)
}

/** 会话已在服务端不存在：清缓存、卸面板、侧栏去掉幽灵项并静默刷新列表 */
function evictGhostSession(get: ChatStoreGet, set: ChatStoreSet, sessionCode: string): void {
  dropSessionCache(sessionCode)
  set((s) => ({
    mountedSessionCodes: s.mountedSessionCodes.filter((c) => c !== sessionCode),
    sessions: s.sessions.filter((sess) => sess.sessionCode !== sessionCode),
  }))
  void get().loadSessions()
}

/** 读取会话消息缓存*/
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

/** 将 sessionCode 记入挂载列表，超限淘汰最旧非当前会话 */
function mountSessionCode(get: ChatStoreGet, set: ChatStoreSet, sessionCode: string): void {
  const activeCode = get().sessionCode

  let mounted = [...get().mountedSessionCodes]
  const idx = mounted.indexOf(sessionCode)
  if (idx >= 0) mounted.splice(idx, 1)
  mounted.push(sessionCode)

  const evicted: string[] = []
  while (mounted.length > MAX_MOUNTED_SESSIONS) {
    const victim = mounted.find(
      (c) => c !== sessionCode && c !== activeCode && !isPendingSessionCode(c),
    )
    if (!victim) break
    evicted.push(victim)
    mounted = mounted.filter((c) => c !== victim)
  }

  for (const code of evicted) dropSessionCache(code)
  set({ mountedSessionCodes: mounted })
}

/** 构造发给模型的多轮正文（不含 reasoning / 错误 / 停止提示） */
function toHistoryPayload(messages: ChatMessage[]): { role: ChatMessage['role']; content: string }[] {
  return messages
    .filter((m) => {
      if (m.role !== 'assistant') return true
      if (m.errorMessage && !m.content.trim()) return false
      if (m.statusMessage && !m.content.trim()) return false
      const content = m.content.trim()
      if (!content) return false
      if (content === REASONING_ONLY_PLACEHOLDER) return false
      return true
    })
    .map((m) => ({ role: m.role, content: m.content }))
}

/** 仅推理无正文：与服务端落库占位对齐 */
function applyReasoningOnlyPlaceholder(set: ChatStoreSet): void {
  set((s) => {
    const messages = s.messages.slice()
    const last = messages[messages.length - 1]
    if (
      last?.role === 'assistant' &&
      !last.errorMessage &&
      !last.content.trim() &&
      (last.reasoning ?? '').trim()
    ) {
      messages[messages.length - 1] = { ...last, content: REASONING_ONLY_PLACEHOLDER }
      return { messages }
    }
    return {}
  })
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
  /** 上游明细，形如 `type: message` */
  errorDetail?: string
  sessions: SessionSummary[]
  /** 侧栏历史列表首次加载中（已有数据时静默刷新，不闪骨架） */
  sessionsLoading: boolean
  /** 已挂载的消息列表（keep-alive，切换时隐藏而非卸载） */
  mountedSessionCodes: string[]
  _abort?: AbortController
  /** 路由切换序号，用于丢弃过期的 openSession 结果 */
  _routeLoadSeq: number
  /** 流式请求世代：切会话 / stop 后迟到回调丢弃 */
  _streamSeq: number
  /** 会话已删序号：发送路径 404 后触发 URL 回首页 */
  sessionGoneSeq: number
  composerPrefillSeq: number
  composerPrefillText: string

  setProvider: (provider: Provider) => void
  setModel: (model: string) => void
  prefillComposer: (text: string) => void
  /** 暗门：展示流式错误红条（不发起请求） */
  previewError: (message?: string) => void
  send: (query: string) => Promise<void>
  /** 重新生成指定助手：截断该条及后续后重拉（不追加 user） */
  regenerate: (assistantMessageId: string) => Promise<void>
  stop: () => void
  newChat: () => void
  loadProviders: () => Promise<void>
  loadModels: () => Promise<void>
  loadSessions: () => Promise<void>
  openSession: (sessionCode: string) => Promise<boolean>
  removeSession: (sessionCode: string) => Promise<boolean>
  removeSessions: (sessionCodes: string[]) => Promise<boolean>
}

/** 发送 / 重新生成共用的助手流式生命周期 */
async function runAssistantStream(
  get: ChatStoreGet,
  set: ChatStoreSet,
  opts: {
    query: string
    sessionCode?: string
    regenerate?: boolean
    keepMessageCount?: number
    messages: { role: ChatMessage['role']; content: string }[]
    signal: AbortSignal
    streamToken: number
  },
): Promise<void> {
  const isStreamActive = () => get()._streamSeq === opts.streamToken

  const appendToAssistant = (delta: { type: 'reasoning' | 'text'; content: string }) => {
    if (!isStreamActive()) return
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
  }

  await streamChat(
    {
      query: opts.query,
      sessionCode: opts.sessionCode,
      regenerate: opts.regenerate,
      keepMessageCount: opts.keepMessageCount,
      provider: get().provider,
      model: get().provider === 'openai' ? get().model : undefined,
      messages: opts.messages,
      signal: opts.signal,
    },
    {
      onMeta: (meta) => {
        if (!isStreamActive()) return
        set((s) => ({
          mountedSessionCodes: s.mountedSessionCodes.filter((c) => !isPendingSessionCode(c)),
        }))
        mountSessionCode(get, set, meta.sessionCode)
        set({ sessionCode: meta.sessionCode })
        void get().loadSessions()
      },
      onDelta: appendToAssistant,
      onDone: () => {
        if (!isStreamActive()) return
        applyReasoningOnlyPlaceholder(set)
        set({ isStreaming: false, _abort: undefined })
      },
      onError: (message, detail) => {
        if (!isStreamActive()) return
        const staleSession = isSessionGoneMessage(message)
        if (!staleSession) {
          set((s) => {
            const messages = s.messages.slice()
            const last = messages[messages.length - 1]
            if (last?.role === 'assistant') {
              messages[messages.length - 1] = {
                ...last,
                errorMessage: message,
                ...(detail ? { errorDetail: detail } : {}),
              }
            }
            return {
              error: undefined,
              errorDetail: undefined,
              isStreaming: false,
              _abort: undefined,
              messages,
            }
          })
          void get().loadSessions()
          return
        }
        showToast(message)
        const code = get().sessionCode
        if (code && !isPendingSessionCode(code)) dropSessionCache(code)
        set((s) => ({
          error: undefined,
          errorDetail: undefined,
          isStreaming: false,
          _abort: undefined,
          sessionCode: undefined,
          sessionGoneSeq: s.sessionGoneSeq + 1,
          messages: s.messages.length >= 2 ? s.messages.slice(0, -2) : [],
          mountedSessionCodes: s.mountedSessionCodes.filter(
            (c) => c !== code && !isPendingSessionCode(c),
          ),
        }))
        void get().loadSessions()
      },
    },
  )

  void get().loadSessions()

  if (!isStreamActive()) return

  if (get().isStreaming) set({ isStreaming: false, _abort: undefined })
  const code = get().sessionCode
  if (code && !isPendingSessionCode(code)) syncSessionCache(code, get().messages)
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
      errorDetail: undefined,
      sessions: [],
      sessionsLoading: true,
      mountedSessionCodes: [],
      _abort: undefined,
      _routeLoadSeq: 0,
      _streamSeq: 0,
      sessionGoneSeq: 0,
      composerPrefillSeq: 0,
      composerPrefillText: '',

      /** 切换 Provider；不可用时展示错误 */
      setProvider: (provider) => {
        const option = get().providerOptions.find((p) => p.id === provider)
        if (option && !option.available) {
          set({ error: option.reason ?? '该提供商当前不可用', errorDetail: undefined })
          return
        }
        set({ provider, error: undefined, errorDetail: undefined })
        if (provider === 'openai') void get().loadModels()
      },

      /** 设置当前模型 */
      setModel: (model) => set({ model }),

      /** 将文本回填到输入框 */
      prefillComposer: (text) =>
        set((s) => ({
          composerPrefillText: text,
          composerPrefillSeq: s.composerPrefillSeq + 1,
        })),

      /** 暗门：展示错误红条（默认带上游明细示例） */
      previewError: (message) =>
        set({
          error: message?.trim() || '鉴权或权限有问题，请检查 API Key 配置',
          errorDetail: message?.trim()
            ? undefined
            : 'authentication_error: Invalid API key',
          isStreaming: false,
          _abort: undefined,
        }),

      /** 拉取 OpenAI 模型列表 */
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

      /** 拉取 Provider 配置与可用性 */
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

      /** 清空当前对话，回到新对话状态 */
      newChat: () => {
        get()._abort?.abort()
        set((s) => ({
          messages: [],
          sessionCode: undefined,
          error: undefined,
          errorDetail: undefined,
          isStreaming: false,
          _abort: undefined,
          _streamSeq: s._streamSeq + 1,
          mountedSessionCodes: [],
        }))
      },

      /** 拉取侧栏历史列表 */
      loadSessions: async () => {
        const run = async () => {
          const showLoading = get().sessions.length === 0
          if (showLoading) set({ sessionsLoading: true })
          try {
            set({ sessions: await fetchSessions() })
          } catch {
            // 列表加载失败时静默降级，不阻塞主流程
          } finally {
            if (showLoading) set({ sessionsLoading: false })
          }
        }

        // 首屏并发（Strict Mode）去重；已有列表时每次强制拉新，避免复用「建会话前」的旧结果
        if (get().sessions.length === 0) {
          return once(loadSessionsOnce, run)
        }
        return run()
      },

      /** 打开指定会话（缓存优先） */
      openSession: async (sessionCode) => {
        if (get().sessionCode === sessionCode && get().messages.length > 0) {
          mountSessionCode(get, set, sessionCode)
          return true
        }

        const loadSeqAtCall = get()._routeLoadSeq
        const prevCode = get().sessionCode

        // 中断进行中的流，并使迟到回调失效
        get()._abort?.abort()
        set((s) => ({ _streamSeq: s._streamSeq + 1 }))

        if (prevCode && prevCode !== sessionCode && !isPendingSessionCode(prevCode)) {
          syncSessionCache(prevCode, get().messages)
        }

        // 切走后卸掉 pending 挂载，再挂目标会话，避免空白壳残留
        set((s) => ({
          mountedSessionCodes: s.mountedSessionCodes.filter((c) => !isPendingSessionCode(c)),
        }))
        mountSessionCode(get, set, sessionCode)

        const cached = sessionMessagesCache.get(sessionCode)
        if (cached !== undefined) {
          set({
            sessionCode,
            messages: cached,
            error: undefined,
            errorDetail: undefined,
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
            errorDetail: undefined,
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
            errorDetail: undefined,
            _abort: undefined,
          })
          return true
        } catch (e) {
          if (isStaleRouteLoad(loadSeqAtCall)) return true
          const message = e instanceof Error ? e.message : '加载对话失败'
          // 已删对话：顶部 Toast，不占消息区错误红条
          const gone = isSessionGoneMessage(message)
          if (gone) {
            showToast(message)
            evictGhostSession(get, set, sessionCode)
          }
          set({
            error: gone ? undefined : message,
            errorDetail: undefined,
            messages: [],
            sessionCode: undefined,
            isStreaming: false,
            _abort: undefined,
          })
          return false
        }
      },

      /** 删除单个会话 */
      removeSession: async (sessionCode) => {
        try {
          await deleteSessionApi(sessionCode)
        } catch (e) {
          const message = e instanceof Error ? e.message : '删除对话失败'
          showToast(message)
          // 对端已删：仍同步侧栏幽灵项；其它错误则中止
          if (!isSessionGoneMessage(message)) return false
        }
        dropSessionCache(sessionCode)
        // 当前会话留给侧栏 goHome 清掉，避免 URL 仍是 /chat/:code 时先卸面板触发 openSession 闪动
        set((s) => ({
          mountedSessionCodes:
            s.sessionCode === sessionCode
              ? s.mountedSessionCodes
              : s.mountedSessionCodes.filter((c) => c !== sessionCode),
        }))
        await get().loadSessions()
        return true
      },

      /** 批量删除会话 */
      removeSessions: async (sessionCodes) => {
        if (sessionCodes.length === 0) return true
        try {
          await deleteSessionsApi(sessionCodes)
        } catch (e) {
          const message = e instanceof Error ? e.message : '批量删除失败'
          showToast(message)
          if (!isSessionGoneMessage(message)) return false
        }
        for (const code of sessionCodes) dropSessionCache(code)
        const current = get().sessionCode
        const deletingCurrent = Boolean(current && sessionCodes.includes(current))
        set((s) => ({
          mountedSessionCodes: deletingCurrent
            ? s.mountedSessionCodes
            : s.mountedSessionCodes.filter((c) => !sessionCodes.includes(c)),
        }))
        await get().loadSessions()
        return true
      },

      /** 停止当前流式生成 */
      stop: () => {
        get()._abort?.abort()
        set((s) => {
          const messages = s.messages.slice()
          const last = messages[messages.length - 1]
          if (last?.role === 'assistant') {
            const empty = !last.content.trim() && !(last.reasoning ?? '').trim()
            if (empty) {
              // 无产出停止：保留助手行，写入与库一致的软提示
              messages[messages.length - 1] = {
                ...last,
                statusMessage: GENERATION_STOPPED_MESSAGE,
              }
            } else if (!last.content.trim() && (last.reasoning ?? '').trim()) {
              messages[messages.length - 1] = {
                ...last,
                content: REASONING_ONLY_PLACEHOLDER,
              }
            }
          }
          return {
            messages,
            isStreaming: false,
            _abort: undefined,
            _streamSeq: s._streamSeq + 1,
          }
        })
      },

      /** 发送用户消息并拉取流式回复 */
      send: async (query) => {
        const trimmed = query.trim()
        const state = get()
        if (!trimmed || state.isStreaming) return

        const history = toHistoryPayload(state.messages)
        const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed }
        const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', reasoning: '' }

        const streamToken = state._streamSeq + 1
        const hasRealSession =
          Boolean(state.sessionCode) && !isPendingSessionCode(state.sessionCode)
        const mountCode = hasRealSession ? state.sessionCode! : PENDING_SESSION_CODE

        const ac = new AbortController()
        set({
          messages: [...state.messages, userMsg, assistantMsg],
          isStreaming: true,
          error: undefined,
          errorDetail: undefined,
          _abort: ac,
          _streamSeq: streamToken,
          sessionCode: mountCode,
        })
        // 乐观挂载，避免 meta 前主区空白
        mountSessionCode(get, set, mountCode)

        await runAssistantStream(get, set, {
          query: trimmed,
          sessionCode: hasRealSession ? state.sessionCode : undefined,
          messages: history,
          signal: ac.signal,
          streamToken,
        })
      },

      /** 重新生成指定助手：截断该条及后续消息后重拉 */
      regenerate: async (assistantMessageId) => {
        const state = get()
        if (state.isStreaming) return
        const { messages, sessionCode } = state
        if (!sessionCode || isPendingSessionCode(sessionCode)) return

        const idx = messages.findIndex((m) => m.id === assistantMessageId)
        if (idx < 1) return
        const target = messages[idx]
        const prev = messages[idx - 1]
        if (target.role !== 'assistant' || prev.role !== 'user') return

        const query = prev.content.trim()
        if (!query) return

        // 保留到触发 user（含），丢掉该助手及之后所有消息
        const baseMessages = messages.slice(0, idx)
        const keepMessageCount = baseMessages.length
        const history = toHistoryPayload(baseMessages)
        const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', reasoning: '' }
        const streamToken = state._streamSeq + 1
        const ac = new AbortController()

        set({
          messages: [...baseMessages, assistantMsg],
          isStreaming: true,
          error: undefined,
          errorDetail: undefined,
          _abort: ac,
          _streamSeq: streamToken,
        })

        await runAssistantStream(get, set, {
          query,
          sessionCode,
          regenerate: true,
          keepMessageCount,
          messages: history,
          signal: ac.signal,
          streamToken,
        })
      },
    }),
    {
      name: 'xx-chat-ai',
      /** 仅持久化 provider / model */
      partialize: (s) => ({ provider: s.provider, model: s.model }),
    },
  ),
)
