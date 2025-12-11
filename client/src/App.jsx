import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';

import './App.css';
import Home from './pages/Home.jsx';
import LogIn from './pages/LogIn.jsx';
import CreateClub from './pages/CreateClub.jsx';
import ClubPage from './pages/ClubPage.jsx';
import Comment from './pages/Comment.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import UpdateClub from './pages/UpdateClub.jsx';
import Notifications from './pages/Notifications.jsx';
import api from './api';
import { clearSession, getSession } from './utils/auth';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const session = getSession()
  if (!session) {
    return <Navigate to="/LogIn" replace />
  }
  return children
}

function App() {
  const [session, setSession] = useState(getSession())
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const sync = async () => {
      const nextSession = getSession()
      setSession(prev => {
        const same = JSON.stringify(prev || {}) === JSON.stringify(nextSession || {})
        return same ? prev : nextSession
      })
      if (!nextSession) {
        setUnread(0)
        return
      }
      try {
        // Refresh session from server to get latest role/club info
        const sessionRes = await api.get('/session')
        const serverSession = sessionRes.data
        
        // Update local session if server has different data
        if (nextSession.role !== serverSession.role || nextSession.club !== serverSession.club) {
          const updatedSession = {
            ...nextSession,
            role: serverSession.role,
            club: serverSession.club
          }
          setSession(updatedSession)
          window.localStorage.setItem('sca_session', JSON.stringify(updatedSession))
        }
        
        const res = await api.get('/notifications/unreadCount')
        setUnread(res.data.total || 0)
      } catch (err) {
        // If session is invalid, it will be handled by api interceptor
      }
    }

    sync()
    const interval = setInterval(sync, 30000)
    const onStorage = () => sync()
    const onSessionChange = () => sync()
    const onUnreadChange = () => sync()
    window.addEventListener('storage', onStorage)
    window.addEventListener('sca:session-change', onSessionChange)
    window.addEventListener('sca:unread-change', onUnreadChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('sca:session-change', onSessionChange)
      window.removeEventListener('sca:unread-change', onUnreadChange)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await api.post('/logout')
    } catch {
      // ignore
    }
    clearSession()
    window.location.href = '/'
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AppContent 
          session={session} 
          unread={unread} 
          handleLogout={handleLogout}
        />
      </BrowserRouter>
    </div>
  )
}

function AppContent({ session, unread, handleLogout }) {
  const location = useLocation()
  const isLoginPage = location.pathname === '/LogIn'

  return (
    <>
      {!isLoginPage && (
        <header className="top-nav">
          <div className="brand">School Club Activity</div>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/notifications">
              Notifications
              {unread > 0 && <span className="pill">{unread}</span>}
            </Link>
            {session?.club ? (
              <Link className="chip-link" to={`/ClubPage/${session.club}`}>
                My Club
              </Link>
            ) : (
              <Link to="/CreateClub">Create Club</Link>
            )}
          </nav>
          <div className="nav-actions">
            {session ? (
              <>
                <span className="user-chip">{session.username} ({session.role}{session.club ? ` · ${session.club}` : ""})</span>
                <button className="ghost" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <Link className="ghost" to="/LogIn">Login</Link>
            )}
          </div>
        </header>
      )}
      <Routes>
        <Route path="/LogIn" element={<LogIn/>} />
          <Route path="/" element={<ProtectedRoute><Home/></ProtectedRoute>} />
          <Route path="/CreateClub" element={<ProtectedRoute><CreateClub/></ProtectedRoute>} />
          <Route path="/ClubPage/:clubName" element={<ProtectedRoute><ClubPage/></ProtectedRoute>} />
          <Route path="/Comment/:clubName" element={<ProtectedRoute><Comment/></ProtectedRoute>} />
          <Route path="/CreateEvent/:clubName" element={<ProtectedRoute><CreateEvent/></ProtectedRoute>} />
          <Route path="/UpdateClub/:clubName" element={<ProtectedRoute><UpdateClub/></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications/></ProtectedRoute>} />
      </Routes>
    </>
  )
}

export default App
