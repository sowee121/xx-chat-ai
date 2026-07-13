/**
 * HomeView 样式类名。
 */
export const styles = {
  wrap: 'h-full px-4 sm:px-6',
  center:
    'mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center gap-7 pb-[calc(theme(spacing.2)+3.625rem+theme(spacing.6))]',
  title: 'font-heading text-center text-3xl font-medium tracking-tight sm:text-4xl',
  chips: 'flex flex-wrap justify-center gap-2',
  chip: 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground cursor-pointer rounded-full px-4 py-2 text-sm transition-colors',
} as const
