/**
 * 空状态首页：引导文案、输入区与快捷标签。
 */
import { STREAM_IDLE_TIMEOUT_MESSAGE } from '@/lib/streamIdle'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './HomeView.styles'
import { styles as messageStyles } from './MessageList.styles'

const SUGGESTIONS = [
  'SSE 与 WebSocket 对比',
  'JavaScript 防抖和节流函数',
  '登录流程图',
  '数学公式示例',
  '示例图片',
  '多格式演示',
] as const

/** 暗门：点击仅展示错误红条，不发请求 */
const DEMO_ERROR_CHIP = '模拟错误提示'

export function HomeView() {
  const send = useChatStore((s) => s.send)
  const previewError = useChatStore((s) => s.previewError)
  const error = useChatStore((s) => s.error)

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
          <button
            type="button"
            onClick={() => previewError(STREAM_IDLE_TIMEOUT_MESSAGE)}
            className={styles.chip}
            title="暗门：预览流式错误提示样式"
          >
            {DEMO_ERROR_CHIP}
          </button>
        </div>
        {error ? <div className={messageStyles.error}>{error}</div> : null}
      </div>
    </div>
  )
}
