/**
 * Mermaid 源码清洗与多策略渲染尝试
 */
function quoteLabel(label: string): string {
  return `"${label.replace(/"/g, '\\"')}"`
}

/** 标签是否已带引号*/
function isQuoted(label: string): boolean {
  const trimmed = label.trim()
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
}

/** 转义 Mermaid 标题字符*/
function escapeMermaidTitle(title: string): string {
  return `"${title.replace(/"/g, '\\"')}"`
}

/** 文本是否需要加 Mermaid 引号*/
function needsMermaidQuotes(text: string): boolean {
  const t = text.trim()
  if (!t || isQuoted(t)) return false
  return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)
}

/** 必要时为文本加引号*/
function quoteIfNeeded(text: string): string {
  const t = text.trim()
  if (!t || isQuoted(t) || !needsMermaidQuotes(t)) return t
  return escapeMermaidTitle(t)
}

/** 统一换行、去 BOM / 零宽字符*/
export function normalizeMermaidSource(code: string): string {
  return code
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** 弯引号 → ASCII，避免词法错误 */
function replaceSmartQuotes(code: string): string {
  return code
    .replace(/[\u201C\u201D\u300C\u300D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

/** 为 xychart 类别标签加引号*/
function quoteXychartCategoryLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return trimmed
  if (isQuoted(trimmed)) return trimmed
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return trimmed
  return quoteLabel(trimmed)
}

/**
 * 修复 xychart-beta：分类轴中文标签、标题补引号
 */
export function fixXychartBetaSyntax(code: string): string {
  const source = normalizeMermaidSource(code)
  if (!/^xychart(?:-beta)?\b/im.test(source)) return source

  let next = source.replace(/^xychart\b(?!-beta)/im, 'xychart-beta')

  next = next.replace(
    /^(\s*x-axis\s+(?:"[^"]*"\s+)?)\[([^\]]+)\]/gim,
    (_, prefix: string, inner: string) => {
      const labels = inner.split(',').map((s) => quoteXychartCategoryLabel(s))
      return `${prefix}[${labels.join(', ')}]`
    },
  )

  next = next.replace(/^(\s*title\s+)(?!["']).+$/gim, (line, prefix: string) => {
    const title = line.slice(prefix.length).trim()
    return `${prefix}${quoteIfNeeded(title)}`
  })

  return next
}

/**
 * 时序图：箭头后 / Note 后的全角冒号 → 半角
 */
export function fixSequenceDiagramColons(code: string): string {
  const source = normalizeMermaidSource(code)
  if (!/^sequenceDiagram\b/im.test(source)) return source

  let next = source.replace(
    /^(\s*\S+\s*(?:-{1,2}>{1,2}|-{1,2}x|-{1,2}\))\s*\S+)\s*：/gm,
    '$1:',
  )
  next = next.replace(
    /^(\s*(?:Note|note)\s+(?:over|left of|right of)\s+[^\n：:]+?)\s*：/gim,
    '$1:',
  )
  return next
}

/** pie 图 `"标签"：数值` → `"标签" : 数值` */
function fixPieFullwidthColons(code: string): string {
  if (!/^pie\b/im.test(code)) return code
  return code.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')\s*：\s*/g, '$1 : ')
}

/** subgraph 中文/空格标题补引号 */
function fixSubgraphTitles(code: string): string {
  return code.replace(/^(\s*subgraph\s+)(?!["'])(\S[^\n]*?)\s*$/gim, (_, prefix: string, title: string) => {
    const t = title.trim()
    // 已是 id [Title] 形态则不动
    if (/\[[^\]]+\]\s*$/.test(t)) return `${prefix}${t}`
    if (!needsMermaidQuotes(t)) return `${prefix}${t}`
    return `${prefix}${escapeMermaidTitle(t)}`
  })
}

/**
 * 流程图节点括号/标签空白兼容：模型常写出 `[ [x]]`、`[[x] ]`、`( x )` 等非法形态
 * 按「多字符定界符优先」依次归一，再对需引号的标签补引号
 */
export function fixFlowchartBracketSpaces(code: string): string {
  const source = normalizeMermaidSource(code)
  if (!/^(?:flowchart|graph)\b/im.test(source)) return source

  /** 标签 trim；含空格/路径/中文等时补引号 */
  const normalizeShapeLabel = (raw: string): string => {
    const t = raw.trim()
    if (!t) return t
    if (isQuoted(t)) return t
    if (needsMermaidQuotes(t)) return quoteLabel(t)
    return t
  }

  /** 将捕获的标签写入标准节点形态 */
  const wrap =
    (open: string, close: string) =>
    (label: string): string =>
      `${open}${normalizeShapeLabel(label)}${close}`

  /** 多字符形态优先，避免 `[ [` 被单层 `[]` 抢先匹配 */
  const shapeRules: { re: RegExp; format: (label: string) => string }[] = [
    // 子程序 [[x]]：[[ x ]]、[ [x]]、[[x] ]、[[x ]]
    { re: /\[\s*\[\s*([^\]\n]*?)\s*\]\s*\]/g, format: wrap('[[', ']]') },
    // 圆柱 [(x)]：[( x )]、[ (x)]
    { re: /\[\s*\(\s*([^\]\n]*?)\s*\)\s*\]/g, format: wrap('[(', ')]') },
    // 体育场 ([x])：([ x ])、( [x] )
    { re: /\(\s*\[\s*([^\]\n]*?)\s*\]\s*\)/g, format: wrap('([', '])') },
    // 圆形 ((x))：(( x ))、( (x) )
    { re: /\(\s*\(\s*([^)\n]*?)\s*\)\s*\)/g, format: wrap('((', '))') },
    // 六边形 {{x}}
    { re: /\{\s*\{\s*([^}\n]*?)\s*\}\s*\}/g, format: wrap('{{', '}}') },
    // 梯形 [/x/]、[\x\]
    { re: /\[\s*\/\s*([^/\]\n]*?)\s*\/\s*\]/g, format: wrap('[/', '/]') },
    { re: /\[\s*\\\s*([^\\\]\n]*?)\s*\\\s*\]/g, format: wrap('[\\', '\\]') },
  ]

  /** 跳过 style / classDef 等指令行，避免误伤 */
  const isDirectiveLine = (line: string): boolean =>
    /^\s*(?:style|classDef|class|linkStyle|click|direction|interpolate|%%)/i.test(line)

  const fixLine = (line: string): string => {
    if (isDirectiveLine(line)) return line

    let next = line
    for (const { re, format } of shapeRules) {
      next = next.replace(re, (_, label: string) => format(label))
    }

    // 菱形 {x}：{ x }（排除 {{、指令行已跳过）
    next = next.replace(/\{\s*([^}\n]*)\s*\}(?!\})/g, (match, label: string) => {
      const t = label.trim()
      if (!t) return match
      if (label === t && !needsMermaidQuotes(t) && !isQuoted(t)) return match
      return `{${normalizeShapeLabel(label)}}`
    })

    // 圆角 (x)：( x )（排除 ((、([）
    next = next.replace(/\(\s*(?![\[(])([^)\n]*)\s*\)(?!\))/g, (match, label: string) => {
      const t = label.trim()
      if (!t) return match
      if (label === t && !needsMermaidQuotes(t) && !isQuoted(t)) return match
      return `(${normalizeShapeLabel(label)})`
    })

    // 矩形 [x]：[ x ]、[x ]（排除 [[、[(、[/、[\ 等其它形态）
    next = next.replace(/\[(?!\[|\(|\/|\\)([^\]\n]*)\](?!\])/g, (match, label: string) => {
      const t = label.trim()
      if (!t) return match
      if (label === t && !needsMermaidQuotes(t) && !isQuoted(t)) return match
      return `[${normalizeShapeLabel(label)}]`
    })

    return next
  }

  return source
    .split('\n')
    .map((line) => fixLine(line))
    .join('\n')
}

/**
 * 非法 `bar`/`line` + `series "名" [...]` → 合法 `bar [...]` / `line [...]`
 */
export function convertInvalidXychartSeries(code: string): string | null {
  const source = normalizeMermaidSource(code)
  if (!/^xychart(?:-beta)?\b/im.test(source)) return null
  if (!/^\s*series\b/im.test(source)) return null

  const titleMatch = source.match(/^\s*title\s+(.+)$/im)
  const xAxisMatch = source.match(/^\s*x-axis\s+(.+)$/im)
  const yAxisMatch = source.match(/^\s*y-axis\s+(.+)$/im)

  const plots: { kind: 'bar' | 'line'; values: string }[] = []
  let pendingKind: 'bar' | 'line' = 'bar'

  for (const line of source.split('\n')) {
    const kindOnly = line.match(/^\s*(bar|line)\s*$/i)
    if (kindOnly) {
      pendingKind = kindOnly[1].toLowerCase() as 'bar' | 'line'
      continue
    }
    const series = line.match(/^\s*(?:(bar|line)\s+)?series\s+(?:"[^"]*"|'[^']*'|\S+)\s+(\[[^\]]+\])/i)
    if (series) {
      const kind = (series[1]?.toLowerCase() as 'bar' | 'line' | undefined) ?? pendingKind
      plots.push({ kind, values: series[2] })
      pendingKind = 'bar'
    }
  }

  if (plots.length === 0) return null

  const title = titleMatch?.[1]?.trim()
  const xAxis = xAxisMatch?.[1]?.trim()
  const yAxis = yAxisMatch?.[1]?.trim()

  const lines = ['xychart-beta']
  if (title) lines.push(`    title ${quoteIfNeeded(title)}`)
  if (xAxis) lines.push(`    x-axis ${xAxis}`)
  if (yAxis) lines.push(`    y-axis ${yAxis}`)
  for (const p of plots) lines.push(`    ${p.kind} ${p.values}`)

  return fixXychartBetaSyntax(lines.join('\n'))
}

/**
 * 伪语法 barChart → xychart-beta
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
      // ignore
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
      .map((s, i) => `    ${i === 0 ? 'bar' : 'line'} [${s.values.join(', ')}]`)
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

/** 节点标签含 | 时补引号 */
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

/** 更激进：标签内 | → / 后再引号 */
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

/**
 * 主流模型常见错法的安全预处理（尽量不误伤合法语法）
 * 渲染时应优先尝试本结果
 */
export function prepareMermaidSource(code: string): string {
  let source = replaceSmartQuotes(normalizeMermaidSource(code))

  const barChart = convertInvalidBarChart(source)
  if (barChart) source = barChart

  const seriesFixed = convertInvalidXychartSeries(source)
  if (seriesFixed) source = seriesFixed

  source = fixSequenceDiagramColons(source)
  source = fixPieFullwidthColons(source)
  source = fixXychartBetaSyntax(source)
  source = fixSubgraphTitles(source)
  source = fixFlowchartBracketSpaces(source)
  source = sanitizeMermaidBlock(source)

  return source
}

/** 生成渲染尝试列表（去重，优先已修复版本） */
export function buildMermaidRenderAttempts(code: string): string[] {
  const normalized = normalizeMermaidSource(code)
  const prepared = prepareMermaidSource(code)
  const aggressive = sanitizeMermaidBlockAggressive(prepared)
  const seriesOnly = convertInvalidXychartSeries(normalized)
  const barOnly = convertInvalidBarChart(normalized)
  const bracketsOnly = fixFlowchartBracketSpaces(normalized)

  const attempts = [
    prepared,
    normalized,
    bracketsOnly,
    fixSequenceDiagramColons(normalized),
    fixXychartBetaSyntax(normalized),
    ...(seriesOnly ? [seriesOnly] : []),
    ...(barOnly ? [fixXychartBetaSyntax(barOnly)] : []),
    aggressive,
  ]

  const seen = new Set<string>()
  return attempts.filter((item) => {
    if (!item || seen.has(item)) return false
    seen.add(item)
    return true
  })
}
