import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { ArrowDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { hideGlobalContentShell, runGlobalContentShell } from '@/lib/chatContentShell'
import { useContentShellVisible } from '@/hooks/useContentShellVisible'
import {
  getCachedSessionMessages,
  getSessionScrollTop,
  setSessionScrollTop,
  useChatStore,
} from '@/stores/chatStore'
import { MessageItem } from './MessageItem'
import { styles } from './MessageList.styles'

const NEAR_BOTTOM_PX = 80
const LAYOUT_SNAP_MS = 1600
const RESIZE_SNAP_DEBOUNCE_MS = 48
const EMPTY_MESSAGES: ChatMessage[] = []

interface MessageListProps {
  sessionCode: string
  active: boolean
}

function updateScrollUi(
  el: HTMLDivElement,
  followRef: MutableRefObject<boolean>,
  setShowJump: (v: boolean) => void,
) {
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
  followRef.current = atBottom
  setShowJump(!atBottom && el.scrollHeight > el.clientHeight + NEAR_BOTTOM_PX)
}

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
  const error = useChatStore((s) =>
    active && s.sessionCode === sessionCode ? s.error : undefined,
  )

  useEffect(() => {
    if (active && liveMessages) frozenRef.current = liveMessages
  }, [active, liveMessages])

  const messages = active && liveMessages !== undefined ? liveMessages : frozenRef.current
  const count = messages.length
  const last = messages[count - 1]
  const lastScrollKey = `${last?.content ?? ''}|${last?.reasoning ?? ''}`

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
  const [showJump, setShowJump] = useState(false)
  const [contentMasked, setContentMasked] = useState(false)
  const contentShellVisible = useContentShellVisible()
  const hideScrollContent = active && (contentShellVisible || contentMasked)

  const persistScrollTop = (top: number) => {
    setSessionScrollTop(sessionCode, top)
  }

  const snapToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight - el.clientHeight
    persistScrollTop(el.scrollTop)
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

  const restoreSavedScroll = () => {
    const el = scrollRef.current
    if (!el || count === 0) return
    const saved = getSessionScrollTop(sessionCode)
    if (saved != null) el.scrollTop = saved
    updateScrollUi(el, followRef, setShowJump)
    persistScrollTop(el.scrollTop)
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
    persistScrollTop(el.scrollTop)
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

  // 切换会话：layout 阶段先遮内容再挂骨架，避免首帧闪一下
  useLayoutEffect(() => {
    if (!active) {
      setContentMasked(false)
      return
    }
    if (!hasContent) {
      setContentMasked(false)
      return
    }

    setContentMasked(true)

    const hasSavedScroll = getSessionScrollTop(sessionCode) != null
    if (!hasBeenActiveRef.current) hasBeenActiveRef.current = true

    runContentShell(() => {
      setContentMasked(false)
      if (hasSavedScroll) {
        restoreSavedScroll()
      } else {
        followRef.current = true
        setShowJump(false)
        beginLayoutSnap()
      }
    })
  }, [active, sessionCode, hasContent])

  useEffect(() => {
    if (active) return
    hideGlobalContentShell(sessionCode)
    const el = scrollRef.current
    if (el) persistScrollTop(el.scrollTop)
  }, [active, sessionCode])

  // 激活时重置跳转按钮状态
  useEffect(() => {
    if (!active) return
    jumpingRef.current = false
  }, [active, sessionCode])

  // 仅消息增多时（新发消息）滚到底；流式过程不触发蒙层
  useEffect(() => {
    if (!active) return
    const prev = prevCountRef.current
    prevCountRef.current = count
    if (count > prev) {
      followRef.current = true
      setShowJump(false)
      beginLayoutSnap()
    }
  }, [count, active])

  useEffect(() => {
    if (!active || !followRef.current) return
    scheduleSnap()
  }, [lastScrollKey, active])

  const jumpToBottom = () => {
    followRef.current = true
    jumpingRef.current = true
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
              <MessageItem key={m.id} message={m} streaming={isStreaming && i === count - 1} />
            ))}
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.bottomSpacer} aria-hidden />
          </div>
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        className={cn(styles.jump, showJump ? styles.jumpShown : styles.jumpHidden)}
        onClick={jumpToBottom}
        aria-label="回到底部"
        aria-hidden={!showJump}
        tabIndex={showJump ? 0 : -1}
      >
        <ArrowDown className={styles.jumpIcon} />
      </Button>
    </div>
  )
}
