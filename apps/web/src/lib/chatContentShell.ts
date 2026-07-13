/**
 * 全局聊天区骨架蒙层控制。
 */
import { waitForColumnReady } from '@/lib/waitForColumnReady'
import {
  SHELL_FADE_MS,
  SHELL_HIDE_DELAY_MS,
  SHELL_MIN_VISIBLE_MS,
} from '@/lib/shellTiming'

/** @deprecated 使用 shellTiming 中的常量 */
export const CONTENT_SHELL_MIN_VISIBLE_MS = SHELL_MIN_VISIBLE_MS
/** @deprecated 使用 shellTiming 中的常量 */
export const CONTENT_SHELL_HIDE_DELAY_MS = SHELL_HIDE_DELAY_MS
/** @deprecated 使用 shellTiming 中的常量 */
export const CONTENT_SHELL_FADE_MS = SHELL_FADE_MS

let generation = 0
let visible = false
let ownerSessionCode: string | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((cb) => cb())
}

function sleep(ms: number, gen: number): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(generation === gen), ms)
  })
}

export function getContentShellVisible(): boolean {
  return visible
}

export function subscribeContentShell(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 全局唯一骨架蒙层：等待 column 布局稳定后隐藏并执行回调 */
export function runGlobalContentShell(
  sessionCode: string,
  column: HTMLElement | null,
  afterReady?: () => void,
): void {
  const gen = ++generation
  const shownAt = Date.now()
  ownerSessionCode = sessionCode
  visible = true
  notify()

  void waitForColumnReady(column).then(async () => {
    if (generation !== gen) return

    const minRemain = Math.max(0, SHELL_MIN_VISIBLE_MS - (Date.now() - shownAt))
    if (!(await sleep(minRemain, gen))) return
    if (!(await sleep(SHELL_HIDE_DELAY_MS, gen))) return

    visible = false
    ownerSessionCode = null
    notify()

    if (!(await sleep(SHELL_FADE_MS, gen))) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => afterReady?.())
    })
  })
}

/** 仅当该会话仍持有蒙层时关闭，避免 A→B 切换时被旧会话 effect 误杀 */
export function hideGlobalContentShell(sessionCode?: string): void {
  if (sessionCode != null && ownerSessionCode != null && ownerSessionCode !== sessionCode) {
    return
  }
  generation += 1
  ownerSessionCode = null
  if (!visible) return
  visible = false
  notify()
}
