import { React, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from "../api"
import { getSession } from "../utils/auth"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

const Notifications = () => {
  const session = getSession()
  const queryClient = useQueryClient()
  
  const [filters, setFilters] = useState({ search: "", orderBy: "created", order: "desc", page: 1, limit: 6, unread: 'all' })
  const [filterOpen, setFilterOpen] = useState(false)
  
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ recipient: "", message: "", sendToAllClub: false })
  const [recipientSearch, setRecipientSearch] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const isAdmin = useMemo(() => session && ['CL', 'VP'].includes(session.role), [session?.role])

  // 1. Fetch Notifications
  const { data: notificationsData, isLoading: loadingNotifications, error: notificationsError } = useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => {
        const params = {
            q: filters.search,
            orderBy: filters.orderBy,
            order: filters.order,
            limit: filters.limit,
            page: filters.page
        }
        if (filters.unread === 'unread') params.unread = true
        return api.get("/notifications", { params }).then(res => res.data)
    },
    placeholderData: keepPreviousData,
    enabled: !!session
  })

  const items = notificationsData?.data || notificationsData || []
  const meta = {
    page: notificationsData?.page || filters.page,
    pages: notificationsData?.pages || Math.max(1, Math.ceil((notificationsData?.total || items.length) / filters.limit)),
    total: notificationsData?.total || items.length
  }

  // 2. Fetch User Suggestions (for email)
  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['users', recipientSearch],
    queryFn: () => api.get("/allUsers", { params: { q: recipientSearch } }).then(res => res.data),
    enabled: !!recipientSearch && recipientSearch.length > 0,
    staleTime: 1000 * 60 // Cache for 1 minute
  })

  // Mutations
  const sendEmailMutation = useMutation({
    mutationFn: (data) => api.post("/sendEmail", data),
    onSuccess: () => {
        alert(emailForm.sendToAllClub ? "Email sent to all club members!" : "Email sent successfully!")
        setEmailForm({ recipient: "", message: "", sendToAllClub: false })
        setRecipientSearch("")
        setEmailFormOpen(false)
        queryClient.invalidateQueries(['notifications'])
    },
    onError: (err) => alert(err.response?.data?.message || "Failed to send email")
  })

  const markReadMutation = useMutation({
    mutationFn: ({ id, read }) => api.put(`/notifications/${id}/${read ? 'read' : 'unread'}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
      window.dispatchEvent(new Event('sca:unread-change'))
    }
  })

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
  }

  const handleRecipientChange = (value) => {
    setEmailForm({ ...emailForm, recipient: value })
    setRecipientSearch(value)
    setShowSuggestions(true)
  }

  const selectUser = (username) => {
    setEmailForm({ ...emailForm, recipient: username })
    setRecipientSearch("")
    setShowSuggestions(false)
  }

  const handleSendEmail = (e) => {
    e.preventDefault()
    if (!emailForm.message) return alert("Message is required")
    if (!emailForm.sendToAllClub && !emailForm.recipient) return alert("Please select a recipient or choose to send to all club members")
    
    sendEmailMutation.mutate(emailForm)
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
                {showSuggestions && userSuggestions.length > 0 && (
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
                    {userSuggestions.map(user => (
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
              <button type="submit" disabled={sendEmailMutation.isPending}>
                {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
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
        {loadingNotifications ? (
            <p style={{ textAlign: "center", opacity: 0.6 }}>Loading notifications...</p>
        ) : items.length === 0 ? (
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
                <button className="btn btn-sm" onClick={() => markReadMutation.mutate({ id: n.notificationid, read: true })}>Mark read</button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => markReadMutation.mutate({ id: n.notificationid, read: false })}>Mark unread</button>
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
