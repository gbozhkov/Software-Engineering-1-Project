// Page to display specific club information

import { React, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import DOMPurify from 'dompurify'
import api from "../api"
import { getSession } from "../utils/auth"

const ClubPage = () => {
    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    // State to hold clubs and events data
    const [club, setClub] = useState(null)
    const [events, setEvents] = useState([])
    const [person, setPerson] = useState([])
    const [comments, setComments] = useState([])
    const [loadingClub, setLoadingClub] = useState(true)
    const [loadingEvents, setLoadingEvents] = useState(true)
    const [loadingMembers, setLoadingMembers] = useState(true)
    const [loadingComments, setLoadingComments] = useState(true)
    const [error, setError] = useState("")
    const [eventsError, setEventsError] = useState("")
    const [membersError, setMembersError] = useState("")
    const [commentsError, setCommentsError] = useState("")
    const [eventFilters, setEventFilters] = useState({ search: "", orderBy: "startDate", order: "asc", page: 1, limit: 5 })
    const [eventFilterOpen, setEventFilterOpen] = useState(false)
    const [commentFilters, setCommentFilters] = useState({ search: "", orderBy: "date", order: "desc", page: 1, limit: 10 })
    const [eventMeta, setEventMeta] = useState({ page: 1, pages: 1, total: 0 })
    const [commentMeta, setCommentMeta] = useState({ page: 1, pages: 1, total: 0 })
    const [hasMoreComments, setHasMoreComments] = useState(true)
    const [newComment, setNewComment] = useState({ comment: "", rating: 0 })
    const [isSubmittingComment, setIsSubmittingComment] = useState(false)
    const session = getSession()
    const isAdmin = useMemo(() => session && ['CL', 'VP'].includes(session.role) && session.club === clubName, [session, clubName])
    const isLeader = useMemo(() => session && session.role === 'CL' && session.club === clubName, [session, clubName])
    const isMember = useMemo(() => session && session.club === clubName && ['CL','VP','CM'].includes(session.role), [session, clubName])
    const isPending = useMemo(() => session && session.club === clubName && session.role === 'STU', [session, clubName])

    // Navigation hook to return to home page after creation
    const navigate = useNavigate()

    const fetchClub = async () => {
        setLoadingClub(true)
        setError("")
        try {
            const res = await api.get("/clubs/" + clubName)
            setClub(res.data?.[0] || null)
        } catch (err) {
            console.error(err)
            setError("Unable to load club.")
        } finally {
            setLoadingClub(false)
        }
    }

    const fetchEvents = async (page = eventFilters.page) => {
        setLoadingEvents(true)
        setEventsError("")
        try {
            const res = await api.get("/events/" + clubName, {
                params: {
                    q: eventFilters.search,
                    orderBy: eventFilters.orderBy,
                    order: eventFilters.order,
                    limit: eventFilters.limit,
                    page
                }
            })
            const payload = res.data.data ? res.data.data : res.data
            setEvents(payload)
            setEventMeta({
                page: res.data.page || page,
                pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || payload.length) / eventFilters.limit)),
                total: res.data.total || payload.length
            })
        } catch (err) {
            console.error(err)
            setEventsError("Unable to load events.")
        } finally {
            setLoadingEvents(false)
        }
    }

    const fetchMembers = async () => {
        setLoadingMembers(true)
        setMembersError("")
        try {
            const res = await api.get("/person/" + clubName)
            setPerson(res.data)
        } catch (err) {
            console.error(err)
            setMembersError("Unable to load members.")
        } finally {
            setLoadingMembers(false)
        }
    }

    const fetchComments = async (page = commentFilters.page, append = false) => {
        setLoadingComments(true)
        setCommentsError("")
        try {
            const res = await api.get("/comments/" + clubName, {
                params: {
                    q: commentFilters.search,
                    orderBy: commentFilters.orderBy,
                    order: commentFilters.order,
                    limit: commentFilters.limit,
                    page
                }
            })
            const payload = res.data.data ? res.data.data : res.data
            if (append) {
                setComments(prev => [...prev, ...payload])
            } else {
                setComments(payload)
            }
            const meta = {
                page: res.data.page || page,
                pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || payload.length) / commentFilters.limit)),
                total: res.data.total || payload.length
            }
            setCommentMeta(meta)
            setHasMoreComments(meta.page < meta.pages)
        } catch (err) {
            console.error(err)
            setCommentsError("Unable to load comments.")
        } finally {
            setLoadingComments(false)
        }
    }

    const updateEventFilter = (field, value) => {
        setEventFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
    }

    const updateCommentFilter = (field, value) => {
        setCommentFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
    }

    useEffect(() => { fetchClub(); fetchMembers() }, [])
    useEffect(() => { fetchEvents(eventFilters.page) }, [eventFilters.page, eventFilters.search, eventFilters.orderBy, eventFilters.order, eventFilters.limit])
    useEffect(() => { 
        setComments([]) // Reset comments when filters change
        setCommentFilters(prev => ({ ...prev, page: 1 }))
        fetchComments(1, false) 
    }, [commentFilters.search, commentFilters.orderBy, commentFilters.order])

    const handleAccept = async (username) => {
        if (!isAdmin) return alert("You must be a CL/VP of this club.")
        try {
            await api.put("/accept/" + username)
            await Promise.all([fetchMembers(), fetchClub()])
        } catch (err) {
            alert(err.response?.data?.message || "Unable to accept member")
        }
    }

    const handleReject = async (username) => {
        if (!isAdmin) return alert("You must be a CL/VP of this club.")
        try {
            await api.put("/reject/" + username)
            await Promise.all([fetchMembers(), fetchClub()])
        } catch (err) {
            alert(err.response?.data?.message || "Unable to reject member")
        }
    }

    const handlePromote = async (username) => {
        if (!isLeader) return alert("Only CL can promote.")
        try {
            await api.put("/promote/" + username, { action: 'promote' })
            await Promise.all([fetchMembers(), fetchClub()])
        } catch (err) {
            alert(err.response?.data?.message || "Unable to promote member")
        }
    }

    const handleDemote = async (username) => {
        if (!isLeader) return alert("Only CL can demote.")
        try {
            await api.put("/promote/" + username, { action: 'demote' })
            await Promise.all([fetchMembers(), fetchClub()])
        } catch (err) {
            alert(err.response?.data?.message || "Unable to demote member")
        }
    }

    const handleExpell = async (username) => {
        if (!isAdmin && username !== session?.username) return alert("Not allowed to remove this member.")
        try {
            await api.put("/expell/" + username)
            await Promise.all([fetchMembers(), fetchClub()])
            if (username === session?.username) navigate("../")
        } catch (err) {
            alert(err.response?.data?.message || "Unable to remove member")
        }
    }

    const handleDeleteEvent = async (eventid) => {
        if (!isAdmin) return alert("You must be a CL/VP of this club.")
        try {
            await api.delete("/event/" + eventid)
            await fetchEvents(eventFilters.page)
        } catch (err) {
            alert(err.response?.data?.message || "Unable to delete event")
        }
    }

    const handleAcceptEvent = async (eventid) => {
        if (!isAdmin) return alert("You must be a CL/VP of this club.")
        try {
            await api.put("/event/" + eventid)
            await fetchEvents(eventFilters.page)
        } catch (err) {
            alert(err.response?.data?.message || "Unable to accept event")
        }
    }

    const handleDeleteComment = async (commentid) => {
        try {
            await api.delete("/comment/" + commentid)
            await fetchComments(commentFilters.page)
        } catch (err) {
            alert(err.response?.data?.message || "Unable to delete comment")
        }
    }

    const handleDeleteClub = async (clubName) => {
        if (!isLeader) return alert("Only the club leader can delete the club.")
        try {
            await api.delete("/clubs/" + clubName)
            navigate("../../")
        } catch (err) {
            alert(err.response?.data?.message || "Unable to delete club")
        }
    }

    const handleSubmitComment = async (e) => {
        e.preventDefault()
        if (!newComment.comment.trim()) return alert("Comment cannot be empty")
        setIsSubmittingComment(true)
        try {
            await api.post("/comment", { 
                comment: newComment.comment, 
                rating: Number(newComment.rating), 
                clubName 
            })
            setNewComment({ comment: "", rating: 0 })
            setComments([]) // Reset to reload from beginning
            await fetchComments(1, false)
        } catch (err) {
            alert(err.response?.data?.message || "Unable to add comment")
        } finally {
            setIsSubmittingComment(false)
        }
    }

    const loadMoreComments = () => {
        if (!loadingComments && hasMoreComments) {
            const nextPage = commentMeta.page + 1
            setCommentFilters(prev => ({ ...prev, page: nextPage }))
            fetchComments(nextPage, true)
        }
    }

    const acceptedEvents = useMemo(() => events.filter(e => e.accepted), [events])

    // Render club information
    return (
        <div className="club-page">

            <main className="club-main">
            {loadingClub ? (
                <div className="card">Loading club...</div>
            ) : !club ? (
                <div className="card">{error || 'Club not found.'}</div>
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
                                    <button className="btn-primary" onClick={async () => {
                                        if (!session) return navigate("/LogIn")
                                        try {
                                            await api.put(`/joinClubs/${clubName}`);
                                            alert('Join request submitted! Please wait for approval.');
                                            await Promise.all([fetchMembers(), fetchClub()]);
                                        } catch (err) {
                                            alert(err.response?.data?.message || 'Failed to join club');
                                        }
                                    }}>Join / Request</button>
                                )}
                                {isPending && (
                                    <>
                                        <button className="btn-muted" disabled>Request pending</button>
                                        <button className="deletebtn" onClick={async () => {
                                            if (window.confirm('Cancel your join request?')) {
                                                try {
                                                    await api.delete('/cancelJoinRequest');
                                                    alert('Join request cancelled.');
                                                    await Promise.all([fetchMembers(), fetchClub()]);
                                                } catch (err) {
                                                    alert(err.response?.data?.message || 'Failed to cancel request');
                                                }
                                            }
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
                                <span className="stat-value">{commentMeta.total}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="events">
                <h3 style={{margin: "0 0 0.5rem 0"}}>Events:</h3>
                {/* Top bar */}
                <div className="top-bar">
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={eventFilters.search}
                        onChange={(e) => updateEventFilter("search", e.target.value)}
                    />
                    <button onClick={() => setEventFilterOpen(!eventFilterOpen)}>≡</button>
                </div>

                {/* Filter panel */}
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
                {eventsError && <p className="alert error" style={{ marginTop: 0 }}>{eventsError}</p>}
                {loadingEvents ? (
                    <p style={{ textAlign: "center", opacity: 0.6 }}>Loading events...</p>
                ) : events.length === 0 ? (
                    <div>
                        <p style={{ textAlign: "center", opacity: 0.6 }}>No events yet</p>
                    </div>
                ) : events.map((event) => (
                    <div className="event" key={event.eventid}>
                        <div className="event-header">
                            <h2>{event.title}</h2>
                            <span className="event-date">
                                {((s,e)=>!e
                                    ? `${s.toLocaleDateString('en-GB')} ${s.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}`
                                    : s.toDateString() === e.toDateString()
                                        ? `${s.toLocaleDateString('en-GB')} ${s.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})} - ${e.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}`
                                        : `${s.toLocaleDateString('en-GB')} ${s.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})} - ${e.toLocaleDateString('en-GB')} ${e.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}`
                                    )(new Date(event.startDate), event.endDate ? new Date(event.endDate) : null
                        )}
                            </span>
                        </div>
                        <p className="event-description">{event.description}</p>
                        <div className="actions">
                            {!event.accepted && isLeader && (<button onClick={() => handleAcceptEvent(event.eventid)}>Accept Event</button>)}
                            {isAdmin && (<button className="deletebtn" onClick={() => handleDeleteEvent(event.eventid)}>Delete Event</button>)}
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
                    {membersError && <p className="alert error">{membersError}</p>}
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
                                                {p.role === "CM" && (<button onClick={() => handlePromote(p.username)} title="Promote to VP">▲</button>)}
                                                {p.role === "VP" && (<button onClick={() => handleDemote(p.username)} title="Demote to member">▼</button>)}
                                            </>
                                        )}
                                        {isAdmin && p.role !== "CL" && p.username !== session?.username && (
                                            <button className="deletebtn" onClick={() => handleExpell(p.username)} style={{margin: "0 0 0 0.5rem"}}>X</button>
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
                                                <button onClick={() => handleAccept(p.username)}>✓</button>
                                                <button onClick={() => handleReject(p.username)} className="deletebtn" style={{margin: "0 0 0 0.5rem"}}>✖</button>
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
                <h3 style={{marginTop: "0.6rem"}}>Comments:</h3>
                
                {/* Inline comment form */}
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
                            <button type="submit" disabled={isSubmittingComment} style={{ marginLeft: "auto" }}>
                                {isSubmittingComment ? "Posting..." : "Post Comment"}
                            </button>
                        </div>
                    </form>
                )}

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
                    {commentsError && <p className="alert error">{commentsError}</p>}
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
                                        <button className="deletebtn" onClick={() => handleDeleteComment(c.commentid)}>Delete</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loadingComments && <p style={{ textAlign: "center", opacity: 0.6 }}>Loading comments...</p>}
                    {hasMoreComments && !loadingComments && comments.length > 0 && (
                        <button onClick={loadMoreComments} style={{ width: "100%", marginTop: "1rem" }}>
                            Load More Comments
                        </button>
                    )}
                    {!hasMoreComments && comments.length > 0 && (
                        <p style={{ textAlign: "center", opacity: 0.6, marginTop: "1rem" }}>No more comments</p>
                    )}
                </div>
            </aside>
            <div>
                <button><Link to={"../"}>Back</Link></button>
            </div>
            <div>
                {!isMember && !isPending && !session?.club && (
                    <button onClick={async () => {
                        try {
                            await api.put(`/joinClubs/${clubName}`);
                            alert('Join request submitted! Please wait for approval.');
                            await Promise.all([fetchMembers(), fetchClub()]);
                        } catch (err) {
                            alert(err.response?.data?.message || 'Failed to join club');
                        }
                    }}>Join Club</button>
                )}&nbsp;
                {isPending && (
                    <>
                        <button className="btn-muted" disabled>Request pending</button>&nbsp;
                        <button className="deletebtn" onClick={async () => {
                            if (window.confirm('Cancel your join request?')) {
                                try {
                                    await api.delete('/cancelJoinRequest');
                                    alert('Join request cancelled.');
                                    await Promise.all([fetchMembers(), fetchClub()]);
                                } catch (err) {
                                    alert(err.response?.data?.message || 'Failed to cancel request');
                                }
                            }
                        }}>Cancel Request</button>
                    </>
                )}
                {isMember && !isLeader && <button className="deletebtn" onClick={() => handleExpell(session.username)}>Quit club</button>}
                {isLeader && <button className="deletebtn" onClick={() => handleDeleteClub(clubName)}>Delete Club</button>}
            </div>
        </div>
    )
}

export default ClubPage
