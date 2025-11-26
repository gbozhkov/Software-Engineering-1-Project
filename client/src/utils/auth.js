const STORAGE_KEY = 'sca_session'

export const saveSession = session => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event('sca:session-change'))
}

export const getSession = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('sca:session-change'))
}

export const authHeaders = () => {
  const session = getSession()
  if (!session) return {}
  return {
    'x-username': session.username,
    'x-session-id': session.sessionId
  }
}
