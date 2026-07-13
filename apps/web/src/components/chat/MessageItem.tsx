import { memo, useState } from 'react'
import { Check, Copy, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/chat-types'
import { useChatStore } from '@/stores/chatStore'
import { ThreeDots } from './ThreeDots'
import { ReasoningBlock } from './ReasoningBlock'
import { MarkdownMessage } from './MarkdownMessage'
import { styles } from './MessageItem.styles'

interface MessageItemProps {
  message: ChatMessage
  streaming?: boolean
}

export const MessageItem = memo(function MessageItem({ message, streaming = false }: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const prefillComposer = useChatStore((s) => s.prefillComposer)

  if (message.role === 'user') {
    const handleCopy = async () => {
      if (!message.content) return
      try {
        await navigator.clipboard.writeText(message.content)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        // 剪贴板不可用时静默失败
      }
    }

    return (
      <div className={styles.userRow}>
        <div className={styles.userWrap}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.actionBtn}
            aria-label="编辑消息"
            onClick={() => prefillComposer(message.content)}
          >
            <Pencil className={styles.actionIcon} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(styles.actionBtn, copied && styles.actionBtnVisible)}
            aria-label={copied ? '已复制' : '复制消息'}
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className={styles.actionIcon} /> : <Copy className={styles.actionIcon} />}
          </Button>
          <div className={styles.userBubble}>{message.content}</div>
        </div>
      </div>
    )
  }

  const isEmptyStreaming =
    streaming && message.content.length === 0 && !(message.reasoning?.length)

  return (
    <div className={styles.assistant}>
      {message.reasoning ? (
        <ReasoningBlock content={message.reasoning} streaming={streaming && !message.content} />
      ) : null}
      {isEmptyStreaming ? (
        <div className={styles.generating} aria-label="正在生成" role="status">
          <ThreeDots />
        </div>
      ) : message.content ? (
        <MarkdownMessage content={message.content} animating={streaming} />
      ) : null}
    </div>
  )
})
