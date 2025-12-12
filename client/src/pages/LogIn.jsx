// Page for user login
import { React, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import api from "../api"
import { saveSession, clearSession } from "../utils/auth"

const LogIn = () => {
  const [credential, setCredential] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    setCredential((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('/login', credential)
      clearSession()
      saveSession({
        username: res.data.username,
        role: res.data.role,
        club: res.data.club,
        sessionId: res.data.sessionId
      })
      navigate('../')
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid credentials. Double-check your username/password.')
        return
      }
      console.error(err)
      setError('Unable to login right now')
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <span className="pill soft">Secure login</span>
        <h1>Welcome back</h1>
        <p>Access your clubs, manage events, and stay on top of notifications.</p>
        <div className="login-highlights">
          <div>
            <span className="dot" aria-hidden="true"></span>
            Single place for clubs & events
          </div>
          <div>
            <span className="dot" aria-hidden="true"></span>
            Members-only announcements
          </div>
          <div>
            <span className="dot" aria-hidden="true"></span>
            Quick, secure sign-in
          </div>
        </div>
      </div>

      <div className="login-card">
        <div className="login-card__header">
          <h2>Sign in</h2>
          <p>Enter your credentials to continue.</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              placeholder="e.g. Ben"
              name="username"
              value={credential.username}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="••••••••"
              name="password"
              value={credential.password}
              onChange={handleChange}
              required
            />
          </label>
          <button type="submit" className="btn-primary">Login</button>
          <p className="login-hint">Tip: use a student account (e.g. Ben / student123) to explore.</p>
          <p className="login-hint">
            New here? <Link className="link-cta" to="/SignUp">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default LogIn
