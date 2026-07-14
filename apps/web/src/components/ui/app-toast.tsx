/**
 * 全局顶部 Toast 宿主
 */
import { useToastStore } from '@/stores/toastStore'
import { styles } from './app-toast.styles'

/** 全局顶部 Toast 宿主*/
export function AppToast() {
  const toast = useToastStore((s) => s.toast)
  if (!toast) return null

  return (
    <div className={styles.host} aria-live="polite">
      <div key={toast.id} className={styles.toast} role="alert">
        {toast.message}
      </div>
    </div>
  )
}
