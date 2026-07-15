import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TipState = {
  text: string
  x: number
  y: number
  place: 'above' | 'below'
}

const ACTION_SELECTOR = [
  'button.btn',
  'button.action-icon-btn',
  'button.header-icon-btn',
  'button.modal-close-btn',
  'button.column-filter-trigger',
  'button.pagination-btn',
  'button.pagination-page-btn',
  'button.snackbar-close',
  'button.info-icon-btn',
  'button.info-icon-btn-sm',
  'a.btn',
].join(',')

function tipTextFor(el: HTMLElement): string {
  const wrap = el.closest('.ui-tip')
  if (wrap instanceof HTMLElement) {
    const fromWrap = wrap.getAttribute('data-tooltip')?.trim()
    if (fromWrap) return fromWrap
  }
  const fromData = el.getAttribute('data-tooltip')?.trim()
  if (fromData) return fromData
  const fromTitle = el.getAttribute('title')?.trim()
  if (fromTitle) return fromTitle
  const fromAria = el.getAttribute('aria-label')?.trim()
  if (fromAria) return fromAria
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

function resolveTarget(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null
  const wrap = from.closest('.ui-tip')
  if (wrap instanceof HTMLElement) {
    const inner = wrap.querySelector(ACTION_SELECTOR)
    if (inner instanceof HTMLElement) return inner
  }
  const el = from.closest(ACTION_SELECTOR)
  return el instanceof HTMLElement ? el : null
}

/**
 * App-wide hover/focus tooltips for action controls
 * (buttons, icon actions, filters, pagination, header icons).
 */
export function GlobalActionTooltips() {
  const [tip, setTip] = useState<TipState | null>(null)
  const activeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function restoreTitle(el: HTMLElement | null) {
      if (!el) return
      const native = el.dataset.nativeTitle
      if (native != null) {
        el.setAttribute('title', native)
        delete el.dataset.nativeTitle
      }
    }

    function hide() {
      restoreTitle(activeRef.current)
      activeRef.current = null
      setTip(null)
    }

    function showFor(el: HTMLElement) {
      const text = tipTextFor(el)
      if (!text) {
        hide()
        return
      }
      if (el.hasAttribute('title')) {
        el.dataset.nativeTitle = el.getAttribute('title') || ''
        el.removeAttribute('title')
      }
      const rect = el.getBoundingClientRect()
      const place: 'above' | 'below' = rect.top < 56 ? 'below' : 'above'
      activeRef.current = el
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: place === 'above' ? rect.top : rect.bottom,
        place,
      })
    }

    function onOver(e: Event) {
      const el = resolveTarget(e.target)
      if (!el) return
      showFor(el)
    }

    function onOut(e: Event) {
      const el = resolveTarget(e.target)
      if (!el) return
      if (activeRef.current === el) hide()
    }

    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('pointerout', onOut, true)
    document.addEventListener('focusin', onOver, true)
    document.addEventListener('focusout', onOut, true)
    window.addEventListener('scroll', hide, true)

    return () => {
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('pointerout', onOut, true)
      document.removeEventListener('focusin', onOver, true)
      document.removeEventListener('focusout', onOut, true)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!tip) return null

  return createPortal(
    <div
      className={`global-action-tip global-action-tip-${tip.place}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body,
  )
}
