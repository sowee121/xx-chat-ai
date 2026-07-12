export const styles = {
  wrap: 'absolute inset-0',
  wrapActive: 'z-10 visible',
  wrapInactive: 'pointer-events-none invisible z-0',
  scroll:
    'h-full overflow-y-auto [scroll-padding-bottom:var(--chat-composer-pad,5.5rem)] [scrollbar-color:color-mix(in_oklch,var(--foreground)_25%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent',
  gutter: 'px-4 sm:px-6',
  column: 'mx-auto flex w-full max-w-3xl flex-col gap-6 py-6',
  bottomSpacer: 'h-[var(--chat-composer-pad,5.5rem)] shrink-0',
  error: 'border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm',
  scrollLoading: 'opacity-0',
  scrollReady: 'opacity-100 transition-opacity duration-[400ms] ease-in-out motion-reduce:transition-none',
} as const
