import type { UserRole } from '../data/users'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  roleLabel: string
  site: string
}
