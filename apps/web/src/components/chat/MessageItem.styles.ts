/**
 * MessageItem 样式类名
 */
export const styles = {
  userRow: 'flex justify-end',
  userWrap: 'group/user flex max-w-[80%] flex-col items-end gap-1',
  userBubble:
    'bg-muted min-w-0 rounded-2xl px-4 py-2.5 text-[0.95rem] leading-7 break-words whitespace-pre-wrap',
  /** 用户气泡底部操作栏：hover / 焦点时显示，右对齐 */
  userActions: 'flex items-center gap-0.5 -mr-1',
  userActionBtn:
    'text-muted-foreground size-8 shrink-0 opacity-0 transition-opacity group-hover/user:opacity-100 focus-visible:opacity-100',
  actionBtnVisible: 'opacity-100',
  actionIcon: 'size-4',
  assistant: 'group/assistant flex flex-col gap-3',
  generating: 'flex h-7 items-center',
  statusTip: 'text-muted-foreground text-sm leading-7',
  /** 助手正文底部操作栏：hover / 焦点时显示 */
  assistantActions: 'flex items-center gap-0.5 -ml-1',
  assistantActionBtn:
    'text-muted-foreground size-8 shrink-0 opacity-0 transition-opacity group-hover/assistant:opacity-100 focus-visible:opacity-100',
} as const
