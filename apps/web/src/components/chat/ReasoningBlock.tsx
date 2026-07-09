import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { styles } from './ReasoningBlock.styles'

interface ReasoningBlockProps {
  content: string
  streaming?: boolean
}

export function ReasoningBlock({ content, streaming = false }: ReasoningBlockProps) {
  const [open, setOpen] = useState(streaming)
  const [userToggled, setUserToggled] = useState(false)
  const [elapsedSec, setElapsedSec] = useState<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (streaming) {
      if (startRef.current === null) startRef.current = Date.now()
      if (!userToggled) setOpen(true)
      return
    }

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
    ? '正在思考…'
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
        <span className={styles.headerText}>{label}</span>
        <ChevronDown
          className={cn(styles.chevron, !open && styles.chevronCollapsed)}
          aria-hidden
        />
      </button>

      {open ? <div className={styles.panel}>{displayContent}</div> : null}
    </div>
  )
}
