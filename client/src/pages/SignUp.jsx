import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../api"
import { clearSession, saveSession } from "../utils/auth"

const SignUp = () => {
  const [form, setForm] = useState({ username: "", password: "", confirm: "" })
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (form.password !== form.confirm) {
      setError("Passwords do not match")
      return
    }
    try {
      const res = await api.post("/signup", { username: form.username.trim(), password: form.password })
      clearSession()
      saveSession({
        username: res.data.username,
        role: res.data.role,
        club: res.data.club,
        sessionId: res.data.sessionId
      })
      navigate("../")
    } catch (err) {
      const msg = err.response?.data?.message || "Unable to create account right now"
      setError(msg)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <span className="pill soft">Create account</span>
        <h1>Join School Club Activity</h1>
        <p>Sign up as a student to browse clubs, request to join, and follow events.</p>
        <div className="login-highlights">
          <div><span className="dot" aria-hidden="true"></span>Create a club if you don&apos;t belong to one</div>
          <div><span className="dot" aria-hidden="true"></span>Stay updated with notifications</div>
          <div><span className="dot" aria-hidden="true"></span>Share feedback with comments</div>
        </div>
      </div>

      <div className="login-card">
        <div className="login-card__header">
          <h2>Sign up</h2>
          <p>Pick a username and password to get started.</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              placeholder="Choose a username"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={3}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="At least 6 characters"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              placeholder="Re-enter password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              required
            />
          </label>
          <button type="submit" className="btn-primary">Create account</button>
          <p className="login-hint">
            Already registered? <Link to="/LogIn">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default SignUp
