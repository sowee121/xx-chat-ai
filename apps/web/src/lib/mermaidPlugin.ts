import { createMermaidPlugin, type DiagramPlugin } from '@streamdown/mermaid'

import {
  convertInvalidBarChart,
  normalizeMermaidSource,
  sanitizeMermaidBlock,
  sanitizeMermaidBlockAggressive,
} from './sanitizeMermaid'

const base = createMermaidPlugin()

/**
 * 先原样渲染；仅失败时再尝试修复，避免破坏各模型已正确的 Mermaid 语法。
 */
export const mermaid: DiagramPlugin = {
  ...base,
  getMermaid(config) {
    const instance = base.getMermaid(config)

    return {
      initialize: (cfg) => instance.initialize(cfg),
      async render(id, source) {
        const normalized = normalizeMermaidSource(source)
        const barChart = convertInvalidBarChart(normalized)
        const attempts = [
          normalized,
          ...(barChart ? [barChart] : []),
          sanitizeMermaidBlock(normalized),
          sanitizeMermaidBlockAggressive(normalized),
        ]

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
