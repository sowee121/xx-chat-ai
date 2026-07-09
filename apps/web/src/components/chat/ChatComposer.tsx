import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './ChatComposer.styles'

interface ChatComposerProps {
  autoFocus?: boolean
}

export function ChatComposer({ autoFocus = false }: ChatComposerProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const isStreaming = useChatStore((s) => s.isStreaming)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const composerPrefillSeq = useChatStore((s) => s.composerPrefillSeq)
  const composerPrefillText = useChatStore((s) => s.composerPrefillText)

  const focusInput = () => {
    boxRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }

  useEffect(() => {
    if (!composerPrefillSeq || !composerPrefillText) return
    setQuery(composerPrefillText)
    requestAnimationFrame(focusInput)
  }, [composerPrefillSeq, composerPrefillText])

  const handleSend = () => {
    const trimmed = query.trim()
    if (!trimmed || isStreaming) return
    setQuery('')
    void send(trimmed)
  }

  const handleBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input')) return
    e.preventDefault()
    focusInput()
  }

  return (
    <div className={styles.wrap}>
      <div ref={boxRef} className={styles.box} onMouseDown={handleBoxMouseDown}>
        <Input
          autoFocus={autoFocus}
          className={styles.input}
          style={{ background: 'transparent' }}
          placeholder="嘻嘻，想问点什么？"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        {isStreaming ? (
          <Button
            size="icon"
            className={styles.sendBtn}
            onClick={stop}
            aria-label="停止生成"
          >
            <span className={styles.stopSquare} />
          </Button>
        ) : (
          <Button
            size="icon"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!query.trim()}
            aria-label="发送"
          >
            <ArrowUp className={styles.sendIcon} />
          </Button>
        )}
      </div>
    </div>
  )
}
