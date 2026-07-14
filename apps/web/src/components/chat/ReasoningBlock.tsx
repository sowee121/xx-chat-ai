/**
 * 推理块：流式展开、「正在思考」扫光与历史折叠
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ThreeDots } from './ThreeDots'
import { styles } from './ReasoningBlock.styles'

interface ReasoningBlockProps {
  content: string
  streaming?: boolean
}

/** 思考过程折叠块*/
export function ReasoningBlock({ content, streaming = false }: ReasoningBlockProps) {
  const [open, setOpen] = useState(streaming)
  // 用户手动折叠/展开后，不再被 streaming 副作用强制改 open
  const [userToggled, setUserToggled] = useState(false)
  const [elapsedSec, setElapsedSec] = useState<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (streaming) {
      if (startRef.current === null) startRef.current = Date.now()
      if (!userToggled) setOpen(true)
      return
    }

    // 流结束：记录用时，未手动操作则默认折叠
    if (startRef.current !== null) {
      const sec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
      setElapsedSec(sec)
      startRef.current = null
    }
    if (!userToggled) setOpen(false)
  }, [streaming, userToggled])

  if (!content) return null

  const displayContent = content.trimStart()

  const label = streaming
    ? '正在思考'
    : elapsedSec !== null
      ? `已思考（用时 ${elapsedSec} 秒）`
      : '已思考'

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.header}
        onClick={() => {
          setUserToggled(true)
          setOpen((v) => !v)
        }}
        aria-expanded={open}
      >
        <span className={styles.headerText}>
          {streaming ? <ThreeDots /> : null}
          <span className={streaming ? styles.labelShimmer : undefined}>{label}</span>
        </span>
        <ChevronDown
          className={cn(styles.chevron, !open && styles.chevronCollapsed)}
          aria-hidden
        />
      </button>

      {open ? <div className={styles.panel}>{displayContent}</div> : null}
    </div>
  )
}
