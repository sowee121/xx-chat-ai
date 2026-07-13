/**
 * 前端入口：挂载 React、Router 与主题。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
