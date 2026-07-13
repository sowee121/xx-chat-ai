/**
 * ReasoningBlock 样式类名（顶栏文案 + 思考正文卡片）。
 */
export const styles = {
  wrap: '',
  header:
    'text-muted-foreground/75 hover:text-muted-foreground flex w-fit max-w-full items-center gap-1 text-sm transition-colors',
  headerText: 'inline-flex items-center gap-1.5 leading-none',
  labelShimmer: 'thinking-shimmer',
  chevron: 'size-3.5 shrink-0 transition-transform duration-200',
  chevronCollapsed: '-rotate-90',
  panel:
    'border-border text-foreground/75 mt-2 rounded-lg border px-4 py-3 text-sm leading-normal break-words whitespace-pre-wrap',
} as const
