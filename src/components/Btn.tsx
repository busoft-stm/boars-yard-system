import {
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Explicit tooltip. Defaults to string children when omitted. */
  tooltip?: string
  children: ReactNode
}

function inferTooltip(children: ReactNode, explicit?: string) {
  if (explicit?.trim()) return explicit.trim()
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children).trim()
  }
  if (Array.isArray(children)) {
    const text = children
      .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
      .join('')
      .trim()
    if (text) return text
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return inferTooltip(children.props.children)
  }
  return undefined
}

/**
 * Primary / ghost button with hover tooltip (works when disabled).
 */
export function Btn({
  tooltip,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const tip = inferTooltip(children, tooltip)
  const button = (
    <button
      type={type}
      className={`btn ${className}`.trim()}
      disabled={disabled}
      aria-label={rest['aria-label'] ?? tip}
      {...rest}
    >
      {children}
    </button>
  )

  if (!tip) return button

  return (
    <span
      className={`ui-tip ui-tip-btn${disabled ? ' ui-tip-disabled' : ''}`}
      data-tooltip={tip}
    >
      {button}
    </span>
  )
}
