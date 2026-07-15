/** Exception playbook definitions — capability-aware ops workflows. */

export type PlaybookKind =
  | 'temperature'
  | 'fuel'
  | 'reefer'
  | 'gps_offline'
  | 'ble_offline'
  | 'device_offline'
  | 'hold'
  | 'dwell'
  | 'generic'

export type PlaybookStep =
  | 'notified'
  | 'assigned'
  | 'inspecting'
  | 'resolved'

export const PLAYBOOK_STEP_META: Record<
  PlaybookStep,
  { label: string; order: number }
> = {
  notified: { label: 'Notified', order: 0 },
  assigned: { label: 'Assigned', order: 1 },
  inspecting: { label: 'Inspecting', order: 2 },
  resolved: { label: 'Resolved', order: 3 },
}

export const PLAYBOOK_STEPS: PlaybookStep[] = [
  'notified',
  'assigned',
  'inspecting',
  'resolved',
]

export type PlaybookDef = {
  kind: PlaybookKind
  title: string
  steps: string[]
  resumeHint: string
  preferQaRole?: boolean
  setQaHoldOnInspect?: boolean
}

export const PLAYBOOK_DEFS: Record<PlaybookKind, PlaybookDef> = {
  temperature: {
    kind: 'temperature',
    title: 'Temperature alert',
    steps: [
      'Generate notification',
      'Assign QA / yard owner',
      'Inspect trailer & reefer',
      'Resolve issue',
      'Resume operations',
    ],
    resumeHint: 'Clear QA hold and continue yard workflow',
    preferQaRole: true,
    setQaHoldOnInspect: true,
  },
  fuel: {
    kind: 'fuel',
    title: 'Low fuel alert',
    steps: [
      'Generate notification',
      'Assign yard ops',
      'Confirm tank & top-off plan',
      'Resolve issue',
      'Resume operations',
    ],
    resumeHint: 'Resume Ready to dock / dock assignment',
  },
  reefer: {
    kind: 'reefer',
    title: 'Reefer alarm',
    steps: [
      'Generate notification',
      'Assign QA',
      'Inspect unit & clear alarm',
      'Resolve issue',
      'Resume operations',
    ],
    resumeHint: 'Clear hold and release to dock queue',
    preferQaRole: true,
    setQaHoldOnInspect: true,
  },
  gps_offline: {
    kind: 'gps_offline',
    title: 'GPS offline',
    steps: [
      'Generate notification',
      'Assign yard ops',
      'Check device / swap unit',
      'Resolve issue',
      'Resume tracking',
    ],
    resumeHint: 'Confirm GPS capability restored on device',
  },
  ble_offline: {
    kind: 'ble_offline',
    title: 'BLE offline',
    steps: [
      'Generate notification',
      'Assign yard ops',
      'Check proximity / anchors',
      'Resolve issue',
      'Resume slot assist',
    ],
    resumeHint: 'BLE slot recommendations resume when online',
  },
  device_offline: {
    kind: 'device_offline',
    title: 'Device offline',
    steps: [
      'Generate notification',
      'Assign ops for swap',
      'Recover / replace Trailer Device',
      'Resolve issue',
      'Resume connected ops',
    ],
    resumeHint: 'Assign a healthy device at gate or cage',
  },
  hold: {
    kind: 'hold',
    title: 'Operational hold',
    steps: [
      'Hold raised',
      'Assign owner',
      'Inspect & clear cause',
      'Resolve hold',
      'Resume operations',
    ],
    resumeHint: 'Clear ops hold to unlock dock/yard moves',
    preferQaRole: true,
  },
  dwell: {
    kind: 'dwell',
    title: 'Excess dwell',
    steps: [
      'Generate notification',
      'Assign yard ops',
      'Plan move / dock',
      'Resolve dwell',
      'Resume flow',
    ],
    resumeHint: 'Advance to Ready to dock or relocate',
  },
  generic: {
    kind: 'generic',
    title: 'Exception',
    steps: [
      'Generate notification',
      'Assign owner',
      'Inspect',
      'Resolve',
      'Resume',
    ],
    resumeHint: 'Return trailer to normal yard workflow',
  },
}

export function playbookForReason(reason: string): PlaybookKind {
  const r = reason.toLowerCase()
  if (r.includes('temperature') || r.includes('warming') || r.includes('excursion'))
    return 'temperature'
  if (r.includes('fuel')) return 'fuel'
  if (r.includes('reefer')) return 'reefer'
  if (r.includes('gps')) return 'gps_offline'
  if (r.includes('ble')) return 'ble_offline'
  if (r.includes('device offline') || r.includes('telemetry'))
    return 'device_offline'
  if (r.includes('hold')) return 'hold'
  if (r.includes('dwell')) return 'dwell'
  return 'generic'
}
