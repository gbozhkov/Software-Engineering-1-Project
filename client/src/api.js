import axios from 'axios'
import { getSession, clearSession } from './utils/auth'

const api = axios.create({
  baseURL: 'http://localhost:3000'
})

api.interceptors.request.use(config => {
  const session = getSession()
  if (session) {
    config.headers['x-username'] = session.username
    config.headers['x-session-id'] = session.sessionId
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401) {
      // Session is invalid; clear it but do not force redirect so public browsing keeps working
      clearSession()
    }
    return Promise.reject(err)
  }
)

export const getErrorMessage = err =>
  err?.response?.data?.message ||
  err?.message ||
  'Something went wrong'

export default api
