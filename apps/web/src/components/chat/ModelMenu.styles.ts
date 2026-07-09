export const styles = {
  trigger: 'max-w-[7rem] gap-1 rounded-full px-3',
  content:
    'max-h-72 w-max min-w-(--radix-dropdown-menu-trigger-width) max-w-[min(24rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto p-0',
  searchWrap: 'border-b border-border p-2',
  searchField: 'relative',
  searchInput: 'h-8 pr-8 text-xs',
  searchClear:
    'text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-muted',
  searchClearIcon: 'size-3.5',
  list: 'p-1',
  empty: 'text-muted-foreground px-3 py-4 text-center text-xs',
  chevron: 'opacity-60 shrink-0',
  item: 'font-mono text-xs whitespace-nowrap',
} as const
