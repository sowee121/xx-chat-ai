import { Skeleton } from '@/components/ui/skeleton'
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { styles } from './AppSidebar.styles'

const ROW_WIDTHS = ['w-[88%]', 'w-[72%]', 'w-[95%]', 'w-[65%]', 'w-[80%]', 'w-[58%]', 'w-[90%]', 'w-[76%]', 'w-[84%]', 'w-[68%]'] as const

interface SessionListSkeletonProps {
  visible: boolean
}

export function SessionListSkeleton({ visible }: SessionListSkeletonProps) {
  return (
    <div
      className={cn(
        styles.skeletonLayer,
        visible ? styles.skeletonLayerVisible : styles.skeletonLayerHidden,
      )}
      aria-busy={visible}
      aria-hidden={!visible}
      aria-label={visible ? '正在加载历史对话' : undefined}
    >
      <SidebarMenu className={styles.menu}>
        {ROW_WIDTHS.map((width, index) => (
          <SidebarMenuItem key={index}>
            <Skeleton className={cn('h-10 rounded-xl', width)} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  )
}
