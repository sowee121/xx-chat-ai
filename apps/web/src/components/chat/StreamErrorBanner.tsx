/**
 * 流式/聊天错误红条：中文主文案 + 可选上游 `type: message` 明细
 */
import { styles } from './MessageList.styles'

export function StreamErrorBanner({
  message,
  detail,
}: {
  message: string
  detail?: string
}) {
  return (
    <div className={styles.error} role="alert">
      <div>{message}</div>
      {detail ? <div className={styles.errorDetail}>{detail}</div> : null}
    </div>
  )
}
