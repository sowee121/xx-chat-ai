/**
 * ChatComposer 样式类名。
 */
export const styles = {
  wrap: 'mx-auto w-full max-w-3xl',
  box: 'flex min-h-[50px] items-center gap-2 rounded-full border border-[color:var(--composer-border)] bg-background py-2 pr-2 pl-6 shadow-[var(--composer-shadow)] transition-[box-shadow,border-color] focus-within:shadow-[var(--composer-shadow-focus)]',
  input:
    'h-auto min-h-10 flex-1 !bg-transparent rounded-none border-0 px-0 py-1.5 text-base leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base dark:!bg-transparent',
  sendBtn: 'size-10 shrink-0 rounded-full',
  sendIcon: 'size-6',
  stopSquare: 'size-3.5 rounded-[4px] bg-current',
} as const
