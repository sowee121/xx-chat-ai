import { Sparkles, SquarePen } from 'lucide-react'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useChatStore } from '@/stores/chatStore'
import { ProviderMenu } from './ProviderMenu'
import { ModelMenu } from './ModelMenu'
import { styles } from './ChatHeader.styles'

export function ChatHeader() {
  const newChat = useChatStore((s) => s.newChat)
  const hasMessages = useChatStore((s) => s.messages.length > 0)

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <SidebarTrigger />
        <Sparkles className={styles.brandIcon} />
        <span>xx Chat AI</span>
      </div>

      <div className={styles.actions}>
        <ProviderMenu />
        <ModelMenu />
        <span aria-hidden className={styles.divider} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="新对话"
          disabled={!hasMessages}
          onClick={newChat}
        >
          <SquarePen />
        </Button>
        <ModeToggle />
      </div>
    </header>
  )
}
