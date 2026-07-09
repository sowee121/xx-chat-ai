import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { MessageItem } from './MessageItem'
import { styles } from './MessageList.styles'

const NEAR_BOTTOM_PX = 80

export function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const sessionCode = useChatStore((s) => s.sessionCode)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)

  const scrollRef = useRef<HTMLDivElement>(null)
  // 是否处于「贴底跟随」状态：用 ref 避免频繁 setState 触发重渲染
  const followRef = useRef(true)
  // 正在程序化平滑滚动到底：期间不因中间帧的滚动事件重新显示按钮
  const jumpingRef = useRef(false)
  const [showJump, setShowJump] = useState(false)

  const count = messages.length
  const last = messages[count - 1]
  const lastScrollKey = `${last?.content ?? ''}|${last?.reasoning ?? ''}`

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight - el.clientHeight, behavior })
    })
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
    followRef.current = atBottom
    if (atBottom) {
      jumpingRef.current = false
      setShowJump(false)
    } else if (!jumpingRef.current) {
      // 平滑滚动到底的中间帧不重新显示按钮，避免点击后闪一下
      setShowJump(true)
    }
  }

  // 切换会话：重置贴底/按钮状态并滚到底（消息条数可能相同，不能仅靠 count）
  useEffect(() => {
    followRef.current = true
    jumpingRef.current = false
    setShowJump(false)
    scrollToBottom()
  }, [sessionCode])

  // 新增消息（发送 / 新回复）：强制贴底并恢复跟随
  useEffect(() => {
    followRef.current = true
    setShowJump(false)
    scrollToBottom()
  }, [count])

  // 流式增量：仅在贴底跟随时才自动滚动，用户上翻查看历史时不打扰
  useEffect(() => {
    if (followRef.current) scrollToBottom()
  }, [lastScrollKey])

  const jumpToBottom = () => {
    followRef.current = true
    jumpingRef.current = true
    setShowJump(false)
    scrollToBottom('smooth')
  }

  return (
    <div className={styles.wrap}>
      <div ref={scrollRef} className={styles.scroll} onScroll={handleScroll}>
        <div className={styles.gutter}>
          <div className={styles.column}>
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
