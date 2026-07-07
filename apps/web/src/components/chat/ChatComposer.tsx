import { useState } from 'react'
import { ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './ChatComposer.styles'

interface ChatComposerProps {
  autoFocus?: boolean
  showHint?: boolean
}

const HINTS: Record<'mock' | 'openai', string> = {
  mock: 'Mock 模式：回答为本地模拟内容',
  openai: 'OpenAI 模式：回答由大模型生成',
}

export function ChatComposer({ autoFocus = false, showHint = true }: ChatComposerProps) {
  const [query, setQuery] = useState('')
  const isStreaming = useChatStore((s) => s.isStreaming)
  const provider = useChatStore((s) => s.provider)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)

  const handleSend = () => {
    const trimmed = query.trim()
    if (!trimmed || isStreaming) return
    setQuery('')
    void send(trimmed)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <Input
          autoFocus={autoFocus}
          className={styles.input}
          placeholder="想知道点什么？"
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
      {showHint && <p className={styles.hint}>{HINTS[provider]}</p>}
    </div>
  )
}
