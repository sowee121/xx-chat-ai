/**
 * 图片全屏预览：缩放、拖拽、键盘与点背景关闭。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { styles } from './ImageLightbox.styles'

interface ImageLightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const SCALE_STEP = 0.25
const DEFAULT_SCALE = 1

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 100) / 100))
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0 })

  const resetView = useCallback(() => {
    setScale(DEFAULT_SCALE)
    setOffset({ x: 0, y: 0 })
  }, [])

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => clampScale(prev + delta))
  }, [])

  useEffect(() => {
    if (scale <= DEFAULT_SCALE) setOffset({ x: 0, y: 0 })
  }, [scale])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomBy(SCALE_STEP)
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomBy(-SCALE_STEP)
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        resetView()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, resetView, zoomBy])

  useEffect(() => {
    // 换图时复位
    resetView()
  }, [src, resetView])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= DEFAULT_SCALE) return
    draggingRef.current = true
    lastPointRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - lastPointRef.current.x
    const dy = e.clientY - lastPointRef.current.y
    lastPointRef.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onDoubleClick = () => {
    resetView()
  }

  const canZoomOut = scale > MIN_SCALE
  const canZoomIn = scale < MAX_SCALE
  const canReset = scale !== DEFAULT_SCALE || offset.x !== 0 || offset.y !== 0

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      onWheel={onWheel}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <div className={styles.toolbar} onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className={styles.toolBtn}
          disabled={!canZoomOut}
          aria-label="缩小"
          onClick={() => zoomBy(-SCALE_STEP)}
        >
          <ZoomOut className={styles.toolIcon} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className={styles.toolBtn}
          disabled={!canZoomIn}
          aria-label="放大"
          onClick={() => zoomBy(SCALE_STEP)}
        >
          <ZoomIn className={styles.toolIcon} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className={styles.toolBtn}
          disabled={!canReset}
          aria-label="还原"
          onClick={resetView}
        >
          <RotateCcw className={styles.toolIcon} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className={styles.toolBtn}
          aria-label="关闭预览"
          onClick={onClose}
        >
          <X className={styles.toolIcon} />
        </Button>
      </div>

      <div className={styles.stage}>
        <img
          className={cn(styles.image, scale > DEFAULT_SCALE && styles.stagePannable)}
          src={src}
          alt={alt ?? ''}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
