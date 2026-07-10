import { SquarePen } from 'lucide-react'

import { useParams } from 'react-router-dom'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useSessionNavigation } from '@/hooks/useSessionNavigation'
import { useChatStore } from '@/stores/chatStore'
import { ProviderMenu } from './ProviderMenu'
import { ModelMenu } from './ModelMenu'
import { styles } from './ChatHeader.styles'

export function ChatHeader() {
  const { sessionCode: routeCode } = useParams()
  const { goHome } = useSessionNavigation()
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const inChatRoute = Boolean(routeCode)
  const canNewChat = hasMessages || inChatRoute

  return (
    <header className={styles.header}>
      <div className={styles.leading}>
        <SidebarTrigger iconClassName={styles.headerIcon} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="新建对话"
          disabled={!canNewChat}
          onClick={goHome}
        >
          <SquarePen className={styles.headerIcon} />
        </Button>
      </div>

      <span className={styles.title}>XX Chat AI</span>

      <div className={styles.actions}>
        <ModelMenu />
        <ProviderMenu />
        <ModeToggle iconClassName={styles.headerIcon} />
      </div>
    </header>
  )
}
