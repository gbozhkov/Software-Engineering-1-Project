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
    const [commentFilters, setCommentFilters] = useState({ search: "", orderBy: "date", order: "desc", page: 1, limit: 5 })
    const [eventMeta, setEventMeta] = useState({ page: 1, pages: 1, total: 0 })
    const [commentMeta, setCommentMeta] = useState({ page: 1, pages: 1, total: 0 })
    const session = getSession()
    const isAdmin = useMemo(() => session && ['CL', 'VP'].includes(session.role) && session.club === clubName, [session, clubName])
    const isLeader = useMemo(() => session && session.role === 'CL' && session.club === clubName, [session, clubName])

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

    const fetchComments = async (page = commentFilters.page) => {
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
            setComments(payload)
            setCommentMeta({
                page: res.data.page || page,
                pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || payload.length) / commentFilters.limit)),
                total: res.data.total || payload.length
            })
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
    useEffect(() => { fetchComments(commentFilters.page) }, [commentFilters.page, commentFilters.search, commentFilters.orderBy, commentFilters.order, commentFilters.limit])

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
            await api.put("/promote/" + username)
            await Promise.all([fetchMembers(), fetchClub()])
        } catch (err) {
            alert(err.response?.data?.message || "Unable to promote member")
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
                    <div className="club-hero">
                        <div>
                            <p className="eyebrow">Club</p>
                            <h2>{club.clubName}</h2>
                            <p className="club-description" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(club.description) }}></p>
                            <div className="club-actions">
                                {isAdmin && <button><Link to={"/UpdateClub/" + clubName}>Update Info</Link></button>}
                                <button className="ghost"><Link to={`/JoinClub/${clubName}`}>Join / Request</Link></button>
                                <button className="ghost"><Link to={`/Comment/${clubName}`}>Comment</Link></button>
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
                <div className="section-header">
                    <h3 style={{margin: "0 0 0.5rem 0"}}>Events:</h3>
                    <div className="inline-filters">
                        <input
                            type="text"
                            placeholder="Search title/description"
                            value={eventFilters.search}
                            onChange={(e) => updateEventFilter("search", e.target.value)}
                        />
                        <select value={eventFilters.orderBy} onChange={(e) => updateEventFilter("orderBy", e.target.value)}>
                            <option value="startDate">Start date</option>
                            <option value="endDate">End date</option>
                            <option value="title">Title</option>
                        </select>
                        <select value={eventFilters.order} onChange={(e) => updateEventFilter("order", e.target.value)}>
                            <option value="asc">Asc</option>
                            <option value="desc">Desc</option>
                        </select>
                        <select value={eventFilters.limit} onChange={(e) => updateEventFilter("limit", Number(e.target.value))}>
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                        </select>
                    </div>
                </div>
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
                            {!event.accepted && isAdmin && (<button onClick={() => handleAcceptEvent(event.eventid)}>Accept</button>)}
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
                    {Array.from({ length: eventMeta.pages }, (_, i) => (
                        <button
                            key={i}
                            className={eventMeta.page === i + 1 ? "active" : ""}
                            onClick={() => updateEventFilter("page", i + 1)}
                        >
                            {i + 1}
                        </button>
                    ))}
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
                                    <td>{p.username}</td>
                                    <td>{p.role}</td>
                                    <td>
                                        {isAdmin && (
                                            <>
                                                {p.role === "CM" && (<button onClick={() => handlePromote(p.username)}>▲</button>)}
                                                {p.role === "VP" && (<button onClick={() => handleAccept(p.username)}>▼</button>)}
                                                {p.role !== "CL" && (<button className="deletebtn" onClick={() => handleExpell(p.username)} style={{margin: "0 0 0 0.5rem"}}>X</button>)}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                    <h3>Pending:</h3>
                    {loadingMembers ? <p style={{ opacity: 0.6 }}>Loading pending...</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th></th>
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
                                        {isAdmin ? (
                                            <>
                                                <button onClick={() => handleAccept(p.username)}>✓</button>
                                                <button onClick={() => handleReject(p.username)} className="deletebtn" style={{margin: "0 0 0 0.5rem"}}>✖</button>
                                            </>
                                        ) : (
                                            <span style={{ opacity: 0.6 }}>Pending</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                </div>
                </div>
                <h3 style={{marginTop: "0.6rem"}}>Comments:</h3>
                <div className="section-header">
                    <div className="inline-filters">
                        <input
                            type="text"
                            placeholder="Search comments/user"
                            value={commentFilters.search}
                            onChange={(e) => updateCommentFilter("search", e.target.value)}
                        />
                        <select value={commentFilters.orderBy} onChange={(e) => updateCommentFilter("orderBy", e.target.value)}>
                            <option value="date">Date</option>
                            <option value="rating">Rating</option>
                            <option value="username">Username</option>
                        </select>
                        <select value={commentFilters.order} onChange={(e) => updateCommentFilter("order", e.target.value)}>
                            <option value="desc">Newest</option>
                            <option value="asc">Oldest / Low</option>
                        </select>
                        <select value={commentFilters.limit} onChange={(e) => updateCommentFilter("limit", Number(e.target.value))}>
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                            <option value={8}>8</option>
                        </select>
                    </div>
                </div>
                <div className="comments-list">
                    {commentsError && <p className="alert error">{commentsError}</p>}
                    {loadingComments ? (
                        <p style={{ opacity: 0.6 }}>Loading comments...</p>
                    ) : comments.length === 0 ? (
                        <div>
                            <p style={{ textAlign: "center", opacity: 0.6 }}>No comments yet</p>
                        </div>
                    ) : comments.map((c) => (
                        <div className="comment" key={c.commentid}>
                            <div className="comment-header">
                                <div style={{fontWeight: 700, color: "#0f172a"}}>{c.username}</div>
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
                    {session ? (
                        <button><Link to={"/Comment/" + clubName}>Comment</Link></button>
                    ) : (
                        <p style={{ textAlign: "center", opacity: 0.7 }}>Login to leave a comment.</p>
                    )}
                    <div className="pagination">
                        {Array.from({ length: commentMeta.pages }, (_, i) => (
                            <button
                                key={i}
                                className={commentMeta.page === i + 1 ? "active" : ""}
                                onClick={() => updateCommentFilter("page", i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <span className="pagination-meta">{commentMeta.total} results</span>
                    </div>
                </div>
            </aside>
            <div>
                <button><Link to={"../"}>Back</Link></button>&nbsp;
                {isLeader && <button className="deletebtn" onClick={() => handleDeleteClub(clubName)}>Delete Club</button>}
            </div>
            <div>
                <button><Link to={`/JoinClub/${clubName}`}>Join Club</Link></button>&nbsp;
                {session?.club === clubName && <button className="deletebtn" onClick={() => handleExpell(session.username)}>Quit club</button>}
            </div>
        </div>
    )
}

export default ClubPage
