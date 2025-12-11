import { React, useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import api from "../api"
import { getSession } from "../utils/auth"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

const Notifications = () => {
  const session = getSession()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [filters, setFilters] = useState({ search: "", orderBy: "created", order: "desc", page: 1, limit: 6 })
  const [filterOpen, setFilterOpen] = useState(false)
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ recipient: "", message: "", sendToAllClub: false })
  const [clubMembers, setClubMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAdmin = useMemo(() => session && ['CL', 'VP'].includes(session.role), [session?.role])

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
  }

  const fetchNotifications = async (page = filters.page) => {
    if (!session) return
    try {
      const params = {
        q: filters.search,
        orderBy: filters.orderBy,
        order: filters.order,
        limit: filters.limit,
        page
      }
      if (filters.unread === 'unread') {
        params.unread = true
      }
      const res = await api.get("/notifications", { params })
      const payload = res.data.data ? res.data.data : res.data
      setItems(payload)
      setMeta({
        page: res.data.page || page,
        pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || payload.length) / filters.limit)),
        total: res.data.total || payload.length
      })
    } catch (err) {
      console.error(err)
      alert("Unable to load notifications")
    }
  }

  useEffect(() => { fetchNotifications(filters.page) }, [filters])

  useEffect(() => {
    if (session?.club) {
      fetchClubMembers()
    }
  }, [session?.club])

  const fetchClubMembers = async () => {
    try {
      const res = await api.get("/clubMembers")
      setClubMembers(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchUserSuggestions = async (search) => {
    if (!search || search.length < 1) {
      setAllUsers([])
      return
    }
    try {
      const res = await api.get("/allUsers", { params: { q: search } })
      setAllUsers(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRecipientChange = (value) => {
    setEmailForm({ ...emailForm, recipient: value })
    fetchUserSuggestions(value)
    setShowSuggestions(true)
  }

  const selectUser = (username) => {
    setEmailForm({ ...emailForm, recipient: username })
    setShowSuggestions(false)
    setAllUsers([])
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!emailForm.message) {
      alert("Message is required")
      return
    }
    if (!emailForm.sendToAllClub && !emailForm.recipient) {
      alert("Please select a recipient or choose to send to all club members")
      return
    }

    setIsSubmitting(true)
    try {
      await api.post("/sendEmail", emailForm)
      alert(emailForm.sendToAllClub ? "Email sent to all club members!" : "Email sent successfully!")
      setEmailForm({ recipient: "", message: "", sendToAllClub: false })
      setEmailFormOpen(false)
      fetchNotifications(filters.page)
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.message || "Failed to send email")
    } finally {
      setIsSubmitting(false)
    }
  }

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      fetchNotifications(meta.page)
    } catch (err) {
      console.error(err)
      alert("Unable to mark notification")
    }
  }

  const markUnread = async (id) => {
    try {
      await api.put(`/notifications/${id}/unread`)
      fetchNotifications(meta.page)
    } catch (err) {
      console.error(err)
      alert("Unable to update notification")
    }
  }

  if (!session) return <p style={{ textAlign: "center" }}>Login to view notifications.</p>

  return (
    <div className="notifications-page">
      {/* Top bar */}
      <div className="top-bar">
        <input
          type="text"
          placeholder="Search notifications..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
        <button onClick={() => setFilterOpen(!filterOpen)}>≡</button>
        <button onClick={() => setEmailFormOpen(!emailFormOpen)}>✉</button>
      </div>

      {/* Email Form */}
      {emailFormOpen && (
        <div className="email-form">
          <h3>Send Email</h3>
          <form onSubmit={handleSendEmail}>
            {isAdmin && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={emailForm.sendToAllClub}
                    onChange={(e) => setEmailForm({ ...emailForm, sendToAllClub: e.target.checked, recipient: "" })}
                  />
                  Send to all club members
                </label>
              </div>
            )}
            
            {!emailForm.sendToAllClub && (
              <div style={{ position: 'relative' }}>
                <label>Recipient:</label>
                <input
                  type="text"
                  value={emailForm.recipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  onFocus={() => emailForm.recipient && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Type username..."
                  required={!emailForm.sendToAllClub}
                  autoComplete="off"
                />
                {showSuggestions && allUsers.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {allUsers.map(user => (
                      <div
                        key={user.username}
                        onClick={() => selectUser(user.username)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                      >
                        {user.username} ({user.role}{user.club ? ` - ${user.club}` : ''})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label>Message:</label>
              <textarea
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                placeholder="Write your message..."
                rows="5"
                required
              />
            </div>

            <div className="email-form-buttons">
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Email"}
              </button>
              <button type="button" onClick={() => setEmailFormOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter panel */}
      {filterOpen && (
        <div className="filter-panel">
          <label>
            Order by:
            <select value={filters.orderBy} onChange={(e) => updateFilter("orderBy", e.target.value)}>
              <option value="created">Date</option>
              <option value="type">Type</option>
              <option value="read">Read/Unread</option>
            </select>
          </label>
          <label>
            Sort:
            <select value={filters.order} onChange={(e) => updateFilter("order", e.target.value)}>
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </label>
          <label>
            Show:
            <select value={filters.unread || 'all'} onChange={(e) => updateFilter("unread", e.target.value === 'all' ? undefined : e.target.value)}>
              <option value="all">All</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
          <label>
            Per page:
            <select value={filters.limit} onChange={(e) => updateFilter("limit", Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </label>
        </div>
      )}

      <div className="notifications-list">
        {items.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>No notifications.</p>
        ) : items.map(n => (
          <div key={n.notificationid} className={`notification-card ${n.isRead ? 'read' : 'unread'}`}>
            <div className="notification-head">
              <span className="badge" style={{ backgroundColor: n.isRead ? undefined : 'red', color: n.isRead ? undefined : 'white' }}>{n.type}</span>
              <span className="notification-date">{new Date(n.createdAt).toLocaleString('en-GB')}</span>
            </div>
            {n.senderUsername && (
              <div className="notification-sender">From: {n.senderUsername}</div>
            )}
            <div className="notification-body">
              {n.message}
            </div>
            <div className="notification-actions">
              {n.link && <Link className="btn btn-sm" to={n.link}>Open</Link>}
              {!n.isRead ? (
                <button className="btn btn-sm" onClick={() => markRead(n.notificationid)}>Mark read</button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => markUnread(n.notificationid)}>Mark unread</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pagination">
        {(() => {
          const current = meta.page;
          const total = meta.pages;
          const pages = [];
          
          if (total <= 5) {
            for (let i = 1; i <= total; i++) pages.push(i);
          } else {
            pages.push(1);
            if (current > 3) pages.push('...');
            for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
              if (!pages.includes(i)) pages.push(i);
            }
            if (current < total - 2) pages.push('...');
            if (!pages.includes(total)) pages.push(total);
          }
          
          return pages.map((page, idx) => 
            page === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 0.5rem' }}>...</span>
            ) : (
              <button
                key={page}
                className={current === page ? "active" : ""}
                onClick={() => updateFilter("page", page)}
              >
                {page}
              </button>
            )
          );
        })()}
        <span className="pagination-meta">{meta.total} results</span>
      </div>
    </div>
  )
}

export default Notifications
