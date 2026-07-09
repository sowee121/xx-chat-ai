import { AppSidebar } from '@/components/chat/AppSidebar'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { HomeView } from '@/components/chat/HomeView'
import { MessageList } from '@/components/chat/MessageList'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useChatStore } from '@/stores/chatStore'
import { useEffect } from 'react'
import { styles } from './App.styles'

function App() {
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const loadProviders = useChatStore((s) => s.loadProviders)

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  return (
    <TooltipProvider>
      <SidebarProvider className={styles.provider}>
        <AppSidebar />
        <SidebarInset className={styles.inset}>
          <ChatHeader />
          <main className={styles.chatMain}>
            {hasMessages ? <MessageList /> : <HomeView />}
            <div className={styles.composerOverlay}>
              <div className={styles.composerFade} aria-hidden />
              <div className={styles.composerInner}>
                <ChatComposer autoFocus={!hasMessages} />
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
