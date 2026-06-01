import { SHAMELESSS_CONFIG } from '../config.js'

export function appBaseUrl() {
  return SHAMELESSS_CONFIG.appUrl.replace(/\/$/, '')
}

export async function apiFetch(path, { method = 'GET', body, accessToken } = {}) {
  const headers = { Accept: 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${appBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }
  return data
}

export function crmWebUrl(path) {
  return `${appBaseUrl()}${path}`
}
