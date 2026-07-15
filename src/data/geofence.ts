/**
 * GPS geofence events — enter/leave yard prompts and device recovery cues.
 */

export type GeofenceEventType = 'enter_yard' | 'leave_yard'

export type GeofenceEvent = {
  id: string
  type: GeofenceEventType
  trailerNumber: string
  trailerId: string
  deviceId?: string
  time: string
  detail: string
  acknowledged: boolean
  /** Prompt device recovery when leaving with an assigned device. */
  needsDeviceRecovery: boolean
}

export const seedGeofenceEvents: GeofenceEvent[] = [
  {
    id: 'gf-leave-ftl',
    type: 'leave_yard',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    deviceId: 'USD-1015',
    time: '1:51 PM',
    detail: 'Left yard geofence at gate perimeter · GPS still tracking',
    acknowledged: false,
    needsDeviceRecovery: true,
  },
  {
    id: 'gf-enter-demo',
    type: 'enter_yard',
    trailerNumber: 'NX-552',
    trailerId: 'nx-552',
    time: '10:55 AM',
    detail: 'Entered yard geofence · arrival event for dashboard',
    acknowledged: true,
    needsDeviceRecovery: false,
  },
]
