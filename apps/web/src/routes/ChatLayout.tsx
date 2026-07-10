import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { AppSidebar } from '@/components/chat/AppSidebar'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { HomeView } from '@/components/chat/HomeView'
import { MessageList } from '@/components/chat/MessageList'
import { MessageContentShell } from '@/components/chat/MessageContentShell'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useContentShellVisible } from '@/hooks/useContentShellVisible'
import { useSyncSessionRoute } from '@/hooks/useSyncSessionRoute'
import { useChatStore } from '@/stores/chatStore'
import { styles } from '@/App.styles'

export function ChatLayout() {
  useSyncSessionRoute()

  const composerRef = useRef<HTMLDivElement>(null)
  const { sessionCode: routeCode } = useParams()
  const mountedSessionCodes = useChatStore((s) => s.mountedSessionCodes)
  const activeSessionCode = useChatStore((s) => s.sessionCode)
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const showChat = hasMessages || Boolean(routeCode) || mountedSessionCodes.length > 0

  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    const sync = () => {
      document.documentElement.style.setProperty('--chat-composer-pad', `${el.offsetHeight}px`)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--chat-composer-pad')
    }
  }, [])

  const activeCode = routeCode ?? activeSessionCode
  const contentShellVisible = useContentShellVisible()

  return (
    <TooltipProvider>
      <SidebarProvider className={styles.provider}>
        <AppSidebar />
        <SidebarInset className={styles.inset}>
          <ChatHeader />
          <main className={styles.chatMain}>
            {showChat ? (
              <div className={styles.sessionStack}>
                {mountedSessionCodes.map((code) => (
                  <MessageList key={code} sessionCode={code} active={activeCode === code} />
                ))}
                <MessageContentShell visible={contentShellVisible} />
              </div>
            ) : (
              <HomeView />
            )}
            <div ref={composerRef} className={styles.composerOverlay}>
              <div className={styles.composerFade} aria-hidden />
              <div className={styles.composerInner}>
                <ChatComposer autoFocus={!showChat} />
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
