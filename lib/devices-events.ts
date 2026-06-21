export const DEVICES_CHANGED_EVENT = 'devices:changed'
export const DEVICE_DETAIL_CHANGED_EVENT = 'device-detail:changed'

export function notifyDevicesChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DEVICES_CHANGED_EVENT))
}

export function notifyDeviceDetailChanged(deviceId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DEVICE_DETAIL_CHANGED_EVENT, { detail: { deviceId } }))
}
