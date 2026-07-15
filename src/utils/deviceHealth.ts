import type { UnifiedSmartDevice } from '../data/smartEnterprise'
import { CAPABILITY_META } from '../data/smartEnterprise'

export type DeviceHealthIssue = {
  level: 'block' | 'warn'
  message: string
}

export function validateDeviceHealth(
  device: UnifiedSmartDevice,
): DeviceHealthIssue[] {
  const issues: DeviceHealthIssue[] = []

  if (device.lifecycle === 'lost' || device.lifecycle === 'retired') {
    issues.push({
      level: 'block',
      message: `Device is ${device.lifecycle} and cannot be assigned.`,
    })
  }
  if (device.lifecycle === 'maintenance') {
    issues.push({
      level: 'block',
      message: 'Device is in maintenance.',
    })
  }
  if (device.lifecycle === 'charging') {
    issues.push({
      level: 'warn',
      message: 'Device is still on charge bay.',
    })
  }
  if (device.connectivity === 'offline' || device.health === 'offline') {
    issues.push({
      level: 'block',
      message: 'Connectivity / health is offline.',
    })
  } else if (
    device.connectivity === 'degraded' ||
    device.health === 'degraded'
  ) {
    issues.push({
      level: 'warn',
      message: 'Connectivity or health is degraded.',
    })
  }
  if (device.batteryPct < 15) {
    issues.push({
      level: 'block',
      message: `Battery critically low (${device.batteryPct}%).`,
    })
  } else if (device.batteryPct < 25) {
    issues.push({
      level: 'warn',
      message: `Battery low (${device.batteryPct}%).`,
    })
  }
  if (device.healthScore < 40) {
    issues.push({
      level: 'block',
      message: `Health score too low (${device.healthScore}/100).`,
    })
  } else if (device.healthScore < 70) {
    issues.push({
      level: 'warn',
      message: `Health score marginal (${device.healthScore}/100).`,
    })
  }
  if (!device.firmwareVersion || device.firmwareVersion === '—') {
    issues.push({
      level: 'warn',
      message: 'Firmware version not recorded.',
    })
  }
  if (!device.capabilities.length) {
    issues.push({
      level: 'block',
      message: 'No capabilities configured on device.',
    })
  }

  return issues
}

export function deviceHealthSummary(device: UnifiedSmartDevice) {
  const issues = validateDeviceHealth(device)
  const blockers = issues.filter((i) => i.level === 'block')
  const warnings = issues.filter((i) => i.level === 'warn')
  return {
    issues,
    blockers,
    warnings,
    ok: blockers.length === 0,
    canForce: blockers.length === 0 || true, // force still allowed with confirmation
  }
}

export function capabilityActivationLines(device: UnifiedSmartDevice) {
  return device.capabilities.map(
    (c) => `${CAPABILITY_META[c].label} — ${CAPABILITY_META[c].feature}`,
  )
}
