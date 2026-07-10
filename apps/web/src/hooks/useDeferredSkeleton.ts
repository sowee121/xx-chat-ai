import { useEffect, useRef, useState } from 'react'

import { SHELL_FADE_MS, SHELL_HIDE_DELAY_MS, SHELL_MIN_VISIBLE_MS } from '@/lib/shellTiming'

/** 加载结束后延时淡出骨架，与聊天区蒙层节奏一致 */
export function useDeferredSkeleton(loading: boolean) {
  const [mounted, setMounted] = useState(loading)
  const [visible, setVisible] = useState(loading)
  const shownAtRef = useRef(Date.now())
  const genRef = useRef(0)
  const mountedRef = useRef(loading)
  mountedRef.current = mounted

  useEffect(() => {
    const gen = ++genRef.current

    if (loading) {
      shownAtRef.current = Date.now()
      setMounted(true)
      setVisible(true)
      return
    }

    if (!mountedRef.current) return

    const minRemain = Math.max(0, SHELL_MIN_VISIBLE_MS - (Date.now() - shownAtRef.current))
    let unmountTimer: ReturnType<typeof setTimeout> | undefined

    const fadeTimer = window.setTimeout(() => {
      if (gen !== genRef.current) return
      setVisible(false)

      unmountTimer = window.setTimeout(() => {
        if (gen !== genRef.current) return
        setMounted(false)
      }, SHELL_FADE_MS)
    }, minRemain + SHELL_HIDE_DELAY_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      if (unmountTimer) window.clearTimeout(unmountTimer)
    }
  }, [loading])

  return { skeletonMounted: mounted, skeletonVisible: visible }
}
