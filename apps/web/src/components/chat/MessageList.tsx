/**
 * 消息列表：智能滚动、骨架触发与流式跟随
 */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'

import type { ChatMessage } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { hideGlobalContentShell, runGlobalContentShell } from '@/lib/chatContentShell'
import { isPendingSessionCode } from '@/lib/pendingSession'
import { useContentShellVisible } from '@/hooks/useContentShellVisible'
import { getCachedSessionMessages, useChatStore } from '@/stores/chatStore'
import { JumpToBottomButton } from './JumpToBottomButton'
import { MessageItem } from './MessageItem'
import { styles } from './MessageList.styles'
import { StreamErrorBanner } from './StreamErrorBanner'

const NEAR_BOTTOM_PX = 80
const LAYOUT_SNAP_MS = 1600
const RESIZE_SNAP_DEBOUNCE_MS = 48
const EMPTY_MESSAGES: ChatMessage[] = []

interface MessageListProps {
  sessionCode: string
  active: boolean
}

/** 根据滚动位置更新贴底与跳转按钮状态*/
function updateScrollUi(
  el: HTMLDivElement,
  followRef: MutableRefObject<boolean>,
  setShowJump: (v: boolean) => void,
) {
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
  followRef.current = atBottom
  setShowJump(!atBottom && el.scrollHeight > el.clientHeight + NEAR_BOTTOM_PX)
}

/** 消息列表与智能滚动*/
export function MessageList({ sessionCode, active }: MessageListProps) {
  const frozenRef = useRef<ChatMessage[]>(
    getCachedSessionMessages(sessionCode) ?? EMPTY_MESSAGES,
  )

  const liveMessages = useChatStore((s) =>
    active && s.sessionCode === sessionCode ? s.messages : undefined,
  )
  const isStreaming = useChatStore(
    (s) => active && s.sessionCode === sessionCode && s.isStreaming,
  )
  // sessionCode 与 store 对齐即可直播（含 pending）
  const error = useChatStore((s) =>
    active && s.sessionCode === sessionCode ? s.error : undefined,
  )
  const errorDetail = useChatStore((s) =>
    active && s.sessionCode === sessionCode ? s.errorDetail : undefined,
  )

  useEffect(() => {
    if (active && liveMessages) frozenRef.current = liveMessages
  }, [active, liveMessages])

  const messages = active && liveMessages !== undefined ? liveMessages : frozenRef.current
  const count = messages.length
  const last = messages[count - 1]
  const lastScrollKey = `${last?.content ?? ''}|${last?.reasoning ?? ''}|${last?.errorMessage ?? ''}|${last?.statusMessage ?? ''}`

  const scrollRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const jumpingRef = useRef(false)
  const layoutSnapUntilRef = useRef(0)
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming
  const activeRef = useRef(active)
  activeRef.current = active
  const hasBeenActiveRef = useRef(false)
  const prevCountRef = useRef(count)
  const prevStreamingRef = useRef(false)
  const [showJump, setShowJump] = useState(false)
  const [jumpInstant, setJumpInstant] = useState(false)
  const [contentMasked, setContentMasked] = useState(false)
  const contentShellVisible = useContentShellVisible()
  const hideScrollContent = active && (contentShellVisible || contentMasked)

  const snapToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight - el.clientHeight
  }

  const scheduleSnap = () => {
    requestAnimationFrame(() => {
      snapToBottom()
      requestAnimationFrame(snapToBottom)
    })
  }

  const beginLayoutSnap = () => {
    layoutSnapUntilRef.current = Date.now() + LAYOUT_SNAP_MS
    scheduleSnap()
  }

  const runContentShell = (afterReady?: () => void) => {
    if (!activeRef.current || count === 0) return
    runGlobalContentShell(sessionCode, columnRef.current, afterReady)
  }

  useEffect(() => {
    const column = columnRef.current
    if (!column) return

    let debounce: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (!activeRef.current) return
      const inSnapWindow = Date.now() < layoutSnapUntilRef.current
      const shouldSnap =
        followRef.current &&
        !jumpingRef.current &&
        (inSnapWindow || isStreamingRef.current)
      if (!shouldSnap) return

      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        snapToBottom()
        debounce = null
      }, RESIZE_SNAP_DEBOUNCE_MS)
    })

    ro.observe(column)
    return () => {
      ro.disconnect()
      if (debounce) clearTimeout(debounce)
    }
  }, [])

  const handleScroll = () => {
    if (!active) return
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
    followRef.current = atBottom
    if (atBottom) {
      jumpingRef.current = false
      setShowJump(false)
    } else if (!jumpingRef.current) {
      setShowJump(true)
    }
  }

  const hasContent = count > 0

  // 切换会话：骨架蒙层；首次进入贴底，Keep-Alive 复用则保留 DOM 滚动位置
  // 首条乐观消息 / pending→真实码：内容已在流里，不走历史加载骨架
  useLayoutEffect(() => {
    if (!active) {
      setContentMasked(false)
      return
    }
    if (!hasContent) {
      setContentMasked(false)
      return
    }

    // 用 ref 读流式态，避免 isStreaming 结束时二次跑进骨架
    const skipShell = isPendingSessionCode(sessionCode) || isStreamingRef.current
    if (skipShell) {
      setContentMasked(false)
      if (!hasBeenActiveRef.current) hasBeenActiveRef.current = true
      followRef.current = true
      setShowJump(false)
      beginLayoutSnap()
      return
    }

    setContentMasked(true)

    const revisit = hasBeenActiveRef.current
    if (!hasBeenActiveRef.current) hasBeenActiveRef.current = true

    runContentShell(() => {
      setContentMasked(false)
      const el = scrollRef.current
      if (revisit) {
        if (el) updateScrollUi(el, followRef, setShowJump)
        return
      }
      followRef.current = true
      setShowJump(false)
      beginLayoutSnap()
    })
  }, [active, sessionCode, hasContent])

  useEffect(() => {
    if (active) return
    hideGlobalContentShell(sessionCode)
  }, [active, sessionCode])

  // 激活时重置跳转按钮状态
  useEffect(() => {
    if (!active) return
    jumpingRef.current = false
  }, [active, sessionCode])

  /** 开始跟随贴底：关掉「回到底部」，避免截断/流式时状态滞后 */
  const snapFollowInstant = () => {
    followRef.current = true
    jumpingRef.current = false
    setJumpInstant(true)
    setShowJump(false)
    snapToBottom()
    beginLayoutSnap()
  }

  // 条数变化：发送变多 / 重生截断变少 → 贴底；非流式缩短则只重算按钮态
  useLayoutEffect(() => {
    if (!active) return
    const prev = prevCountRef.current
    prevCountRef.current = count
    if (count === prev) return
    if (count > prev || (count < prev && isStreaming)) {
      snapFollowInstant()
      return
    }
    const el = scrollRef.current
    if (el) updateScrollUi(el, followRef, setShowJump)
  }, [count, active, isStreaming])

  // 末条重生：条数不变但进入流式，同样贴底并关掉按钮
  useLayoutEffect(() => {
    if (!active) {
      prevStreamingRef.current = false
      return
    }
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = Boolean(isStreaming)
    if (wasStreaming || !isStreaming) return
    snapFollowInstant()
  }, [isStreaming, active])

  useEffect(() => {
    if (showJump || !jumpInstant) return
    setJumpInstant(false)
  }, [showJump, jumpInstant])

  useEffect(() => {
    if (!active || !followRef.current) return
    scheduleSnap()
  }, [lastScrollKey, active])

  const jumpToBottom = () => {
    followRef.current = true
    jumpingRef.current = true
    setJumpInstant(false)
    setShowJump(false)
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight - el.clientHeight, behavior: 'smooth' })
    window.setTimeout(() => {
      jumpingRef.current = false
      snapToBottom()
    }, 400)
  }

  return (
    <div
      className={cn(
        styles.wrap,
        active ? styles.wrapActive : styles.wrapInactive,
      )}
      aria-hidden={!active}
    >
      <div
        ref={scrollRef}
        className={cn(
          styles.scroll,
          hideScrollContent ? styles.scrollLoading : styles.scrollReady,
        )}
        onScroll={handleScroll}
      >
        <div className={styles.gutter}>
          <div ref={columnRef} className={styles.column}>
            {messages.map((m, i) => (
              <MessageItem
                key={m.id}
                message={m}
                streaming={isStreaming && i === count - 1}
              />
            ))}
            {error && <StreamErrorBanner message={error} detail={errorDetail} />}
            <div className={styles.bottomSpacer} aria-hidden />
          </div>
        </div>
      </div>

      <JumpToBottomButton
        visible={showJump && !hideScrollContent}
        streaming={isStreaming}
        instant={jumpInstant}
        onClick={jumpToBottom}
      />
    </div>
  )
}
