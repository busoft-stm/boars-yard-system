import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useUsers } from '../users/UsersContext'
import { useSnackbar } from './Snackbar'
import { ModalCloseBtn } from './ActionIcons'

type AccountPanel = 'profile' | 'password' | null

type AccountSettingsModalsProps = {
  panel: AccountPanel
  onClose: () => void
}

export function AccountSettingsModals({
  panel,
  onClose,
}: AccountSettingsModalsProps) {
  const { user, updateProfile, changePassword } = useAuth()
  const { users } = useUsers()
  const { success } = useSnackbar()

  const managed = user ? users.find((u) => u.id === user.id) : undefined

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [site, setSite] = useState('')
  const [phone, setPhone] = useState('')
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (panel !== 'profile' || !user) return
    setName(user.name)
    setEmail(user.email)
    setSite(user.site)
    setPhone(managed?.phone ?? '')
    setProfileError('')
  }, [panel, user, managed?.phone])

  useEffect(() => {
    if (panel !== 'password') return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }, [panel])

  if (!user || !panel) return null

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await updateProfile({ name, email, site, phone })
      success('Profile updated.')
      onClose()
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Could not update profile.',
      )
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Password and confirmation do not match.')
      return
    }
    try {
      await changePassword(currentPassword, newPassword)
      success('Password updated.')
      onClose()
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Could not update password.',
      )
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-panel modal-panel-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          panel === 'profile' ? 'edit-profile-title' : 'change-password-title'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {panel === 'profile' ? (
          <>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Account</div>
                <h2 id="edit-profile-title">Edit profile</h2>
              </div>
              <ModalCloseBtn onClick={onClose} />
            </div>
            <form className="modal-form" onSubmit={handleProfileSubmit}>
              <div className="modal-body">
                <p className="trailer-meta" style={{ marginTop: 0 }}>
                  Update your sign-in details. Role stays{' '}
                  <strong>{user.roleLabel}</strong>.
                </p>
                {profileError ? (
                  <div className="form-error">{profileError}</div>
                ) : null}
                <div className="form-grid">
                  <label className="field">
                    <span>Name</span>
                    <input
                      className="search"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      autoFocus
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      className="search"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Site</span>
                    <input
                      className="search"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                      placeholder="Primary DC"
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      className="search"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                      autoComplete="tel"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save profile
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Account</div>
                <h2 id="change-password-title">Change password</h2>
              </div>
              <ModalCloseBtn onClick={onClose} />
            </div>
            <form className="modal-form" onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                <p className="trailer-meta" style={{ marginTop: 0 }}>
                  Enter your current password, then choose a new one for{' '}
                  <strong>{user.email}</strong>.
                </p>
                {passwordError ? (
                  <div className="form-error">{passwordError}</div>
                ) : null}
                <div className="form-grid">
                  <label className="field">
                    <span>Current password</span>
                    <input
                      className="search"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoFocus
                      required
                    />
                  </label>
                  <label className="field">
                    <span>New password</span>
                    <input
                      className="search"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Confirm new password</span>
                    <input
                      className="search"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update password
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
