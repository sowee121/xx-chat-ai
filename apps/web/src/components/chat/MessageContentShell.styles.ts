export const styles = {
  shell:
    'pointer-events-none absolute inset-x-0 top-0 z-20 flex min-h-0 flex-col bg-background transition-opacity duration-[400ms] ease-in-out motion-reduce:transition-none bottom-[var(--chat-composer-pad,5.5rem)]',
  shellVisible: 'opacity-100',
  shellHidden: 'opacity-0',
  shellInner: 'mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4 py-6 sm:px-6',
  shellBody: 'flex min-h-0 flex-1 flex-col gap-6',
  skeletonSpacer: 'min-h-8 flex-1',
  skeletonBlock: 'flex flex-col gap-2',
  skeletonLine: 'h-7 animate-pulse rounded-md bg-muted',
  skeletonLineMd: 'w-4/5',
  skeletonLineShort: 'w-2/5',
  skeletonUserBubble:
    'h-12 w-2/5 max-w-[80%] shrink-0 animate-pulse rounded-2xl bg-muted',
} as const
