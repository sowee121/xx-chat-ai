import { useChatStore } from '@/stores/chatStore'
import { ChatComposer } from './ChatComposer'
import { styles } from './HomeView.styles'

const SUGGESTIONS = [
  '用一个表格对比 SSE 与 WebSocket',
  '给我一段 TypeScript 防抖函数',
  '画一个用户登录流程的 Mermaid 图',
]

export function HomeView() {
  const send = useChatStore((s) => s.send)

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>嘻嘻，想问点什么呢？</h1>

      <div className={styles.composerWrap}>
        <ChatComposer autoFocus showHint={false} />
      </div>

      <div className={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => void send(s)} className={styles.chip}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
