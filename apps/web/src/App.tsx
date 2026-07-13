/**
 * 应用壳：SidebarProvider、TooltipProvider 与路由出口。
 */
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'

import { useChatStore } from '@/stores/chatStore'
import { ChatLayout } from '@/routes/ChatLayout'

function App() {
  const loadProviders = useChatStore((s) => s.loadProviders)

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  return (
    <Routes>
      <Route path="/" element={<ChatLayout />} />
      <Route path="/chat/:sessionCode" element={<ChatLayout />} />
    </Routes>
  )
}

export default App
