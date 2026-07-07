export const styles = {
  overlay:
    'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm animate-in fade-in',
  image: 'max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl',
  close:
    'absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition-colors hover:bg-background',
  closeIcon: 'size-5',
} as const
