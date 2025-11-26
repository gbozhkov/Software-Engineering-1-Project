import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

import './App.css';
import Home from './pages/Home.jsx';
import LogIn from './pages/LogIn.jsx';
import CreateClub from './pages/CreateClub.jsx';
import ClubPage from './pages/ClubPage.jsx';
import JoinClub from './pages/JoinClub.jsx';
import Comment from './pages/Comment.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import UpdateClub from './pages/UpdateClub.jsx';
import Notifications from './pages/Notifications.jsx';
import api from './api';
import { clearSession, getSession } from './utils/auth';

// ---> UPDATE: ClubPage/:clubName->:clubName ; Comment/:clubName-> :clubName/Comment ... <---

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
        const res = await api.get('/notifications/unreadCount')
        setUnread(res.data.total || 0)
      } catch {
        /* ignore */
      }
    }

    sync()
    const interval = setInterval(sync, 8000)
    const onStorage = () => sync()
    const onSessionChange = () => sync()
    window.addEventListener('storage', onStorage)
    window.addEventListener('sca:session-change', onSessionChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('sca:session-change', onSessionChange)
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
        <header className="top-nav">
          <div className="brand">School Club Activity</div>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/notifications">
              Notifications
              {unread > 0 && <span className="pill">{unread}</span>}
            </Link>
            <Link to="/CreateClub">Create Club</Link>
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
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/LogIn" element={<LogIn/>} />
          <Route path="/CreateClub" element={<CreateClub/>} />
          <Route path="/ClubPage/:clubName" element={<ClubPage/>} />
          <Route path="/JoinClub/:clubName" element={<JoinClub/>} />
          <Route path="/Comment/:clubName" element={<Comment/>} />
          <Route path="/CreateEvent/:clubName" element={<CreateEvent/>} />
          <Route path="/UpdateClub/:clubName" element={<UpdateClub/>} />
          <Route path="/notifications" element={<Notifications/>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
