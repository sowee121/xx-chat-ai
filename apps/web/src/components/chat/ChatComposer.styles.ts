export const styles = {
  wrap: 'mx-auto w-full max-w-3xl',
  // ChatGPT 风：胶囊形容器（rounded-full），内嵌 input 不再单独圆角
  box: 'flex items-center gap-2 rounded-full border bg-background py-2 pr-2 pl-6 shadow-sm transition-colors focus-within:border-ring/50',
  input:
    'h-auto min-h-10 flex-1 !bg-transparent rounded-none border-0 px-0 py-1.5 text-base leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base dark:!bg-transparent',
  // Grok 风：整圆发送/停止按钮（ChatGPT 尺寸）
  sendBtn: 'size-9 shrink-0 rounded-full',
  sendIcon: 'size-5',
  // Grok 停止：实心圆角小方块（bg-current 随按钮文字色）
  stopSquare: 'size-3.5 rounded-[4px] bg-current',
  hint: 'text-muted-foreground mt-2 text-center text-xs',
} as const
