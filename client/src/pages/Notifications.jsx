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
  
  const defoaltMailbox = session?.isAdmin ? 'report' : 'inbox'
  const [filters, setFilters] = useState({ search: "", groupBy: "created", order: "desc", page: 1, limit: 6, unread: 'all', mailbox: defoaltMailbox || 'inbox' })
  const [filterOpen, setFilterOpen] = useState(false)
  
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ recipient: "", message: "", sendToAllClub: false, sendReport: false, type: "email", link: "", linkToClub: false, targetClub: "" })
  const [recipientSearch, setRecipientSearch] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const [replyForm, setReplyForm] = useState({ notificationid: null, message: "" })
  const [showReplies, setShowReplies] = useState({})

  // SA has all admin powers
  const isSA = useMemo(() => session?.isAdmin === true, [session?.isAdmin])
  // User is admin if they are CL or VP of any club
  const isAdmin = useMemo(() => isSA || session?.memberships?.some(m => ['CL', 'VP'].includes(m.role)), [session?.memberships, isSA])

  // 1. Fetch Notifications
  const { data: notificationsData, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => {
        const params = {
            q: filters.search,
            groupBy: filters.groupBy,
            order: filters.order,
            limit: filters.limit,
            page: filters.page,
            mailbox: filters.mailbox
        }
        if (filters.unread === 'unread') params.unread = true
        return api.get("/notifications", { params }).then(res => res.data)
    },
    staleTime: 0,
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

  // 3. Fetch Clubs (for SA to select which club to send to)
  const { data: clubsList = [] } = useQuery({
    queryKey: ['clubs-list'],
    queryFn: () => api.get("/clubs").then(res => res.data),
    enabled: isSA,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  })

  // Mutations
  const sendEmailMutation = useMutation({
    mutationFn: (data) => api.post("/sendEmail", data),
    onSuccess: () => {
        const successMsg = emailForm.sendReport ? "Report sent to all admins!" : 
                          emailForm.sendToAllClub ? "Email sent to all club members!" : 
                          "Email sent successfully!"
        alert(successMsg)
        setEmailForm({ recipient: "", message: "", sendToAllClub: false, sendReport: false, type: "email", link: "", linkToClub: false, targetClub: "" })
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

  const replyMutation = useMutation({
    mutationFn: (data) => api.post("/replyEmail", data),
    onSuccess: () => {
      alert("Reply sent successfully!")
      setReplyForm({ notificationid: null, message: "" })
      queryClient.invalidateQueries(['notifications'])
    },
    onError: (err) => alert(err.response?.data?.message || "Failed to send reply")
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
    
    // Report mail validation
    if (emailForm.sendReport) {
      const emailData = {
        sendReport: true,
        message: emailForm.message,
        type: "report"
      }
      sendEmailMutation.mutate(emailData)
      return
    }
    
    if (!emailForm.sendToAllClub && !emailForm.recipient) return alert("Please select a recipient or choose to send to all club members")
    
    // Check if user needs to select a target club (SA or VP with multiple clubs)
    const adminClubs = session?.memberships?.filter(m => ['CL', 'VP'].includes(m.role)) || []
    const needsClubSelection = emailForm.sendToAllClub && (isSA || adminClubs.length > 1)
    if (needsClubSelection && !emailForm.targetClub) return alert("Please select a club to send to")
    
    // Prepare the data to send
    const emailData = {
      recipient: emailForm.recipient,
      message: emailForm.message,
      sendToAllClub: emailForm.sendToAllClub,
      type: emailForm.type,
      targetClub: emailForm.targetClub // For SA or VP to specify which club
    }
    
    // Add link if provided or if linking to club
    const userClubMembership = session?.memberships?.filter(m => ['CL', 'VP'].includes(m.role))
    const linkClub = emailForm.targetClub || userClubMembership?.clubName
    if (emailForm.linkToClub && linkClub) {
      emailData.link = `/ClubPage/${encodeURIComponent(linkClub)}`
    } else if (emailForm.link) {
      emailData.link = emailForm.link
    }
    
    sendEmailMutation.mutate(emailData)
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
        <select 
          value={filters.mailbox} 
          onChange={(e) => updateFilter("mailbox", e.target.value)}
        >
          {isSA && <option value="report">🚩 Report</option>}
          <option value="inbox">📥 Inbox</option>
          <option value="sent">📤 Sent</option>
          <option value="club">🏢 Club</option>
          <option value="conversation">💬 Conv</option>
          <option value="all">📬 All</option>
        </select>
        <button onClick={() => { setFilterOpen(!filterOpen); setEmailFormOpen(false); }}>≡</button>
        <button onClick={() => { setEmailFormOpen(!emailFormOpen); setFilterOpen(false); }}>✉</button>
      </div>

      {/* Email Form */}
      {emailFormOpen && (
        <div className="email-form">
          <h3>Send Email</h3>
          <form onSubmit={handleSendEmail}>
            {!isSA && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={emailForm.sendReport}
                    onChange={(e) => setEmailForm({ ...emailForm, sendReport: e.target.checked, sendToAllClub: false, recipient: "" })}
                  />
                  Send report to all admins
                </label>
              </div>
            )}
            
            {isAdmin && !emailForm.sendReport && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={emailForm.sendToAllClub}
                    onChange={(e) => setEmailForm({ ...emailForm, sendToAllClub: e.target.checked, sendReport: false, recipient: "" })}
                  />
                  Send to all club members
                </label>
              </div>
            )}
            
            {isAdmin && emailForm.sendToAllClub && !emailForm.sendReport && (
              <div>
                <label>Notification Type:</label>
                <select
                  value={emailForm.type}
                  onChange={(e) => setEmailForm({ ...emailForm, type: e.target.value })}
                >
                  <option value="email">Email</option>
                  <option value="event">Event</option>
                  <option value="membership">Membership</option>
                </select>
              </div>
            )}
            
            {/* SA or VP with multiple clubs needs to select which club to send to */}
            {emailForm.sendToAllClub && !emailForm.sendReport && (isSA || session?.memberships?.filter(m => ['CL', 'VP'].includes(m.role)).length > 1) && (
              <div>
                <label>Target Club:</label>
                <select
                  value={emailForm.targetClub}
                  onChange={(e) => setEmailForm({ ...emailForm, targetClub: e.target.value })}
                  required
                >
                  <option value="">Select a club...</option>
                  {isSA ? (
                    clubsList.map(club => (
                      <option key={club.clubName} value={club.clubName}>{club.clubName}</option>
                    ))
                  ) : (
                    session?.memberships?.filter(m => ['CL', 'VP'].includes(m.role)).map(m => (
                      <option key={m.clubName} value={m.clubName}>{m.clubName}</option>
                    ))
                  )}
                </select>
              </div>
            )}
            
            {!emailForm.sendToAllClub && !emailForm.sendReport && (
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
                  <div className="recipient-suggestions">
                    {userSuggestions.map(user => (
                      <div
                        key={user.username}
                        onClick={() => selectUser(user.username)}
                        className="suggestion-item"
                        onMouseEnter={(e) => e.target.style.backgroundColor = "#0ea5e9"}
                        onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                      >
                        {user.username}
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

            {isAdmin && session?.memberships?.some(m => ['CL', 'VP'].includes(m.role)) && !emailForm.sendReport && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={emailForm.linkToClub}
                    onChange={(e) => setEmailForm({ ...emailForm, linkToClub: e.target.checked, link: e.target.checked ? "" : emailForm.link })}
                  />
                  Link to club page
                </label>
              </div>
            )}

            {!emailForm.linkToClub && !emailForm.sendReport && (
              <div>
                <label>Link (optional):</label>
                <input
                  type="text"
                  value={emailForm.link}
                  onChange={(e) => setEmailForm({ ...emailForm, link: e.target.value })}
                  placeholder="External URL"
                />
              </div>
            )}

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
            Group by:
            <select value={filters.groupBy} onChange={(e) => updateFilter("groupBy", e.target.value)}>
              <option value="created">Date</option>
              <option value="type">Type</option>
              <option value="read">Read/Unread</option>
            </select>
          </label>
          <label>
            Order by:
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
        ) : items.map(n => {
          const isSent = n.senderUsername === session?.username
          // Person-to-person: has username (not club-wide) and has sender and is email type
          const isPersonToPerson = !!n.username && !!n.senderUsername && n.type === 'email'
          const isClubWide = !n.username && !!n.senderUsername
          const hasReplies = n.replies && n.replies.length > 0
          const isConversation = hasReplies || n.replyTo
          
          // For conversations, check if any message destined to current user is unread
          // For sent non-conversation messages, always consider as read
          const hasUnreadForUser = isConversation ? (
            // Check parent message if user is recipient
            (!isSent && !n.isRead) || 
            // Check if any reply destined to user is unread
            (hasReplies && n.replies.some(r => r.username === session?.username && !r.isRead))
          ) : (isSent ? false : !n.isRead)
          
          // Check if user has received any messages in this conversation
          const hasReceivedMessagesInConversation = isConversation ? (
            // User received the parent message
            !isSent ||
            // User received at least one reply
            (hasReplies && n.replies.some(r => r.username === session?.username))
          ) : !isSent
          
          return (
          <div key={n.notificationid} className={`notification-card ${(isSent || n.isRead) && !hasUnreadForUser ? 'read' : 'unread'}`}>
            <div className="notification-head">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isConversation ? (
                  <span className="badge badge-conversation" style={{ backgroundColor: '#ec4899', color: 'white' }}>
                    Conversation
                  </span>
                ) : (
                  <span className="badge" style={{ backgroundColor: isSent ? '#6366f1' : '#10b981', color: 'white' }}>
                    {isSent ? 'Sent' : 'Received'}
                  </span>
                )}
                <span className="badge" style={{ backgroundColor: hasUnreadForUser ? 'red' : undefined, color: hasUnreadForUser ? 'white' : undefined }}>{n.type}</span>
              </div>
              <span className="notification-date">{new Date(n.createdAt).toLocaleString('en-GB')}</span>
            </div>
            {n.senderUsername && !isSent && (
              <div className="notification-sender">From: {n.senderUsername} {isClubWide && n.clubName ? 'to all club members' : ''}</div>
            )}
            {isSent && isClubWide && (
              <div className="notification-sender">To: All {n.clubName ? `members in ${n.clubName}` : ' admins'}</div>
            )}
            {isSent && !isClubWide && n.username && (
              <div className="notification-sender">To: {n.username}</div>
            )}
            <div className="notification-body">
              {n.message}
            </div>
            
            {/* Display replies */}
            {hasReplies && (
              <div className="notification-replies">
                <button 
                  className="btn-ghost btn-sm" 
                  onClick={() => setShowReplies(prev => ({ ...prev, [n.notificationid]: !prev[n.notificationid] }))}
                  style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}
                >
                  {showReplies[n.notificationid] ? '▲' : '▼'} {n.replies.length} {n.replies.length === 1 ? 'reply' : 'replies'}
                </button>
                {showReplies[n.notificationid] && (
                  <div className="replies-list">
                    {n.replies.map(reply => (
                      <div key={reply.notificationid} className="reply-item">
                        <div className="reply-header">
                          <strong>{reply.senderUsername}</strong>
                          <span className="reply-date">{new Date(reply.createdAt).toLocaleString('en-GB')}</span>
                        </div>
                        <div className="reply-body">{reply.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Reply form */}
            {replyForm.notificationid === n.notificationid && (
              <div className="reply-form">
                <textarea
                  value={replyForm.message}
                  onChange={(e) => setReplyForm({ ...replyForm, message: e.target.value })}
                  placeholder="Write your reply..."
                  rows="3"
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => {
                      if (!replyForm.message.trim()) return alert("Reply cannot be empty")
                      replyMutation.mutate({ replyTo: n.notificationid, message: replyForm.message })
                    }}
                    disabled={replyMutation.isPending}
                  >
                    {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                  </button>
                  <button 
                    className="btn btn-sm btn-ghost" 
                    onClick={() => setReplyForm({ notificationid: null, message: "" })}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            <div className="notification-actions">
              {n.link && <Link className="btn btn-sm" to={n.link}>Open</Link>}
              {isPersonToPerson && replyForm.notificationid !== n.notificationid && (
                <button 
                  className="btn btn-sm" 
                  onClick={() => setReplyForm({ notificationid: n.notificationid, message: "" })}
                >
                  Reply
                </button>
              )}
              {((n.username && hasReceivedMessagesInConversation) || (isClubWide && !isSent)) && (
                hasUnreadForUser ? (
                  <button className="btn btn-sm" onClick={() => markReadMutation.mutate({ id: n.notificationid, read: true })}>Mark read</button>
                ) : (
                  <button className="btn btn-sm btn-ghost" onClick={() => markReadMutation.mutate({ id: n.notificationid, read: false })}>Mark unread</button>
                )
              )}
            </div>
          </div>
        )})}
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
