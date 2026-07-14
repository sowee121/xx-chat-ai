/**
 * 全局顶部 Toast：短暂提示后自动消失
 */
import { create } from 'zustand'

const DEFAULT_DURATION_MS = 3200
const EMPTY_FALLBACK = '提示'

type ToastItem = {
  id: number
  message: string
}

type ToastState = {
  toast: ToastItem | null
  show: (message: string, durationMs?: number) => void
  dismiss: () => void
}

let dismissTimer: ReturnType<typeof setTimeout> | undefined

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  /** 展示 Toast，到期自动消失 */
  show: (message, durationMs = DEFAULT_DURATION_MS) => {
    if (dismissTimer) clearTimeout(dismissTimer)
    const id = Date.now()
    set({ toast: { id, message: message.trim() || EMPTY_FALLBACK } })
    dismissTimer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, durationMs)
  },
  /** 立即关闭 Toast */
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer)
    dismissTimer = undefined
    set({ toast: null })
  },
}))

/** 供非 React 层（如 chatStore）直接唤起 Toast */
export function showToast(message: string, durationMs?: number): void {
  useToastStore.getState().show(message, durationMs)
}
