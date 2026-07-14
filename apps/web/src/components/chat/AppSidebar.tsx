/**
 * 侧栏：品牌、新建对话、历史列表与批量删除
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, MessageCirclePlus, Minus, MoreHorizontal, PawPrint, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useDeferredSkeleton } from '@/hooks/useDeferredSkeleton'
import { useSessionNavigation } from '@/hooks/useSessionNavigation'
import { useChatStore } from '@/stores/chatStore'
import { SessionListSkeleton } from './SessionListSkeleton'
import { styles } from './AppSidebar.styles'

/** 侧栏历史与批量删除*/
export function AppSidebar() {
  const { sessionCode: routeCode } = useParams()
  const sessions = useChatStore((s) => s.sessions)
  const sessionsLoading = useChatStore((s) => s.sessionsLoading)
  const { skeletonMounted, skeletonVisible } = useDeferredSkeleton(sessionsLoading)
  const hideSessionList = sessionsLoading || skeletonVisible
  const sessionCode = useChatStore((s) => s.sessionCode)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const removeSession = useChatStore((s) => s.removeSession)
  const removeSessions = useChatStore((s) => s.removeSessions)
  const { goHome, goSession } = useSessionNavigation()
  const { isMobile, setOpenMobile } = useSidebar()

  const activeSessionCode = routeCode ?? sessionCode

  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'single'; sessionCode: string }
    | { kind: 'batch'; codes: string[] }
    | null
  >(null)

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    setSelected((prev) => {
      const codes = new Set(sessions.map((s) => s.sessionCode))
      const next = new Set([...prev].filter((c) => codes.has(c)))
      return next.size === prev.size ? prev : next
    })
  }, [sessions])

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const exitBatchMode = () => {
    setBatchMode(false)
    setSelected(new Set())
  }

  const enterBatchMode = () => {
    setBatchMode(true)
    setSelected(new Set())
  }

  const toggleSelect = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(sessions.map((s) => s.sessionCode)))
  }

  const handleOpen = (code: string) => {
    goSession(code)
    closeOnMobile()
  }

  const handleNew = () => {
    goHome()
    closeOnMobile()
  }

  const requestDeleteSession = (code: string) => {
    setDeleteTarget({ kind: 'single', sessionCode: code })
  }

  const requestBatchDelete = () => {
    const codes = [...selected]
    if (codes.length === 0) return
    setDeleteTarget({ kind: 'batch', codes })
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const wasCurrent =
      deleteTarget.kind === 'single'
        ? deleteTarget.sessionCode === activeSessionCode
        : Boolean(activeSessionCode && deleteTarget.codes.includes(activeSessionCode))

    if (deleteTarget.kind === 'single') {
      void removeSession(deleteTarget.sessionCode).then((ok) => {
        if (ok && wasCurrent) goHome()
      })
    } else {
      void removeSessions(deleteTarget.codes).then((ok) => {
        if (!ok) return
        if (wasCurrent) goHome()
        exitBatchMode()
      })
    }
    setDeleteTarget(null)
  }

  const deleteDialogTitle = '确定删除对话？'

  const deleteDialogDescription = '删除后，聊天记录将不可恢复'

  const selectedCount = selected.size
  const allSelected = sessions.length > 0 && selectedCount === sessions.length
  const someSelected = selectedCount > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else selectAll()
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            <PawPrint className={styles.brandIcon} />
          </span>
          <span className={styles.brandName}>XX Chat AI</span>
        </div>
        <Button variant="ghost" size="lg" className={styles.newBtn} onClick={handleNew}>
          <MessageCirclePlus className={styles.newBtnIcon} />
          新建对话
        </Button>
      </SidebarHeader>

      <SidebarContent className={styles.content}>
        <SidebarGroup className={styles.group}>
          <div className={styles.groupHeader}>
            {batchMode ? (
              <>
                <div className={styles.batchSelect}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                    aria-label={allSelected ? '取消全选' : '全选'}
                    className={cn(
                      styles.checkbox,
                      allSelected && styles.checkboxChecked,
                      someSelected && styles.checkboxIndeterminate,
                    )}
                    onClick={toggleSelectAll}
                  >
                    {allSelected ? (
                      <Check className={styles.checkboxIcon} />
                    ) : someSelected ? (
                      <Minus className={styles.checkboxIcon} />
                    ) : null}
                  </button>
                  <span className={styles.batchCount}>已选 {selectedCount} 项</span>
                </div>
                <div className={styles.batchActions}>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className={styles.batchActionBtn}
                    disabled={selectedCount === 0}
                    onClick={requestBatchDelete}
                  >
                    删除
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={styles.batchActionBtn}
                    onClick={exitBatchMode}
                  >
                    取消
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className={styles.groupLabel}>历史对话</span>
                <div className={styles.batchToggleSlot}>
                  {sessions.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={styles.batchToggle}
                      aria-label="批量管理"
                      title="批量管理"
                      onClick={enterBatchMode}
                    >
                      <MoreHorizontal className={styles.batchToggleIcon} />
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className={styles.listArea}>
            {skeletonMounted ? <SessionListSkeleton visible={skeletonVisible} /> : null}

            {!sessionsLoading && sessions.length === 0 && !skeletonMounted ? (
              <p className={styles.empty}>暂无对话～</p>
            ) : sessions.length > 0 ? (
              <div
                className={cn(
                  styles.listFade,
                  hideSessionList ? styles.listHidden : styles.listReady,
                )}
              >
                <SidebarMenu className={styles.menu}>
                  {sessions.map((s) => {
                  const isActive = !batchMode && s.sessionCode === activeSessionCode
                  const isSelected = selected.has(s.sessionCode)
                  return (
                    <SidebarMenuItem key={s.sessionCode}>
                      <div
                        role="button"
                        tabIndex={0}
                        title={s.title}
                        className={cn(
                          styles.sessionRow,
                          batchMode && styles.sessionRowBatch,
                          isActive && styles.sessionRowActive,
                          batchMode && isSelected && styles.sessionRowSelected,
                        )}
                        onClick={() => {
                          if (batchMode) toggleSelect(s.sessionCode)
                          else handleOpen(s.sessionCode)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (batchMode) toggleSelect(s.sessionCode)
                            else handleOpen(s.sessionCode)
                          }
                        }}
                      >
                        {batchMode ? (
                          <span
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={isSelected ? '取消选择' : '选择对话'}
                            className={cn(styles.checkbox, isSelected && styles.checkboxChecked)}
                          >
                            {isSelected ? <Check className={styles.checkboxIcon} /> : null}
                          </span>
                        ) : null}
                        <span className={styles.sessionTitle}>{s.title}</span>
                        {!batchMode ? (
                          <button
                            type="button"
                            className={styles.sessionDelete}
                            aria-label="删除对话"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDeleteSession(s.sessionCode)
                            }}
                          >
                            <Trash2 className={styles.deleteIcon} />
                          </button>
                        ) : null}
                      </div>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </div>
            ) : null}
          </div>
        </SidebarGroup>
      </SidebarContent>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className={styles.deleteDialogContent}>
          <div className={styles.deleteDialogBody}>
            <div className={styles.deleteDialogMedia}>
              <Trash2 />
            </div>
            <AlertDialogTitle className={styles.deleteDialogTitle}>
              {deleteDialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.deleteDialogDescription}>
              {deleteDialogDescription}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={styles.deleteDialogFooter}>
            <AlertDialogCancel className={styles.deleteDialogCancel}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className={styles.deleteDialogAction}
              onClick={handleConfirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
