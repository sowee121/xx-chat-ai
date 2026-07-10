export const styles = {
  provider: 'h-svh',
  inset: 'min-h-0 overflow-hidden bg-background text-foreground',
  chatMain: 'relative isolate min-h-0 flex-1',
  sessionStack: 'relative h-full',
  composerOverlay:
    'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-background px-4 pt-2 pb-6 sm:px-6',
  composerFade:
    'pointer-events-none absolute inset-x-0 bottom-full h-6 bg-gradient-to-t from-background to-transparent',
  composerInner: 'pointer-events-auto relative z-10 mx-auto w-full max-w-3xl',
} as const
