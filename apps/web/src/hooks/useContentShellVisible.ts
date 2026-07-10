import { useSyncExternalStore } from 'react'

import { getContentShellVisible, subscribeContentShell } from '@/lib/chatContentShell'

export function useContentShellVisible(): boolean {
  return useSyncExternalStore(subscribeContentShell, getContentShellVisible, () => false)
}
