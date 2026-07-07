export const styles = {
  wrap: 'mx-auto w-full max-w-3xl',
  // ChatGPT 风：统一大圆角容器，输入无边框内嵌
  box: 'flex items-center gap-2 rounded-[28px] border bg-background py-2 pr-2 pl-5 shadow-sm transition-colors focus-within:border-ring/50',
  input: 'h-9 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-base',
  // Grok 风：整圆发送/停止按钮（ChatGPT 尺寸）
  sendBtn: 'size-9 shrink-0 rounded-full',
  sendIcon: 'size-5',
  // Grok 停止：实心圆角小方块（bg-current 随按钮文字色）
  stopSquare: 'size-3.5 rounded-[4px] bg-current',
  hint: 'text-muted-foreground mt-2 text-center text-xs',
} as const
