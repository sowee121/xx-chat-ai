/**
 * Provider 下拉：Mock / OpenAI 切换
 */
import { ChevronDown } from 'lucide-react'

import type { Provider } from '@/lib/chat-types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './ProviderMenu.styles'

const LABELS: Record<Provider, string> = {
  mock: 'Mock',
  openai: 'OpenAI',
}

/** Provider 下拉菜单*/
export function ProviderMenu() {
  const provider = useChatStore((s) => s.provider)
  const providerOptions = useChatStore((s) => s.providerOptions)
  const setProvider = useChatStore((s) => s.setProvider)
  const isStreaming = useChatStore((s) => s.isStreaming)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isStreaming} className={styles.trigger}>
          {LABELS[provider]}
          <ChevronDown className={styles.chevron} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.content}>
        <DropdownMenuRadioGroup
          value={provider}
          onValueChange={(value) => setProvider(value as Provider)}
        >
          {providerOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              disabled={!option.available}
              title={option.reason}
              className={styles.item}
            >
              {option.label}
              {!option.available && option.reason ? (
                <span className={styles.unavailable}>（未配置）</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
