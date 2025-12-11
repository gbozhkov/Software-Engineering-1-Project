// Page to display specific club information

import { React, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import api from "../api"
import { getSession } from "../utils/auth"

const formatDateRange = (start, end) => {
    const s = new Date(start)
    const e = end ? new Date(end) : null
    const sameDay = e && s.toDateString() === e.toDateString()
    const fmt = (d) => `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    if (!e) return fmt(s)
    if (sameDay) return `${fmt(s)} - ${e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    return `${fmt(s)} - ${fmt(e)}`
}

const downloadICS = (event) => {
    const toICS = (date) => new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const start = toICS(event.startDate)
    const end = toICS(event.endDate || event.startDate)
    const uid = `${event.eventid || event.title}-${start}@school-club`
    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//School Club Activity//EN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${toICS(new Date())}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
        `LOCATION:${event.clubName || 'Club Event'}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.title || 'event'}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

const ClubPage = () => {
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const session = getSession()

    const [eventFilters, setEventFilters] = useState({ search: "", orderBy: "startDate", order: "asc", page: 1, limit: 5 })
    const [eventFilterOpen, setEventFilterOpen] = useState(false)
    
    const [commentFilters, setCommentFilters] = useState({ search: "", orderBy: "date", order: "desc", limit: 10 })
    
    const [newComment, setNewComment] = useState({ comment: "", rating: 0 })

    const isAdmin = useMemo(() => session && ['CL', 'VP'].includes(session.role) && session.club === clubName, [session, clubName])
    const isLeader = useMemo(() => session && session.role === 'CL' && session.club === clubName, [session, clubName])
    const isMember = useMemo(() => session && session.club === clubName && ['CL','VP','CM'].includes(session.role), [session, clubName])
    const isPending = useMemo(() => session && session.club === clubName && session.role === 'STU', [session, clubName])

    // 1. Fetch Club
    const { data: club, isLoading: loadingClub, error: clubError } = useQuery({
        queryKey: ['club', clubName],
        queryFn: () => api.get("/clubs/" + clubName).then(res => res.data?.[0] || null)
    })

    // 2. Fetch Members
    const { data: person = [], isLoading: loadingMembers, error: membersError } = useQuery({
        queryKey: ['members', clubName],
        queryFn: () => api.get("/person/" + clubName).then(res => res.data)
    })

    // 3. Fetch Events
    const { data: eventsData, isLoading: loadingEvents, error: eventsError } = useQuery({
        queryKey: ['events', clubName, eventFilters],
        queryFn: () => api.get("/events/" + clubName, { params: { q: eventFilters.search, ...eventFilters } }).then(res => res.data),
        placeholderData: keepPreviousData
    })

    const events = eventsData?.data || eventsData || []
    const eventMeta = {
        page: eventsData?.page || 1,
        pages: eventsData?.pages || Math.max(1, Math.ceil((eventsData?.total || events.length) / eventFilters.limit)),
        total: eventsData?.total || events.length
    }

    // 4. Fetch Comments (Infinite)
    const {
        data: commentsData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingComments,
        error: commentsError
    } = useInfiniteQuery({
        queryKey: ['comments', clubName, commentFilters],
        queryFn: ({ pageParam = 1 }) => api.get("/comments/" + clubName, { 
            params: { q: commentFilters.search, ...commentFilters, page: pageParam } 
        }).then(res => res.data),
        getNextPageParam: (lastPage) => {
            const current = lastPage.page || 1
            const totalPages = lastPage.pages || 1
            return current < totalPages ? current + 1 : undefined
        },
        initialPageParam: 1
    })

    const comments = commentsData?.pages.flatMap(page => page.data || page) || []
    const commentTotal = commentsData?.pages[0]?.total || comments.length

    // Mutations
    const joinClubMutation = useMutation({
        mutationFn: () => api.put(`/joinClubs/${clubName}`),
        onSuccess: () => {
            alert('Join request submitted! Please wait for approval.')
            queryClient.invalidateQueries(['members', clubName])
            queryClient.invalidateQueries(['club', clubName])
        },
        onError: (err) => alert(err.response?.data?.message || 'Failed to join club')
    })

    const cancelJoinMutation = useMutation({
        mutationFn: () => api.delete('/cancelJoinRequest'),
        onSuccess: () => {
            alert('Join request cancelled.')
            queryClient.invalidateQueries(['members', clubName])
            queryClient.invalidateQueries(['club', clubName])
        },
        onError: (err) => alert(err.response?.data?.message || 'Failed to cancel request')
    })

    const quitClubMutation = useMutation({
        mutationFn: () => api.delete("/quitClub"),
        onSuccess: () => {
            queryClient.invalidateQueries(['members', clubName])
            queryClient.invalidateQueries(['club', clubName])
            navigate("../")
        },
        onError: (err) => alert(err.response?.data?.message || "Unable to quit club")
    })

    const deleteClubMutation = useMutation({
        mutationFn: () => api.delete("/clubs/" + clubName),
        onSuccess: () => navigate("../../"),
        onError: (err) => alert(err.response?.data?.message || "Unable to delete club")
    })

    const memberActionMutation = useMutation({
        mutationFn: ({ url, method = 'put', body = {} }) => api[method](url, body),
        onSuccess: () => {
            queryClient.invalidateQueries(['members', clubName])
            queryClient.invalidateQueries(['club', clubName])
        },
        onError: (err) => alert(err.response?.data?.message || "Action failed")
    })

    const eventActionMutation = useMutation({
        mutationFn: ({ url, method }) => api[method](url),
        onSuccess: () => queryClient.invalidateQueries(['events', clubName]),
        onError: (err) => alert(err.response?.data?.message || "Action failed")
    })

    const commentActionMutation = useMutation({
        mutationFn: ({ url, method, body }) => api[method](url, body),
        onSuccess: () => queryClient.invalidateQueries(['comments', clubName]),
        onError: (err) => alert(err.response?.data?.message || "Action failed")
    })

    const updateEventFilter = (field, value) => {
        setEventFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
    }

    const updateCommentFilter = (field, value) => {
        setCommentFilters(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmitComment = (e) => {
        e.preventDefault()
        if (!newComment.comment.trim()) return alert("Comment cannot be empty")
        commentActionMutation.mutate({
            url: "/comment",
            method: "post",
            body: { comment: newComment.comment, rating: Number(newComment.rating), clubName }
        }, {
            onSuccess: () => setNewComment({ comment: "", rating: 0 })
        })
    }

    const acceptedEvents = useMemo(() => events.filter(e => e.accepted), [events])

    return (
        <div className="club-page">

            <main className="club-main">
            {loadingClub ? (
                <div className="card">Loading club...</div>
            ) : !club ? (
                <div className="card">{clubError?.message || 'Club not found.'}</div>
            ) : (
                <div className="club-header" key={club.clubName}>
                    <div 
                        className="club-page-banner" 
                        style={club.bannerImage 
                            ? { backgroundImage: `url(${club.bannerImage})` }
                            : { backgroundColor: club.bannerColor || '#38bdf8' }
                        }
                    ></div>
                    <div className="club-hero">
                        <div>
                            <p className="eyebrow">Club</p>
                            <h2>{club.clubName}</h2>
                            <p className="club-description" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(club.description) }}></p>
                            <div className="club-actions">
                                {isAdmin && <button><Link to={"/UpdateClub/" + clubName}>Update Info</Link></button>}
                                {!isMember && !isPending && !session?.club && (
                                    <button className="btn-primary" onClick={() => {
                                        if (!session) return navigate("/LogIn")
                                        joinClubMutation.mutate()
                                    }}>Join / Request</button>
                                )}
                                {isPending && (
                                    <>
                                        <button className="btn-muted" disabled>Request pending</button>
                                        <button className="deletebtn" onClick={() => {
                                            if (window.confirm('Cancel your join request?')) cancelJoinMutation.mutate()
                                        }}>Cancel Request</button>
                                    </>
                                )}
                                {isMember && (
                                    <button className="btn-muted" disabled>Already a member</button>
                                )}
                                {session?.club && !isMember && !isPending && (
                                    <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                                        {session?.role === 'STU' ? 'Pending elsewhere' : 'Already in a club'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="club-stats">
                            <div className="stat">
                                <span className="stat-label">Members</span>
                                <span className="stat-value">{club.memberCount} / {club.memberMax}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Upcoming events</span>
                                <span className="stat-value">{acceptedEvents.length}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Comments</span>
                                <span className="stat-value">{commentTotal}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="events">
                <h3 style={{margin: "0 0 0.5rem 0", fontSize: "1.35rem", color: "black"}}>Events:</h3>
                <div className="top-bar">
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={eventFilters.search}
                        onChange={(e) => updateEventFilter("search", e.target.value)}
                    />
                    <button onClick={() => setEventFilterOpen(!eventFilterOpen)}>≡</button>
                </div>

                {eventFilterOpen && (
                    <div className="filter-panel">
                        <label>
                            Order by:
                            <select value={eventFilters.orderBy} onChange={(e) => updateEventFilter("orderBy", e.target.value)}>
                                <option value="startDate">Start date</option>
                                <option value="endDate">End date</option>
                                <option value="title">Title</option>
                            </select>
                        </label>
                        <label>
                            Sort:
                            <select value={eventFilters.order} onChange={(e) => updateEventFilter("order", e.target.value)}>
                                <option value="asc">Asc</option>
                                <option value="desc">Desc</option>
                            </select>
                        </label>
                        <label>
                            Per page:
                            <select value={eventFilters.limit} onChange={(e) => updateEventFilter("limit", Number(e.target.value))}>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                            </select>
                        </label>
                    </div>
                )}
                {eventsError && <p className="alert error" style={{ marginTop: 0 }}>Unable to load events.</p>}
                {loadingEvents ? (
                    <p style={{ textAlign: "center", opacity: 0.6 }}>Loading events...</p>
                ) : events.length === 0 ? (
                    <div>
                        <p style={{ textAlign: "center", opacity: 0.6 }}>No events yet</p>
                    </div>
                ) : events.map((event) => (
                    <div className="event elevated" key={event.eventid}>
                        <div className="event-header">
                            <div>
                                <div className="event-meta">
                                    <span className={`pill soft ${event.accepted ? 'success' : 'warning'}`}>
                                        {event.accepted ? 'Accepted' : 'Pending approval'}
                                    </span>
                                    <span className="event-date">{formatDateRange(event.startDate, event.endDate)}</span>
                                </div>
                                <h2>{event.title}</h2>
                            </div>
                            {event.accepted && (
                                <button className="btn-ghost btn-sm" type="button" onClick={() => downloadICS(event)}>
                                    Add to calendar
                                </button>
                            )}
                        </div>
                        <p className="event-description">{event.description}</p>
                        <div className="event-footer">
                            <div className="event-tag">Starts {new Date(event.startDate).toLocaleDateString('en-GB')}</div>
                            {event.endDate && <div className="event-tag neutral">Ends {new Date(event.endDate).toLocaleDateString('en-GB')}</div>}
                        </div>
                        <div className="actions">
                            {!event.accepted && isLeader && (<button onClick={() => eventActionMutation.mutate({ url: "/event/" + event.eventid, method: "put" })}>Accept Event</button>)}
                            {isAdmin && (<button className="deletebtn" onClick={() => eventActionMutation.mutate({ url: "/event/" + event.eventid, method: "delete" })}>Delete Event</button>)}
                        </div>
                    </div>
                ))}
                {isAdmin && (
                    <div style={{marginTop: "0.5rem"}}>
                        <button><Link to={"/CreateEvent/" + clubName}>Create Event</Link></button>
                    </div>
                )}
                <div className="pagination">
                    {(() => {
                        const current = eventMeta.page;
                        const total = eventMeta.pages;
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
                                    onClick={() => updateEventFilter("page", page)}
                                >
                                    {page}
                                </button>
                            )
                        );
                    })()}
                    <span className="pagination-meta">{eventMeta.total} results</span>
                </div>
            </div>
            </main>

            <aside className="club-sidebar">
                <div className="members-card">
                    <div className="members-section">
                    <h3>Members:</h3>
                    {membersError && <p className="alert error">Unable to load members.</p>}
                    {loadingMembers ? <p style={{ opacity: 0.6 }}>Loading members...</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {person.filter((p) => p.role !== "STU").map((p) => (
                                <tr key={p.username}>
                                    <td style={{ fontWeight: p.username === session?.username ? 700 : 400 }}>{p.username}</td>
                                    <td style={{ fontWeight: p.username === session?.username ? 700 : 400 }}>{p.role}</td>
                                    <td>
                                        {isLeader && (
                                            <>
                                                {p.role === "CM" && (<button onClick={() => memberActionMutation.mutate({ url: "/promote/" + p.username, body: { action: 'promote' } })} title="Promote to VP">▲</button>)}
                                                {p.role === "VP" && (<button onClick={() => memberActionMutation.mutate({ url: "/promote/" + p.username, body: { action: 'demote' } })} title="Demote to member">▼</button>)}
                                            </>
                                        )}
                                        {isAdmin && p.role !== "CL" && p.username !== session?.username && (
                                            <button className="deletebtn" onClick={() => memberActionMutation.mutate({ url: "/expell/" + p.username })} style={{margin: "0 0 0 0.5rem"}}>X</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                    {isAdmin && (
                        <>
                            <h3>Pending:</h3>
                            {loadingMembers ? <p style={{ opacity: 0.6 }}>Loading pending...</p> : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th style={{ width: "94px" }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {person.filter((p) => p.role === "STU").length === 0 ? (
                                            <tr>
                                                <td colSpan="2" style={{ textAlign: "center", opacity: 0.6 }}>
                                                    No enrollment
                                                </td>
                                            </tr>
                                        ) : person.filter((p) => p.role === "STU").map((p) => (
                                        <tr key={p.username}>
                                            <td>{p.username}</td>
                                            <td>
                                                <button onClick={() => memberActionMutation.mutate({ url: "/accept/" + p.username })}>✓</button>
                                                <button onClick={() => memberActionMutation.mutate({ url: "/reject/" + p.username })} className="deletebtn" style={{margin: "0 0 0 0.5rem"}}>✖</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            )}
                        </>
                    )}
                </div>
                </div>
                <h3 style={{marginTop: "0.6rem"}}>Write a comment:</h3>
                
                {session && (
                    <form onSubmit={handleSubmitComment} style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
                        <textarea 
                            placeholder="Write your comment..." 
                            value={newComment.comment}
                            onChange={(e) => setNewComment(prev => ({ ...prev, comment: e.target.value }))}
                            style={{ width: "100%", maxWidth: "100%", minHeight: "80px", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", marginBottom: "0.5rem" }}
                            required
                        />
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                Rating:
                                <select 
                                    value={newComment.rating}
                                    onChange={(e) => setNewComment(prev => ({ ...prev, rating: e.target.value }))}
                                    style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", margin: 0 }}
                                >
                                    <option value={0}>None</option>
                                    <option value={1}>⭐ 1</option>
                                    <option value={2}>⭐ 2</option>
                                    <option value={3}>⭐ 3</option>
                                    <option value={4}>⭐ 4</option>
                                    <option value={5}>⭐ 5</option>
                                </select>
                            </label>
                            <button type="submit" disabled={commentActionMutation.isPending} style={{ marginLeft: "auto" }}>
                                {commentActionMutation.isPending ? "Posting..." : "Post Comment"}
                            </button>
                        </div>
                    </form>
                )}

                <h3 style={{marginTop: "0.6rem"}}>Comments:</h3>
                <div className="section-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
                        <input
                            type="text"
                            placeholder="Search comments/user"
                            value={commentFilters.search}
                            onChange={(e) => updateCommentFilter("search", e.target.value)}
                            style={{ maxWidth: "100%" }}
                        />
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <select value={commentFilters.orderBy} onChange={(e) => updateCommentFilter("orderBy", e.target.value)} style={{ flex: 1 }}>
                                <option value="date">Date</option>
                                <option value="rating">Rating</option>
                                <option value="username">Username</option>
                            </select>
                            <select value={commentFilters.order} onChange={(e) => updateCommentFilter("order", e.target.value)} style={{ flex: 1 }}>
                                <option value="desc">Newest</option>
                                <option value="asc">Oldest / Low</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="comments-list" style={{ maxHeight: "600px", overflowY: "auto" }}>
                    {commentsError && <p className="alert error">Unable to load comments.</p>}
                    {comments.length === 0 && !loadingComments ? (
                        <div>
                            <p style={{ textAlign: "center", opacity: 0.6 }}>No comments yet</p>
                        </div>
                    ) : comments.map((c) => (
                        <div className="comment" key={c.commentid}>
                            <div className="comment-header">
                                <div style={{fontWeight: c.username === session?.username ? 800 : 700, color: "#0f172a"}}>{c.username}</div>
                                <div className="comment-meta">{new Date(c.date).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                            </div>
                            <div className="comment-body">
                                {c.comment}
                            </div>
                            <div className="comment-footer">
                                {c.rating > 0 && (<div className="rating">⭐ {c.rating}/5</div>)}
                                <div style={{marginLeft: "auto"}}>
                                    {(isAdmin || c.username === session?.username) && (
                                        <button className="deletebtn" onClick={() => commentActionMutation.mutate({ url: "/comment/" + c.commentid, method: "delete" })}>Delete</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loadingComments && <p style={{ textAlign: "center", opacity: 0.6 }}>Loading comments...</p>}
                    {hasNextPage && !loadingComments && (
                        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ width: "100%", marginTop: "1rem" }}>
                            {isFetchingNextPage ? "Loading more..." : "Load More Comments"}
                        </button>
                    )}
                    {!hasNextPage && comments.length > 0 && (
                        <p style={{ textAlign: "center", opacity: 0.6, marginTop: "1rem" }}>No more comments</p>
                    )}
                </div>
            </aside>
            <div>
                <button><Link to={"../"}>Back</Link></button>
            </div>
            <div>
                {!isMember && !isPending && !session?.club && (
                    <button onClick={() => {
                        if (!session) return navigate("/LogIn")
                        joinClubMutation.mutate()
                    }}>Join Club</button>
                )}&nbsp;
                {isPending && (
                    <>
                        <button className="btn-muted" disabled>Request pending</button>&nbsp;
                        <button className="deletebtn" onClick={() => {
                            if (window.confirm('Cancel your join request?')) cancelJoinMutation.mutate()
                        }}>Cancel Request</button>
                    </>
                )}
                {isMember && !isLeader && <button className="deletebtn" onClick={() => {
                    if (window.confirm('Are you sure you want to quit this club?')) quitClubMutation.mutate()
                }}>Quit club</button>}
                {isLeader && <button className="deletebtn" onClick={() => {
                    if (window.confirm('Are you sure you want to delete this club?')) deleteClubMutation.mutate()
                }}>Delete Club</button>}
            </div>
        </div>
    )
}

export default ClubPage
