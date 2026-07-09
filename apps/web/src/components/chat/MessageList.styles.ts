export const styles = {
  wrap: 'relative h-full',
  scroll:
    'h-full overflow-y-auto [scrollbar-color:color-mix(in_oklch,var(--foreground)_25%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent',
  gutter: 'px-4 sm:px-6',
  column: 'mx-auto flex w-full max-w-3xl flex-col gap-6 py-6',
  // pt-2 + 输入框(~3.625rem) + pb-5，与 composerOverlay 高度对齐
  bottomSpacer: 'h-[calc(theme(spacing.2)+3.625rem+theme(spacing.5))] shrink-0',
  error: 'border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm',
  jump: 'absolute bottom-[5.5rem] left-1/2 z-30 size-9 -translate-x-1/2 rounded-full border border-border/60 bg-background text-foreground shadow-lg transition-all duration-200 ease-out motion-reduce:transition-none hover:border-border hover:bg-muted hover:shadow-xl active:bg-muted/80',
  jumpShown: 'translate-y-0 scale-100 opacity-100',
  jumpHidden: 'pointer-events-none translate-y-2 scale-90 opacity-0',
  jumpIcon: 'size-5',
} as const
