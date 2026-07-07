import { useEffect } from 'react'
import { MessageSquare, SquarePen, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
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
        <Button variant="outline" className={styles.newBtn} onClick={handleNew}>
          <SquarePen />
          新对话
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>历史会话</SidebarGroupLabel>
          {sessions.length === 0 ? (
            <p className={styles.empty}>还没有会话</p>
          ) : (
            <SidebarMenu>
              {sessions.map((s) => (
                <SidebarMenuItem key={s.sessionCode}>
                  <SidebarMenuButton
                    isActive={s.sessionCode === sessionCode}
                    tooltip={s.title}
                    onClick={() => handleOpen(s.sessionCode)}
                  >
                    <MessageSquare />
                    <span>{s.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    aria-label="删除会话"
                    onClick={() => void removeSession(s.sessionCode)}
                  >
                    <Trash2 />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
