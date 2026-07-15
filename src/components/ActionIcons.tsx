import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: 'default' | 'danger' | 'ok'
  children: ReactNode
}

/** Icon action control with accessible label + hover tooltip. */
export function ActionIconBtn({
  label,
  tone = 'default',
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <span
      className={`ui-tip${disabled ? ' ui-tip-disabled' : ''}`}
      data-tooltip={label}
    >
      <button
        type="button"
        className={`action-icon-btn action-icon-btn-${tone} ${className}`.trim()}
        aria-label={label}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    </span>
  )
}

export function IconEdit() {
  return <MaterialIcon name="edit" size={18} />
}

export function IconDisable() {
  return <MaterialIcon name="block" size={18} />
}

export function IconEnable() {
  return <MaterialIcon name="check_circle" size={18} />
}

export function IconDelete() {
  return <MaterialIcon name="delete" size={18} />
}

export function IconKey() {
  return <MaterialIcon name="key" size={18} />
}

export function IconStatus() {
  return <MaterialIcon name="format_list_bulleted" size={18} />
}

export function IconAssignSlot() {
  return <MaterialIcon name="location_on" size={18} />
}

export function IconCheckIn() {
  return <MaterialIcon name="login" size={18} />
}

export function IconClose() {
  return <MaterialIcon name="close" size={20} />
}

export function IconInfo({ size = 18 }: { size?: number }) {
  return <MaterialIcon name="info" size={size} />
}

export function IconFilter({ size = 14 }: { size?: number }) {
  return <MaterialIcon name="filter_list" size={size} />
}

export function IconSettings({ size = 20 }: { size?: number }) {
  return <MaterialIcon name="settings" size={size} />
}

export function IconNotifications({ size = 20 }: { size?: number }) {
  return <MaterialIcon name="notifications" size={size} />
}

export function IconAccount({ size = 22 }: { size?: number }) {
  return <MaterialIcon name="account_circle" size={size} />
}

export function IconSearch({ size = 20 }: { size?: number }) {
  return <MaterialIcon name="search" size={size} />
}

export function IconLive({ size = 18 }: { size?: number }) {
  return <MaterialIcon name="sensors" size={size} />
}

export function IconException({ size = 18 }: { size?: number }) {
  return <MaterialIcon name="error" size={size} />
}

export function IconHistory({ size = 18 }: { size?: number }) {
  return <MaterialIcon name="history" size={size} />
}

export function IconLightMode({ size = 22 }: { size?: number }) {
  return <MaterialIcon name="light_mode" size={size} />
}

export function IconHelp({ size = 22 }: { size?: number }) {
  return <MaterialIcon name="help" size={size} />
}

export function IconWarning({ size = 16 }: { size?: number }) {
  return <MaterialIcon name="warning" size={size} filled />
}

type ModalCloseBtnProps = {
  onClick: () => void
}

export function ModalCloseBtn({ onClick }: ModalCloseBtnProps) {
  return (
    <span className="ui-tip" data-tooltip="Close">
      <button
        type="button"
        className="modal-close-btn"
        aria-label="Close"
        onClick={onClick}
      >
        <IconClose />
      </button>
    </span>
  )
}
