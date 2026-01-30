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
import SignUp from './pages/SignUp.jsx';
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
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('sca_darkMode')
    return saved ? JSON.parse(saved) : false
  })

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('sca_darkMode', JSON.stringify(darkMode))
  }, [darkMode])

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
        // Refresh session from server to get latest memberships info
        const sessionRes = await api.get('/session')
        const serverSession = sessionRes.data
        
        // Update local session if server has different memberships data
        const localMemberships = JSON.stringify(nextSession.memberships || [])
        const serverMemberships = JSON.stringify(serverSession.memberships || [])
        if (localMemberships !== serverMemberships || nextSession.isAdmin !== serverSession.isAdmin) {
          const updatedSession = {
            ...nextSession,
            memberships: serverSession.memberships,
            isAdmin: serverSession.isAdmin
          }
          setSession(updatedSession)
          window.localStorage.setItem('sca_session', JSON.stringify(updatedSession))
        }
        
        const res = await api.get('/notifications/unreadCount')
        setUnread(res.data.total || 0)
      } catch {
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
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </BrowserRouter>
    </div>
  )
}

// My Clubs Dropdown Component
function MyClubsDropdown({ memberships }) {
  const [open, setOpen] = useState(false)
  
  if (memberships.length === 1) {
    // Single club - just show direct link
    return (
      <Link className="chip-link" to={`/ClubPage/${encodeURIComponent(memberships[0].clubName)}`}>
        My Club ({memberships[0].role})
      </Link>
    )
  }
  
  return (
    <div className="dropdown" onMouseLeave={() => setOpen(false)}>
      <button className="dropdown-toggle" onClick={() => setOpen(!open)}>
        My Clubs ({memberships.length}) ▾
      </button>
      {open && (
        <div className="dropdown-menu">
          {memberships.map(m => (
            <Link 
              key={m.clubName} 
              to={`/ClubPage/${encodeURIComponent(m.clubName)}`}
              onClick={() => setOpen(false)}
            >
              {m.clubName} <span className="role-badge">{m.role}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AppContent({ session, unread, handleLogout, darkMode, setDarkMode }) {
  const location = useLocation()
  const isAuthPage = ['/LogIn','/SignUp'].includes(location.pathname)

  return (
    <>
      {!isAuthPage && (
        <header className="top-nav">
          <div className="brand">School Club Activity</div>
          <button 
            className="theme-toggle" 
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/notifications">
              Notifications
              {unread > 0 && <span className="pill">{unread}</span>}
            </Link>
            {session?.isAdmin ? (
              // SA can create clubs with initial leader assignment
              <Link to="/CreateClub">Create Club</Link>
            ) : session?.memberships?.length > 0 ? (
              <MyClubsDropdown memberships={session.memberships} />
            ) : (
              <Link to="/CreateClub">Create Club</Link>
            )}
          </nav>
          <div className="nav-actions">
            {session ? (
              <>
                <span className="user-chip">{session.username} <span className="user-chip-info">({session.isAdmin ? 'SA' : session.memberships?.length ? `${session.memberships.length} club${session.memberships.length > 1 ? 's' : ''}` : 'Student'})</span></span>
                <button className="ghost" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <>
                <Link className="ghost" to="/LogIn">Login</Link>
                <Link className="ghost" to="/SignUp">Sign up</Link>
              </>
            )}
          </div>
        </header>
      )}
      <Routes>
        <Route path="/LogIn" element={<LogIn/>} />
        <Route path="/SignUp" element={<SignUp/>} />
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
