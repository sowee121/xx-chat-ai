/**
 * 窄屏断点：matchMedia + useSyncExternalStore，与 Tailwind md 对齐
 */
import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/** 订阅窄屏 matchMedia 变化*/
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

/** 读取当前是否窄屏*/
function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** SSR 快照：默认非窄屏*/
function getServerSnapshot() {
  return false
}

/** 是否窄屏布局*/
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
