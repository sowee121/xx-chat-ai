/**
 * AppSidebar 样式类名
 */
export const styles = {
  header: 'flex flex-col gap-2 px-4 pt-0 pb-2',
  brand: 'flex h-14 shrink-0 items-center gap-3',
  brandMark:
    'flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background',
  brandIcon: 'size-6 stroke-[2]',
  brandName: 'truncate text-xl font-semibold tracking-tight',
  newBtn:
    'h-10 w-full justify-center gap-2.5 rounded-xl border-0 bg-background px-3 text-sm font-medium shadow-sm transition-[box-shadow,background-color] hover:bg-background hover:shadow-md active:shadow-sm',
  newBtnIcon: 'size-[1.125rem] shrink-0',
  content: 'min-h-0 flex-1 overflow-hidden pt-1 pb-1',
  group: 'flex min-h-0 flex-1 flex-col gap-1 p-0',
  groupHeader: 'flex h-10 shrink-0 items-center justify-between gap-2 px-4',
  groupLabel: 'pl-3 text-sm font-medium tracking-wide text-sidebar-foreground/70',
  batchToggleSlot: 'flex size-8 shrink-0 items-center justify-center',
  batchToggle: 'text-muted-foreground shrink-0',
  batchToggleIcon: 'size-4',
  batchCount: 'text-sm font-medium tracking-wide text-sidebar-foreground/70',
  batchSelect: 'flex min-w-0 items-center gap-2 pl-3',
  batchActions: 'flex shrink-0 items-center gap-0.5',
  batchActionBtn: 'h-7 !rounded-full px-3 text-xs',
  menu: 'gap-1.5 px-4',
  sessionRow:
    'group/session flex h-10 w-full cursor-pointer items-center gap-1 rounded-xl pl-3 pr-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
  sessionRowBatch: 'gap-2',
  sessionRowSelected: 'bg-muted',
  sessionRowActive: 'bg-muted text-foreground',
  sessionTitle: 'min-w-0 flex-1 truncate text-left',
  checkbox:
    'border-sidebar-border text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-[4px] border bg-background transition-colors',
  checkboxChecked: 'border-primary bg-primary text-primary-foreground',
  checkboxIndeterminate: 'border-primary bg-primary text-primary-foreground',
  checkboxIcon: 'size-3',
  sessionDelete:
    'text-destructive flex size-8 shrink-0 items-center justify-center rounded-full opacity-0 transition-[opacity,background-color,color] group-hover/session:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100',
  deleteIcon: 'size-4',
  empty: 'text-muted-foreground py-4 pl-7 pr-4 text-sm',
  listArea:
    'relative flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-color:color-mix(in_oklch,var(--sidebar-foreground)_25%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent',
  listFade: 'transition-opacity duration-[400ms] ease-in-out motion-reduce:transition-none',
  listHidden: 'opacity-0',
  listReady: 'opacity-100',
  skeletonLayer:
    'absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden transition-opacity duration-[400ms] ease-in-out motion-reduce:transition-none',
  skeletonLayerVisible: 'opacity-100',
  skeletonLayerHidden: 'pointer-events-none opacity-0',
  deleteDialogContent: 'sm:max-w-[22rem]',
  deleteDialogBody: 'flex flex-col items-center gap-2 text-center',
  deleteDialogMedia:
    'flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive [&_svg]:size-5',
  deleteDialogTitle: 'text-base font-medium',
  deleteDialogDescription: 'text-sm text-balance text-muted-foreground',
  deleteDialogFooter: 'flex-col-reverse gap-2 sm:flex-row sm:justify-stretch sm:gap-3',
  deleteDialogCancel:
    'h-10 w-full !rounded-full border border-border bg-background px-6 text-sm font-medium shadow-none hover:bg-muted sm:flex-1',
  deleteDialogAction:
    'h-10 w-full !rounded-full border-0 bg-destructive/10 px-6 text-sm font-semibold text-destructive shadow-none hover:bg-destructive/15 sm:flex-1',
} as const
