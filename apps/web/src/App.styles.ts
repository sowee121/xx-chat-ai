export const styles = {
  /** 窄于此时出现横向滚动，避免顶栏/输入区被压乱（兼容 320 逻辑宽） */
  provider: 'h-svh min-w-[320px]',
  inset: 'min-h-0 min-w-0 flex-1 overflow-hidden bg-background text-foreground',
  chatMain: 'relative isolate min-h-0 flex-1',
  sessionStack: 'relative h-full',
  composerOverlay:
    'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-background px-4 pt-2 pb-6 sm:px-6',
  composerFade:
    'pointer-events-none absolute inset-x-0 bottom-full h-2 bg-gradient-to-t from-background to-transparent',
  composerInner: 'pointer-events-auto relative z-10 mx-auto w-full max-w-3xl',
} as const
