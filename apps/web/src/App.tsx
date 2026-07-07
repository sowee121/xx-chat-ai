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
          {hasMessages ? (
            <>
              <main className={styles.main}>
                <MessageList />
              </main>
              <div className={styles.composerBar}>
                <ChatComposer />
              </div>
            </>
          ) : (
            <main className={styles.main}>
              <HomeView />
            </main>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
