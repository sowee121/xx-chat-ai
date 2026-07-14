/**
 * ImageLightbox 样式类名
 */
export const styles = {
  overlay:
    'fixed inset-0 z-50 flex flex-col touch-none overscroll-none bg-black/80 backdrop-blur-sm animate-in fade-in',
  toolbar:
    'absolute top-4 right-4 z-10 flex items-center gap-1 rounded-full border border-border/40 bg-background/90 p-1 shadow-lg backdrop-blur-sm',
  toolBtn: 'rounded-full',
  toolIcon: 'size-4',
  stage:
    'flex min-h-0 flex-1 cursor-default touch-none items-center justify-center overflow-hidden overscroll-none p-6',
  stagePannable: 'cursor-grab active:cursor-grabbing',
  image:
    'max-h-[min(90vh,100%)] max-w-[min(90vw,100%)] origin-center touch-none select-none rounded-lg object-contain shadow-2xl transition-transform duration-150 ease-out motion-reduce:transition-none',
} as const
