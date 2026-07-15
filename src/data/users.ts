export type UserRole =
  | 'admin'
  | 'site_lead'
  | 'yard_ops'
  | 'qa'
  | 'gate'
  | 'viewer'

export type UserStatus = 'active' | 'invited' | 'disabled'

export type ManagedUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  site: string
  lastActive: string
  phone?: string
  /** Plain-text demo password — set on create; admin can change from Users. */
  password: string
}

/** Default password for seeded demo accounts. */
export const DEFAULT_USER_PASSWORD = 'yard-demo'

export const ROLE_META: Record<
  UserRole,
  { label: string; description: string; permissions: string[] }
> = {
  admin: {
    label: 'Platform Admin',
    description: 'Full access including user management and integrations.',
    permissions: [
      'Manage users & roles',
      'All yard operations',
      'OTM / device settings',
      'Analytics & exports',
    ],
  },
  site_lead: {
    label: 'Site Lead',
    description: 'Site-wide oversight across Ops, QA, and gate.',
    permissions: [
      'Dashboard & analytics',
      'Exceptions escalation',
      'Gate & yard oversight',
      'View all trailers',
    ],
  },
  yard_ops: {
    label: 'Yard Operations',
    description: 'Day-to-day yard movement, slots, and exceptions.',
    permissions: [
      'Yard Management & movements',
      'Trailer inventory',
      'Exceptions',
    ],
  },
  qa: {
    label: 'QA Inspector',
    description: 'Cold-chain compliance, holds, and exceptions.',
    permissions: [
      'Temperature monitoring',
      'QA holds',
      'Exceptions',
    ],
  },
  gate: {
    label: 'Gate Clerk',
    description: 'Inbound/outbound check-in, seals, and slot assignment.',
    permissions: [
      'Gate console',
      'Add trailer check-in',
      'Seal verification',
      'View Yard Management',
    ],
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only operational visibility for stakeholders.',
    permissions: [
      'Dashboard (read-only)',
      'Yard Management (read-only)',
      'Trailer list (read-only)',
      'No edit actions',
    ],
  },
}

/** Nav paths each role can access. Admin/site_lead get everything. */
export const ROLE_NAV: Record<UserRole, string[] | 'all'> = {
  admin: 'all',
  site_lead: 'all',
  yard_ops: [
    '/',
    '/yards',
    '/trailers',
    '/temperature',
    '/gate',
    '/dock',
    '/movements',
    '/exceptions',
    '/devices',
    '/infrastructure',
    '/insights',
    '/reports',
    '/integrations',
    '/architecture',
    '/mobile',
  ],
  qa: [
    '/',
    '/yards',
    '/trailers',
    '/temperature',
    '/exceptions',
    '/movements',
    '/insights',
    '/analytics',
    '/reports',
    '/infrastructure',
    '/mobile',
  ],
  gate: [
    '/',
    '/yards',
    '/trailers',
    '/gate',
    '/dock',
    '/movements',
    '/devices',
    '/infrastructure',
    '/mobile',
  ],
  viewer: [
    '/',
    '/yards',
    '/trailers',
    '/temperature',
    '/movements',
    '/analytics',
    '/reports',
    '/insights',
    '/architecture',
  ],
}

export function roleCanAccess(role: UserRole, path: string) {
  const allow = ROLE_NAV[role]
  if (allow === 'all') return true
  if (path.startsWith('/trailer/')) return allow.includes('/trailers')
  if (path === '/mobile' || path.startsWith('/mobile/')) {
    return allow.includes('/mobile')
  }
  if (path === '/users') return role === 'admin'
  // Legacy redirects: /alerts and /walk → /exceptions
  if (path === '/alerts' || path === '/walk') {
    return allow.includes('/exceptions')
  }
  return allow.includes(path)
}

export const seedUsers: ManagedUser[] = [
  {
    id: 'u-admin',
    name: 'Alex Rivera',
    email: 'alex.rivera@boarshead.com',
    role: 'admin',
    status: 'active',
    site: 'Primary DC',
    lastActive: 'Just now',
    phone: '(614) 555-0101',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-lead',
    name: 'Morgan Chen',
    email: 'morgan.chen@boarshead.com',
    role: 'site_lead',
    status: 'active',
    site: 'Primary DC',
    lastActive: '12 min ago',
    phone: '(614) 555-0102',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-ops',
    name: 'Jordan Hale',
    email: 'jordan.hale@boarshead.com',
    role: 'yard_ops',
    status: 'active',
    site: 'Primary DC',
    lastActive: '3 min ago',
    phone: '(614) 555-0103',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-qa',
    name: 'Sam Okonkwo',
    email: 'sam.okonkwo@boarshead.com',
    role: 'qa',
    status: 'active',
    site: 'Primary DC',
    lastActive: '28 min ago',
    phone: '(614) 555-0104',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-gate',
    name: 'Casey Brooks',
    email: 'casey.brooks@boarshead.com',
    role: 'gate',
    status: 'active',
    site: 'Primary DC',
    lastActive: '1 hr ago',
    phone: '(614) 555-0105',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-viewer',
    name: 'Riley Nguyen',
    email: 'riley.nguyen@boarshead.com',
    role: 'viewer',
    status: 'active',
    site: 'Sarasota, FL',
    lastActive: 'Yesterday',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-invited',
    name: 'Taylor Singh',
    email: 'taylor.singh@boarshead.com',
    role: 'qa',
    status: 'invited',
    site: 'Primary DC',
    lastActive: 'Invite pending',
    password: DEFAULT_USER_PASSWORD,
  },
  {
    id: 'u-disabled',
    name: 'Former Contractor',
    email: 'contractor@example.com',
    role: 'viewer',
    status: 'disabled',
    site: 'Primary DC',
    lastActive: 'Mar 2, 2026',
    password: DEFAULT_USER_PASSWORD,
  },
]
