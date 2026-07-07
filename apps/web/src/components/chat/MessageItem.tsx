import type { ChatMessage } from '@/lib/chat-types'
import { MarkdownMessage } from './MarkdownMessage'
import { styles } from './MessageItem.styles'

interface MessageItemProps {
  message: ChatMessage
  streaming?: boolean
}

export function MessageItem({ message, streaming = false }: MessageItemProps) {
  if (message.role === 'user') {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>{message.content}</div>
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
