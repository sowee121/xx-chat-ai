import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/chat-types'
import { MarkdownMessage } from './MarkdownMessage'
import { styles } from './MessageItem.styles'

interface MessageItemProps {
  message: ChatMessage
  streaming?: boolean
}

export function MessageItem({ message, streaming = false }: MessageItemProps) {
  const [copied, setCopied] = useState(false)

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
            className={cn(styles.copyBtn, copied && styles.copyBtnVisible)}
            aria-label={copied ? '已复制' : '复制消息'}
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className={styles.copyIcon} /> : <Copy className={styles.copyIcon} />}
          </Button>
          <div className={styles.userBubble}>{message.content}</div>
        </div>
      </div>
    )
  }

  const isEmptyStreaming = streaming && message.content.length === 0

  return (
    <div className={styles.assistant}>
      {isEmptyStreaming ? (
        <div className={styles.generating}>
          <span className={styles.dot} />
          正在生成…
        </div>
      ) : (
        <MarkdownMessage content={message.content} animating={streaming} />
      )}
    </div>
  )
}
