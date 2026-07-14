/**
 * 订阅全局聊天骨架蒙层可见性
 */
import { useSyncExternalStore } from 'react'

import { getContentShellVisible, subscribeContentShell } from '@/lib/chatContentShell'

/** 订阅内容骨架蒙层可见性*/
export function useContentShellVisible(): boolean {
  return useSyncExternalStore(subscribeContentShell, getContentShellVisible, () => false)
}
