/**
 * JumpToBottomButton 样式类名。
 */
export const styles = {
  wrap: 'absolute bottom-[calc(var(--chat-composer-pad,5.5rem)+0.5rem)] left-1/2 z-30 size-9 -translate-x-1/2 transition-all duration-200 ease-out motion-reduce:transition-none',
  wrapInstant: 'transition-none',
  wrapShown: 'translate-y-0 scale-100 opacity-100',
  wrapHidden: 'pointer-events-none translate-y-2 scale-90 opacity-0',
  jump: 'relative z-10 size-9 rounded-full border border-border/60 bg-background text-foreground shadow-lg hover:border-border hover:bg-muted hover:shadow-xl active:bg-muted/80',
  jumpStreaming: 'border-transparent shadow-md',
  spinRing:
    'jump-streaming-spin pointer-events-none absolute -inset-px rounded-full border-2 border-transparent border-t-primary border-r-primary/50',
  jumpIcon: 'size-5',
} as const
