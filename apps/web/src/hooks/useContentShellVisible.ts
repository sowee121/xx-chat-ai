/**
 * 订阅全局聊天骨架蒙层可见性。
 */
import { useSyncExternalStore } from 'react'

import { getContentShellVisible, subscribeContentShell } from '@/lib/chatContentShell'

export function useContentShellVisible(): boolean {
  return useSyncExternalStore(subscribeContentShell, getContentShellVisible, () => false)
}
