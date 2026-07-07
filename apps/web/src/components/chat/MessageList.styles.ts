export const styles = {
  wrap: 'relative h-full',
  scroll: 'h-full overflow-y-auto',
  column: 'mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6',
  error: 'border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm',
  jump: 'absolute bottom-4 left-1/2 size-9 -translate-x-1/2 rounded-full border shadow-md transition-all duration-200 ease-out motion-reduce:transition-none',
  jumpShown: 'translate-y-0 scale-100 opacity-100',
  jumpHidden: 'pointer-events-none translate-y-2 scale-90 opacity-0',
  jumpIcon: 'size-5',
} as const
