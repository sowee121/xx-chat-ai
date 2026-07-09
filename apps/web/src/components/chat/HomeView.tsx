import { useChatStore } from '@/stores/chatStore'
import { styles } from './HomeView.styles'

const SUGGESTIONS = [
  'SSE 与 WebSocket 对比',
  'JavaScript 防抖和节流函数',
  '登录流程图',
  '数学公式示例',
  '示例图片',
  '多格式演示',
] as const

export function HomeView() {
  const send = useChatStore((s) => s.send)

  return (
    <div className={styles.wrap}>
      <div className={styles.center}>
        <h1 className={styles.title}>嘻嘻，想问点什么？</h1>
        <div className={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => void send(s)} className={styles.chip}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
