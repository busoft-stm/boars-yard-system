import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  ROLE_META,
  type UserRole,
  type UserStatus,
} from '../data/users'
import { useUsers } from '../users/UsersContext'
import {
  ActionIconBtn,
  IconDelete,
  IconDisable,
  IconEdit,
  IconEnable,
  IconInfo,
  IconKey,
  ModalCloseBtn,
} from '../components/ActionIcons'

import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { Pagination, usePagination } from '../components/Pagination'
import { useSnackbar } from '../components/Snackbar'

const roles = Object.keys(ROLE_META) as UserRole[]

const STATUS_LABELS: Record<string, string> = {
  active: 'active',
  invited: 'invited',
  disabled: 'disabled',
}

export function UsersPage() {
  const { canManageUsers, user: me } = useAuth()
  const { users, addUser, updateUser, setUserPassword, deleteUser, setUserStatus } =
    useUsers()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { success, error: showError } = useSnackbar()
  const [q, setQ] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [siteFilter, setSiteFilter] = useState('all')
  const [lastActiveFilter, setLastActiveFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [passwordModalId, setPasswordModalId] = useState<string | null>(null)
  const [showRoleInfo, setShowRoleInfo] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('yard_ops')
  const [site, setSite] = useState('Primary DC')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<UserStatus>('invited')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const counts = useMemo(() => {
    const byRole = roles.map((r) => ({
      role: r,
      count: users.filter((u) => u.role === r && u.status !== 'disabled').length,
    }))
    return {
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      invited: users.filter((u) => u.status === 'invited').length,
      byRole,
    }
  }, [users])

  const userOptions = useMemo(
    () => uniqueOptions(users.map((u) => u.name)),
    [users],
  )
  const roleOptions = useMemo(
    () =>
      uniqueOptions(users.map((u) => u.role), (v) => ROLE_META[v as UserRole]?.label ?? v),
    [users],
  )
  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        users.map((u) => u.status),
        (v) => STATUS_LABELS[v] ?? v,
      ),
    [users],
  )
  const siteOptions = useMemo(
    () => uniqueOptions(users.map((u) => u.site)),
    [users],
  )
  const lastActiveOptions = useMemo(
    () => uniqueOptions(users.map((u) => u.lastActive)),
    [users],
  )

  const rows = useMemo(() => {
    return users
      .filter((u) => {
        const hay = `${u.name} ${u.email} ${u.site} ${ROLE_META[u.role].label}`.toLowerCase()
        if (q && !hay.includes(q.toLowerCase())) return false
        if (userFilter !== 'all' && u.name !== userFilter) return false
        if (roleFilter !== 'all' && u.role !== roleFilter) return false
        if (statusFilter !== 'all' && u.status !== statusFilter) return false
        if (siteFilter !== 'all' && u.site !== siteFilter) return false
        if (lastActiveFilter !== 'all' && u.lastActive !== lastActiveFilter)
          return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [
    users,
    q,
    userFilter,
    roleFilter,
    statusFilter,
    siteFilter,
    lastActiveFilter,
  ])

  const filterKey = `${q}|${userFilter}|${roleFilter}|${statusFilter}|${siteFilter}|${lastActiveFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  if (!canManageUsers) {
    return <Navigate to="/" replace />
  }

  function openCreate() {
    setEditingId(null)
    setName('')
    setEmail('')
    setRole('yard_ops')
    setSite('Primary DC')
    setPhone('')
    setStatus('invited')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setOpen(true)
  }

  function openEdit(id: string) {
    const u = users.find((x) => x.id === id)
    if (!u) return
    setEditingId(id)
    setName(u.name)
    setEmail(u.email)
    setRole(u.role)
    setSite(u.site)
    setPhone(u.phone ?? '')
    setStatus(u.status)
    setPassword('')
    setConfirmPassword('')
    setError('')
    setOpen(true)
  }

  function openChangePassword(id: string) {
    setPasswordModalId(id)
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    try {
      if (editingId) {
        await updateUser(editingId, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          site: site.trim() || 'Primary DC',
          phone: phone.trim() || undefined,
          status,
        })
        success(`User ${name.trim()} updated.`)
      } else {
        if (password.trim().length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        if (password !== confirmPassword) {
          setError('Password and confirmation do not match.')
          return
        }
        const exists = users.some(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
        )
        if (exists) {
          setError('A user with this email already exists.')
          return
        }
        await addUser({
          name,
          email,
          role,
          site,
          phone,
          status,
          password,
        })
        success(`User ${name.trim()} added.`)
      }
      setOpen(false)
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : editingId
            ? 'Could not save user changes.'
            : 'Could not add user.',
      )
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (!passwordModalId) return
    if (newPassword.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Password and confirmation do not match.')
      return
    }
    const target = users.find((u) => u.id === passwordModalId)
    try {
      await setUserPassword(passwordModalId, newPassword)
      success(`Password updated for ${target?.name ?? 'user'}.`)
      setPasswordModalId(null)
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Could not update password.',
      )
    }
  }

  const passwordTarget = passwordModalId
    ? users.find((u) => u.id === passwordModalId)
    : null

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Access control</div>
          <div className="title-with-info">
            <h1>Users</h1>
            <button
              type="button"
              className="info-icon-btn"
              aria-label="About user types"
              title="About user types"
              onClick={() => setShowRoleInfo(true)}
            >
              <IconInfo size={18} />
            </button>
          </div>
          <p>
            Add, edit, enable, and remove users. Set a password when creating an
            account, or change passwords from the list. Roles control module
            access at sign-in.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowRoleInfo(true)}
          >
            User types
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add user
          </button>
        </div>
      </div>

      <div className="stats stats-6">
        <div className="stat">
          <div className="stat-label">Users</div>
          <div className="stat-value">{counts.total}</div>
          <div className="stat-note">{counts.active} active</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Invited</div>
          <div className="stat-value">{counts.invited}</div>
          <div className="stat-note">Pending activation</div>
        </div>
        {counts.byRole.slice(0, 4).map((r) => (
          <div key={r.role} className="stat">
            <div className="stat-label">{ROLE_META[r.role].label}</div>
            <div className="stat-value">{r.count}</div>
            <div className="stat-note">Active / invited</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, email, site…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="panel table-wrap table-wrap-filters">
        <table>
          <thead>
            <tr>
              <th>
                <ColumnFilterHeader
                  label="User"
                  value={userFilter}
                  options={userOptions}
                  onChange={setUserFilter}
                  searchable
                  searchPlaceholder="Search user…"
                />
              </th>
              <th>
                <span className="th-with-info">
                  <ColumnFilterHeader
                    label="Role"
                    value={roleFilter}
                    options={roleOptions}
                    onChange={setRoleFilter}
                  />
                  <button
                    type="button"
                    className="info-icon-btn info-icon-btn-sm"
                    aria-label="About user types"
                    title="About user types"
                    onClick={() => setShowRoleInfo(true)}
                  >
                    <IconInfo size={14} />
                  </button>
                </span>
              </th>
              <th>
                <ColumnFilterHeader
                  label="Status"
                  value={statusFilter}
                  options={statusOptions}
                  onChange={setStatusFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Site"
                  value={siteFilter}
                  options={siteOptions}
                  onChange={setSiteFilter}
                  searchable
                  searchPlaceholder="Search site…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Last active"
                  value={lastActiveFilter}
                  options={lastActiveOptions}
                  onChange={setLastActiveFilter}
                  searchable
                  searchPlaceholder="Search…"
                />
              </th>
              <th>
                <PlainHeader>Actions</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="trailer-cell">
                    <span className="trailer-id">{u.name}</span>
                    <span className="trailer-meta">{u.email}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge role-${u.role}`}>
                    {ROLE_META[u.role].label}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      u.status === 'active'
                        ? 'ok'
                        : u.status === 'invited'
                          ? 'warn'
                          : 'offline'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="trailer-meta">{u.site}</td>
                <td className="trailer-meta">{u.lastActive}</td>
                <td>
                  <div className="action-icon-row">
                    <ActionIconBtn
                      label="Edit user"
                      onClick={() => openEdit(u.id)}
                    >
                      <IconEdit />
                    </ActionIconBtn>
                    <ActionIconBtn
                      label="Change password"
                      onClick={() => openChangePassword(u.id)}
                    >
                      <IconKey />
                    </ActionIconBtn>
                    {u.status !== 'disabled' ? (
                      <ActionIconBtn
                        label="Disable user"
                        tone="danger"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirm({
                              title: 'Disable user',
                              message: `Disable ${u.name}? They will not be able to sign in until re-enabled.`,
                              confirmLabel: 'Disable',
                              tone: 'danger',
                            })
                            if (ok) {
                              try {
                                await setUserStatus(u.id, 'disabled')
                                success(`${u.name} disabled.`)
                              } catch {
                                showError(`Could not disable ${u.name}.`)
                              }
                            }
                          })()
                        }}
                      >
                        <IconDisable />
                      </ActionIconBtn>
                    ) : (
                      <ActionIconBtn
                        label="Enable user"
                        tone="ok"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirm({
                              title: 'Enable user',
                              message: `Enable ${u.name}? They will be able to sign in again.`,
                              confirmLabel: 'Enable',
                            })
                            if (ok) {
                              try {
                                await setUserStatus(u.id, 'active')
                                success(`${u.name} enabled.`)
                              } catch {
                                showError(`Could not enable ${u.name}.`)
                              }
                            }
                          })()
                        }}
                      >
                        <IconEnable />
                      </ActionIconBtn>
                    )}
                    <ActionIconBtn
                      label="Delete user"
                      tone="danger"
                      disabled={u.id === me?.id}
                      onClick={() => {
                        if (u.id === me?.id) return
                        void (async () => {
                          const ok = await confirm({
                            title: 'Delete user',
                            message: `Delete ${u.name}? They will no longer be able to sign in.`,
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          })
                          if (ok) {
                            try {
                              await deleteUser(u.id)
                              success(`${u.name} deleted.`)
                            } catch {
                              showError(`Could not delete ${u.name}.`)
                            }
                          }
                        })()
                      }}
                    >
                      <IconDelete />
                    </ActionIconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No users match the filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Pagination
          page={pagination.page}
          setPage={pagination.setPage}
          pageSize={pagination.pageSize}
          setPageSize={pagination.setPageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
        />
      </div>

      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Directory</div>
                <h2>{editingId ? 'Edit user' : 'Add user'}</h2>
              </div>
              <ModalCloseBtn onClick={() => setOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-body">
              {error ? <div className="form-error">{error}</div> : null}
              <div className="form-grid">
                <label className="field">
                  <span>Full name</span>
                  <input
                    className="search"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    className="search"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select
                    className="select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    className="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                  >
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Site</span>
                  <input
                    className="search"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input
                    className="search"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(614) 555-0100"
                  />
                </label>
                {!editingId ? (
                  <>
                    <label className="field">
                      <span>Password</span>
                      <input
                        className="search"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                      />
                    </label>
                    <label className="field">
                      <span>Confirm password</span>
                      <input
                        className="search"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                      />
                    </label>
                  </>
                ) : null}
              </div>

              {!editingId ? (
                <p className="trailer-meta" style={{ margin: '0.75rem 0 0' }}>
                  The user signs in with this email and password. Admins can
                  change the password later from the user list.
                </p>
              ) : (
                <p className="trailer-meta" style={{ margin: '0.75rem 0 0' }}>
                  To change this user’s password, use Change password on the
                  list row.
                </p>
              )}

              <div className="form-section">
                <div className="eyebrow">Role permissions</div>
                <ul className="perm-list">
                  {ROLE_META[role].permissions.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
                </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {passwordModalId && passwordTarget ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPasswordModalId(null)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Access</div>
                <h2 id="change-password-title">Change password</h2>
              </div>
              <ModalCloseBtn onClick={() => setPasswordModalId(null)} />
            </div>
            <form className="modal-form" onSubmit={handleChangePassword}>
              <div className="modal-body">
                <p className="trailer-meta" style={{ marginTop: 0 }}>
                  Set a new sign-in password for{' '}
                  <strong>{passwordTarget.name}</strong> (
                  {passwordTarget.email}).
                </p>
                {passwordError ? (
                  <div className="form-error">{passwordError}</div>
                ) : null}
                <div className="form-grid">
                  <label className="field">
                    <span>New password</span>
                    <input
                      className="search"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>Confirm new password</span>
                    <input
                      className="search"
                      type="password"
                      autoComplete="new-password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter password"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPasswordModalId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update password
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showRoleInfo ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowRoleInfo(false)}
        >
          <div
            className="modal-panel role-info-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Reference</div>
                <h2 id="role-info-title">User types</h2>
              </div>
              <ModalCloseBtn onClick={() => setShowRoleInfo(false)} />
            </div>
            <div className="modal-body">
            <p className="role-info-lead">
              Roles control what each person can see and do in Smart Yard. Assign
              a type when you create or edit a user — it is applied at sign-in.
            </p>
            <div className="role-info-list">
              {roles.map((r) => (
                <article key={r} className="role-info-item">
                  <div className="role-info-item-head">
                    <span className={`role-badge role-${r}`}>
                      {ROLE_META[r].label}
                    </span>
                  </div>
                  <p>{ROLE_META[r].description}</p>
                  <ul className="perm-list">
                    {ROLE_META[r].permissions.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            </div>
            <div className="modal-actions">
                <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRoleInfo(false)}
              >
                Got it
              </button>
              </div>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  )
}
