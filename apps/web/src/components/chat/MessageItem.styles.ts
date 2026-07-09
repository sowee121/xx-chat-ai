export const styles = {
  userRow: 'flex justify-end',
  userWrap: 'group/user flex max-w-[80%] items-center gap-1',
  actionBtn:
    'text-muted-foreground size-8 shrink-0 opacity-0 transition-opacity group-hover/user:opacity-100 focus-visible:opacity-100',
  actionBtnVisible: 'opacity-100',
  actionIcon: 'size-4',
  userBubble:
    'bg-muted min-w-0 flex-1 rounded-2xl px-4 py-2.5 text-[0.95rem] leading-7 break-words whitespace-pre-wrap',
  assistant: 'flex flex-col gap-3',
  generatingBubble:
    'bg-muted flex h-12 w-fit items-center rounded-2xl px-4',
  generatingDots: 'flex items-center gap-1',
  generatingDot: 'generating-dot bg-muted-foreground/65 size-1.5 rounded-full',
} as const
