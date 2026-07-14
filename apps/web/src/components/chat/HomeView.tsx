/**
 * 空状态首页：引导文案、输入区与快捷标签
 */
import { useChatStore } from '@/stores/chatStore'
import { styles } from './HomeView.styles'
import { StreamErrorBanner } from './StreamErrorBanner'

const SUGGESTIONS = [
  'SSE 与 WebSocket 对比',
  'JavaScript 防抖和节流函数',
  '登录流程图',
  '数学公式示例',
  '图片示例',
  '多格式演示',
  '深度思考示例',
] as const

/** 暗门：点击仅展示错误红条，不发请求 */
const DEMO_ERROR_CHIP = '模拟错误提示'

/** 空状态首页*/
export function HomeView() {
  const send = useChatStore((s) => s.send)
  const previewError = useChatStore((s) => s.previewError)
  const error = useChatStore((s) => s.error)
  const errorDetail = useChatStore((s) => s.errorDetail)

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
            onClick={() => previewError()}
            className={styles.chip}
            title="暗门：预览错误红条（中文主文案 + type: message）"
          >
            {DEMO_ERROR_CHIP}
          </button>
        </div>
        {error ? <StreamErrorBanner message={error} detail={errorDetail} /> : null}
      </div>
    </div>
  )
}
