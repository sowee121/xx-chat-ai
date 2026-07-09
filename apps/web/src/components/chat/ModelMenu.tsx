import { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useChatStore } from '@/stores/chatStore'
import { styles } from './ModelMenu.styles'

export function ModelMenu() {
  const provider = useChatStore((s) => s.provider)
  const model = useChatStore((s) => s.model)
  const models = useChatStore((s) => s.models)
  const setModel = useChatStore((s) => s.setModel)
  const isStreaming = useChatStore((s) => s.isStreaming)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return models
    return models.filter((m) => m.toLowerCase().includes(keyword))
  }, [models, query])

  if (provider !== 'openai') return null

  const label = model ?? '选择模型'

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
      <DropdownMenuContent align="end" className={styles.content}>
        <div
          className={styles.searchWrap}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className={styles.searchField}>
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              className={styles.searchInput}
              aria-label="Search models"
            />
            {query ? (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery('')}
              >
                <X className={styles.searchClearIcon} />
              </button>
            ) : null}
          </div>
        </div>
        {models.length > 0 && filteredModels.length > 0 ? (
          <div className={styles.list}>
            <DropdownMenuRadioGroup
            value={model ?? models[0]}
            onValueChange={(value) => {
              setModel(value)
              handleOpenChange(false)
            }}
          >
            {filteredModels.map((m) => (
              <DropdownMenuRadioItem key={m} value={m} className={styles.item}>
                {m}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          </div>
        ) : (
          <p className={styles.empty}>No models found</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
