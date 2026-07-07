export const styles = {
  header: 'shrink-0 gap-3 px-4 pb-4 pt-5',
  newBtn: 'h-11 w-full justify-start gap-2.5 rounded-xl px-4 text-sm font-medium',
  newBtnIcon: 'size-[1.125rem] shrink-0',
  content: 'min-h-0 flex-1 overflow-hidden pt-1 pb-1',
  group: 'flex min-h-0 flex-1 flex-col gap-1 p-0',
  groupLabel: 'h-auto shrink-0 px-3 py-2 text-xs font-medium tracking-wide',
  menu: 'gap-1.5 px-3',
  sessionScroll:
    'min-h-0 flex-1 overflow-y-scroll [scrollbar-color:color-mix(in_oklch,var(--sidebar-foreground)_25%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent',
  sessionRow:
    'group/session flex h-10 w-full cursor-pointer items-center gap-1 rounded-xl pl-3 pr-1.5 text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
  sessionRowActive: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
  sessionTitle: 'min-w-0 flex-1 truncate text-left',
  sessionDelete:
    'text-muted-foreground flex shrink-0 items-center justify-center rounded-lg p-1.5 opacity-0 transition-[opacity,background-color,color] group-hover/session:opacity-100 hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100',
  deleteIcon: 'size-4',
  empty: 'text-muted-foreground px-3 py-4 text-sm',
} as const
