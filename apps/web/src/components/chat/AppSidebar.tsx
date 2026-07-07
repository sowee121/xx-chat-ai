import { useEffect } from 'react'
import { SquarePen, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './AppSidebar.styles'

export function AppSidebar() {
  const sessions = useChatStore((s) => s.sessions)
  const sessionCode = useChatStore((s) => s.sessionCode)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const openSession = useChatStore((s) => s.openSession)
  const removeSession = useChatStore((s) => s.removeSession)
  const newChat = useChatStore((s) => s.newChat)
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const handleOpen = (code: string) => {
    void openSession(code)
    closeOnMobile()
  }

  const handleNew = () => {
    newChat()
    closeOnMobile()
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className={styles.header}>
        <Button variant="outline" size="lg" className={styles.newBtn} onClick={handleNew}>
          <SquarePen className={styles.newBtnIcon} />
          新对话
        </Button>
      </SidebarHeader>

      <SidebarContent className={styles.content}>
        <SidebarGroup className={styles.group}>
          <SidebarGroupLabel className={styles.groupLabel}>历史会话</SidebarGroupLabel>
          {sessions.length === 0 ? (
            <p className={styles.empty}>还没有会话</p>
          ) : (
            <div className={styles.sessionScroll}>
              <SidebarMenu className={styles.menu}>
                {sessions.map((s) => {
                  const isActive = s.sessionCode === sessionCode
                  return (
                    <SidebarMenuItem key={s.sessionCode}>
                      <div
                        role="button"
                        tabIndex={0}
                        title={s.title}
                        className={cn(styles.sessionRow, isActive && styles.sessionRowActive)}
                        onClick={() => handleOpen(s.sessionCode)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleOpen(s.sessionCode)
                          }
                        }}
                      >
                        <span className={styles.sessionTitle}>{s.title}</span>
                        <button
                          type="button"
                          className={styles.sessionDelete}
                          aria-label="删除会话"
                          onClick={(e) => {
                            e.stopPropagation()
                            void removeSession(s.sessionCode)
                          }}
                        >
                          <Trash2 className={styles.deleteIcon} />
                        </button>
                      </div>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
