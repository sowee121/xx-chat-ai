import { createMermaidPlugin, type DiagramPlugin } from '@streamdown/mermaid'

import { buildMermaidRenderAttempts } from './sanitizeMermaid'

const base = createMermaidPlugin()

/**
 * 优先用 prepareMermaidSource 覆盖中文模型常见错法；
 * 仍失败再尝试其它变体；全部失败则抛出让 UI 降级展示源码。
 */
export const mermaid: DiagramPlugin = {
  ...base,
  getMermaid(config) {
    const instance = base.getMermaid(config)

    return {
      initialize: (cfg) => instance.initialize(cfg),
      async render(id, source) {
        const attempts = buildMermaidRenderAttempts(source)

        let lastError: unknown
        for (let i = 0; i < attempts.length; i++) {
          try {
            const renderId = i === 0 ? id : `${id}-fix-${i}`
            return await instance.render(renderId, attempts[i])
          } catch (error) {
            lastError = error
          }
        }

        throw lastError
      },
    }
  },
}
