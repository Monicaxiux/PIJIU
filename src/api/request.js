const DEFAULT_API_BASE_URL = 'https://m1.apifoxmock.com/m1/1453639-2169205-default'

function runtimeConfig() {
  if (typeof window === 'undefined') return {}
  return window.__TRAPVISION_CONFIG__ || window.__APP_CONFIG__ || {}
}

export function getApiBaseUrl() {
  const configured = runtimeConfig().apiBaseUrl || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
  return String(configured).trim().replace(/\/+$/, '')
}

function applyRequestInterceptors(config) {
  const headers = new Headers(config.headers || {})
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  return { ...config, headers }
}

function buildUrl(path, params) {
  const url = /^https?:\/\//i.test(path) ? new URL(path) : new URL(`${getApiBaseUrl()}/${String(path).replace(/^\/+/, '')}`)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  return url
}

export async function request(path, options = {}) {
  const { params, ...fetchOptions } = options
  const config = applyRequestInterceptors({
    ...fetchOptions,
    headers: fetchOptions.headers,
    credentials: fetchOptions.credentials || 'same-origin'
  })
  const response = await fetch(buildUrl(path, params), config)
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`)
  return response.json()
}

request.get = (path, options = {}) => request(path, { ...options, method: 'GET' })
