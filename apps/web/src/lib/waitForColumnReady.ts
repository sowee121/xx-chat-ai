/**
 * 等待消息列内图片、Mermaid 等布局稳定。
 */
const STABLE_MS = 180
const TIMEOUT_MS = 5000

/** 等待列内图片、Mermaid 等异步内容布局稳定 */
export function waitForColumnReady(column: HTMLElement | null): Promise<void> {
  return new Promise((resolve) => {
    if (!column) {
      resolve()
      return
    }

    let stableTimer: ReturnType<typeof setTimeout> | null = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      ro.disconnect()
      if (stableTimer) clearTimeout(stableTimer)
      clearTimeout(timeoutId)
      resolve()
    }

    const pendingImages = () =>
      [...column.querySelectorAll('img')].filter((img) => !img.complete)

    const scheduleStable = () => {
      if (settled) return
      if (pendingImages().length > 0) return
      if (stableTimer) clearTimeout(stableTimer)
      stableTimer = setTimeout(finish, STABLE_MS)
    }

    const watchImages = () => {
      pendingImages().forEach((img) => {
        img.addEventListener('load', scheduleStable, { once: true })
        img.addEventListener('error', scheduleStable, { once: true })
      })
    }

    const ro = new ResizeObserver(() => {
      watchImages()
      scheduleStable()
    })

    ro.observe(column)
    watchImages()
    scheduleStable()
    const timeoutId = setTimeout(finish, TIMEOUT_MS)
  })
}
