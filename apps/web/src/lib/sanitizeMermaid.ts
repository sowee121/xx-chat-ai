function quoteLabel(label: string): string {
  return `"${label.replace(/"/g, '\\"')}"`
}

function isQuoted(label: string): boolean {
  const trimmed = label.trim()
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
}

/** 统一换行、去 BOM。 */
export function normalizeMermaidSource(code: string): string {
  return code.replace(/\uFEFF/g, '').replace(/\r\n/g, '\n').trim()
}

function escapeMermaidTitle(title: string): string {
  return `"${title.replace(/"/g, '\\"')}"`
}

function quoteXychartCategoryLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return trimmed
  if (isQuoted(trimmed)) return trimmed
  // Mermaid：非纯 ASCII 单词标识符需加引号（如 1月、含空格标签）
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return trimmed
  return quoteLabel(trimmed)
}

/**
 * 修复 xychart-beta 分类轴标签：为中文等非 ASCII 标签补引号。
 */
export function fixXychartBetaSyntax(code: string): string {
  const source = normalizeMermaidSource(code)
  if (!/^xychart-beta\b/im.test(source)) return source

  return source.replace(
    /^(\s*x-axis\s+(?:"[^"]*"\s+)?)\[([^\]]+)\]/gim,
    (_, prefix: string, inner: string) => {
      const labels = inner.split(',').map((s) => quoteXychartCategoryLabel(s))
      return `${prefix}[${labels.join(', ')}]`
    },
  )
}

/**
 * 部分模型会输出不存在的 barChart 语法，转为 Mermaid 支持的 xychart-beta。
 */
export function convertInvalidBarChart(code: string): string | null {
  const source = normalizeMermaidSource(code)
  if (!/^barChart\b/i.test(source)) return null

  const titleMatch = source.match(/^\s*title\s+(.+)$/im)
  const yAxisMatch = source.match(/^\s*yAxis\s+(.+)$/im)
  const title = titleMatch?.[1]?.trim() ?? 'Chart'
  const yLabel = yAxisMatch?.[1]?.trim() ?? '数值'

  const series: { name: string; values: number[] }[] = []
  for (const m of source.matchAll(/^\s*data\s+(\[[^\n]+\])/gim)) {
    try {
      const raw = m[1].replace(/'/g, '"')
      const arr = JSON.parse(raw) as unknown[]
      if (!Array.isArray(arr) || arr.length < 2) continue
      const name = String(arr[0])
      const values = arr
        .slice(1)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
      if (values.length > 0) series.push({ name, values })
    } catch {
      // 忽略无法解析的 data 行
    }
  }

  if (series.length === 0) return null

  const valueCount = series[0].values.length
  const sameLength = series.every((s) => s.values.length === valueCount)
  const maxVal = Math.max(...series.flatMap((s) => s.values))
  const yMax = Math.max(10, Math.ceil((maxVal * 1.15) / 10) * 10)
  const yAxisQuoted = `"${yLabel.replace(/"/g, '\\"')}"`

  if (valueCount > 1 && sameLength) {
    const xLabels =
      valueCount === 3
        ? ['P50', 'P90', 'P99']
        : Array.from({ length: valueCount }, (_, i) => `M${i + 1}`)
    const seriesLines = series
      .map((s, i) => {
        const kind = i === 0 ? 'bar' : 'line'
        return `    ${kind} [${s.values.join(', ')}]`
      })
      .join('\n')

    return `xychart-beta
    title ${escapeMermaidTitle(title)}
    x-axis [${xLabels.map(quoteXychartCategoryLabel).join(', ')}]
    y-axis ${yAxisQuoted} 0 --> ${yMax}
${seriesLines}`
  }

  const names = series.map((s) => s.name.replace(/,/g, ' '))
  const vals = series.map((s) => s.values[0])

  return `xychart-beta
    title ${escapeMermaidTitle(title)}
    x-axis [${names.map(quoteXychartCategoryLabel).join(', ')}]
    y-axis ${yAxisQuoted} 0 --> ${yMax}
    bar [${vals.join(', ')}]`
}

/**
 * 仅修复最常见的问题：未加引号的节点标签里含有 |。
 * 不改动其他合法语法，避免误伤各模型正常输出。
 */
export function sanitizeMermaidBlock(code: string): string {
  let source = normalizeMermaidSource(code)

  source = source.replace(/\(\[([^\]]*\|[^\]]*)\]\)/g, (_, label: string) => {
    if (isQuoted(label)) return `([${label}])`
    return `([${quoteLabel(label)}])`
  })
  source = source.replace(/\[(?!\[)([^\]\n"]*\|[^\]\n"]*)\](?!\])/g, (_, label: string) => {
    if (isQuoted(label)) return `[${label}]`
    return `[${quoteLabel(label)}]`
  })
  source = source.replace(/\{(?!\{)([^}\n"]*\|[^}\n"]*)\}(?!\})/g, (_, label: string) => {
    if (isQuoted(label)) return `{${label}}`
    return `{${quoteLabel(label)}}`
  })

  return source
}

/** 渲染仍失败时：将标签内 | 替换为 / 后再加引号。 */
export function sanitizeMermaidBlockAggressive(code: string): string {
  const replacePipes = (label: string) => label.replace(/\|/g, ' / ')

  let source = sanitizeMermaidBlock(code)

  source = source.replace(/\[(?!\[)([^\]\n]+)\](?!\])/g, (_, label: string) => {
    if (!label.includes('|') || isQuoted(label)) return `[${label}]`
    return `[${quoteLabel(replacePipes(label))}]`
  })
  source = source.replace(/\{(?!\{)([^}\n]+)\}(?!\})/g, (_, label: string) => {
    if (!label.includes('|') || isQuoted(label)) return `{${label}}`
    return `{${quoteLabel(replacePipes(label))}}`
  })

  return source
}
