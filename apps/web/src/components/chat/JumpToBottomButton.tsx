/**
 * 回到底部按钮；流式中边框转圈提示。
 */
import { ArrowDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { styles } from './JumpToBottomButton.styles'

interface JumpToBottomButtonProps {
  visible: boolean
  /** 当前会话仍在流式生成时，边框转圈提示 */
  streaming?: boolean
  /** 发送贴底等场景：跳过显隐过渡，避免闪一下 */
  instant?: boolean
  onClick: () => void
}

export function JumpToBottomButton({
  visible,
  streaming = false,
  instant = false,
  onClick,
}: JumpToBottomButtonProps) {
  const showSpin = visible && streaming

  return (
    <div
      className={cn(
        styles.wrap,
        instant && styles.wrapInstant,
        visible ? styles.wrapShown : styles.wrapHidden,
      )}
      aria-hidden={!visible}
    >
      {showSpin ? <span className={styles.spinRing} aria-hidden /> : null}
      <Button
        size="icon"
        variant="ghost"
        className={cn(styles.jump, showSpin && styles.jumpStreaming)}
        onClick={onClick}
        aria-label={showSpin ? '回到底部，消息生成中' : '回到底部'}
        tabIndex={visible ? 0 : -1}
      >
        <ArrowDown className={styles.jumpIcon} />
      </Button>
    </div>
  )
}
