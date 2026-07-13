/**
 * 共用三点等待动画（浅灰 → 灰 → 黑错开跳动）。
 */
import { cn } from '@/lib/utils'
import { styles } from './ThreeDots.styles'

interface ThreeDotsProps {
  className?: string
}

/** 三点依次跳动，颜色浅灰 → 灰 → 黑循环 */
export function ThreeDots({ className }: ThreeDotsProps) {
  return (
    <span className={cn(styles.root, className)} aria-hidden>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  )
}
