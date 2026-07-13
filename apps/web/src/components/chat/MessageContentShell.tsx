/**
 * 聊天区全局骨架蒙层 UI。
 */
import { cn } from '@/lib/utils'
import { styles } from './MessageContentShell.styles'
import { styles as messageStyles } from './MessageItem.styles'

interface MessageContentShellProps {
  visible: boolean
}

function SkeletonTurn({ variant }: { variant: 'short' | 'long' }) {
  return (
    <>
      <div className={messageStyles.userRow}>
        <div className={styles.skeletonUserBubble} />
      </div>
      <div className={messageStyles.assistant}>
        <div className={styles.skeletonBlock}>
          <div className={cn(styles.skeletonLine, styles.skeletonLineMd)} />
          <div className={styles.skeletonLine} />
          {variant === 'long' ? (
            <>
              <div className={styles.skeletonLine} />
              <div className={cn(styles.skeletonLine, styles.skeletonLineShort)} />
            </>
          ) : (
            <div className={cn(styles.skeletonLine, styles.skeletonLineShort)} />
          )}
        </div>
      </div>
    </>
  )
}

export function MessageContentShell({ visible }: MessageContentShellProps) {
  return (
    <div
      className={cn(styles.shell, visible ? styles.shellVisible : styles.shellHidden)}
      aria-hidden={!visible}
      aria-busy={visible}
      aria-label={visible ? '正在加载对话内容' : undefined}
    >
      <div className={styles.shellInner}>
        <div className={styles.shellBody}>
          <SkeletonTurn variant="long" />
          <SkeletonTurn variant="short" />
          <SkeletonTurn variant="long" />
          <SkeletonTurn variant="short" />
          <div className={styles.skeletonSpacer} aria-hidden />
        </div>
      </div>
    </div>
  )
}
