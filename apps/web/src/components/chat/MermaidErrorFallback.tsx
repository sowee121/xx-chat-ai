/**
 * Mermaid 渲染失败降级：展示源码避免红错打断阅读。
 */
import type { MermaidErrorComponentProps } from 'streamdown'

import { styles } from './MermaidErrorFallback.styles'

/** 渲染失败时降级展示源码，避免红错打断阅读 */
export function MermaidErrorFallback({ chart }: MermaidErrorComponentProps) {
  return (
    <div className={styles.wrap}>
      <pre className={styles.pre}>{chart.trim()}</pre>
    </div>
  )
}
