/** 顶栏文案 + 左侧竖线，上下间距对称 */
export const styles = {
  wrap: '',
  header:
    'text-muted-foreground/75 hover:text-muted-foreground flex w-fit max-w-full items-center gap-1 text-sm transition-colors',
  headerText: 'leading-none',
  chevron: 'size-3.5 shrink-0 transition-transform duration-200',
  chevronCollapsed: '-rotate-90',
  panel:
    'border-border text-foreground/75 mt-2 border-l-2 py-0 pl-4 pr-3 text-sm leading-normal break-words whitespace-pre-wrap',
} as const
