import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './ModelMenu.styles'

export function ModelMenu() {
  const provider = useChatStore((s) => s.provider)
  const model = useChatStore((s) => s.model)
  const models = useChatStore((s) => s.models)
  const setModel = useChatStore((s) => s.setModel)
  const isStreaming = useChatStore((s) => s.isStreaming)

  if (provider !== 'openai') return null

  const label = model ?? '选择模型'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isStreaming || models.length === 0}
          className={styles.trigger}
          title={label}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className={styles.chevron} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
        {models.length > 0 && (
          <DropdownMenuRadioGroup
            value={model ?? models[0]}
            onValueChange={setModel}
          >
            {models.map((m) => (
              <DropdownMenuRadioItem key={m} value={m} className={styles.item}>
                {m}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
