import { useState, type MouseEvent } from 'react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { cjk } from '@streamdown/cjk'

import { ImageLightbox } from './ImageLightbox'
import { styles } from './MarkdownMessage.styles'

interface MarkdownMessageProps {
  content: string
  animating?: boolean
}

export function MarkdownMessage({ content, animating = false }: MarkdownMessageProps) {
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null)

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a')) return
    const img = target.closest<HTMLImageElement>('img[data-streamdown="image"]')
    const src = img?.currentSrc || img?.src
    if (src) setPreview({ src, alt: img?.alt ?? '' })
  }

  return (
    <div className={styles.root} onClick={handleClick}>
      <Streamdown plugins={{ code, mermaid, cjk }} animated isAnimating={animating}>
        {content}
      </Streamdown>
      {preview && (
        <ImageLightbox src={preview.src} alt={preview.alt} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
