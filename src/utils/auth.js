const SESSION_KEY = 'trapvision:session'
const USER_KEY = 'trapvision:user'

export function isAuthenticated() {
  return localStorage.getItem(SESSION_KEY) === 'active' || sessionStorage.getItem(SESSION_KEY) === 'active'
}

export function getCurrentUser() {
  return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || '运维中心'
}

export function createSession(username, remember) {
  clearSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(SESSION_KEY, 'active')
  storage.setItem(USER_KEY, username)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(USER_KEY)
}
