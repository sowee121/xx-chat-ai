/**
 * 单条消息：用户 / 助手气泡底部操作栏
 */
import { memo, useState } from 'react'
import { Check, Copy, PenLine, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/chat-types'
import { useChatStore } from '@/stores/chatStore'
import { ThreeDots } from './ThreeDots'
import { ReasoningBlock } from './ReasoningBlock'
import { MarkdownMessage } from './MarkdownMessage'
import { StreamErrorBanner } from './StreamErrorBanner'
import { styles } from './MessageItem.styles'

interface MessageItemProps {
  message: ChatMessage
  streaming?: boolean
}

/** 复制文本到剪贴板；成功返回 true */
async function copyText(text: string): Promise<boolean> {
  const value = text.trim()
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/** 单条聊天消息渲染*/
export const MessageItem = memo(function MessageItem({
  message,
  streaming = false,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const prefillComposer = useChatStore((s) => s.prefillComposer)
  const regenerate = useChatStore((s) => s.regenerate)
  const isStreaming = useChatStore((s) => s.isStreaming)

  const flashCopied = () => {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (message.role === 'user') {
    const handleCopy = async () => {
      if (await copyText(message.content)) flashCopied()
    }

    return (
      <div className={styles.userRow}>
        <div className={styles.userWrap}>
          <div className={styles.userBubble}>{message.content}</div>
          <div className={styles.userActions}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.userActionBtn}
              aria-label="编辑消息"
              onClick={() => prefillComposer(message.content)}
            >
              <PenLine className={styles.actionIcon} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(styles.userActionBtn, copied && styles.actionBtnVisible)}
              aria-label={copied ? '已复制' : '复制消息'}
              onClick={() => void handleCopy()}
            >
              {copied ? <Check className={styles.actionIcon} /> : <Copy className={styles.actionIcon} />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 尚无正文与推理、也无错误/状态提示时展示三点等待
  const isEmptyStreaming =
    streaming &&
    message.content.length === 0 &&
    !(message.reasoning?.length) &&
    !message.errorMessage &&
    !message.statusMessage

  const canCopyBody = !streaming && Boolean(message.content.trim())
  // 任意助手消息可重生；流式中禁用（截断该条及后续）
  const canRegenerate = !streaming && !isStreaming

  const handleCopyAssistant = async () => {
    if (await copyText(message.content)) flashCopied()
  }

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
      {message.errorMessage ? (
        <div className={cn((message.content || message.reasoning) && 'mt-3')}>
          <StreamErrorBanner message={message.errorMessage} detail={message.errorDetail} />
        </div>
      ) : null}
      {message.statusMessage ? (
        <p className={styles.statusTip}>{message.statusMessage}</p>
      ) : null}
      {canCopyBody || canRegenerate ? (
        <div className={styles.assistantActions}>
          {canCopyBody ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(styles.assistantActionBtn, copied && styles.actionBtnVisible)}
              aria-label={copied ? '已复制' : '复制正文'}
              onClick={() => void handleCopyAssistant()}
            >
              {copied ? <Check className={styles.actionIcon} /> : <Copy className={styles.actionIcon} />}
            </Button>
          ) : null}
          {canRegenerate ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.assistantActionBtn}
              aria-label="重新生成"
              onClick={() => void regenerate(message.id)}
            >
              <RotateCcw className={styles.actionIcon} />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})
