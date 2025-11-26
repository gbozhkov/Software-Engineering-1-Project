// Page showing all clubs and incoming events

import { React, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../api"
import BrowseClubs from "./BrowseClub.jsx";

const Home = () => {
    const [events, setEvents] = useState([])
    const [eventMeta, setEventMeta] = useState({ page: 1, pages: 1, total: 0 })
    const [search, setSearch] = useState("")
    const [orderBy, setOrderBy] = useState("startDate")
    const [order, setOrder] = useState("asc")
    const [limit, setLimit] = useState(4)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const fetchEvents = async (page = 1) => {
        setLoading(true)
        setError("")
        try {
            const res = await api.get("/events", {
                params: { q: search, orderBy, order, page, limit }
            })
            const data = res.data.data ? res.data.data : res.data
            setEvents(data)
            setEventMeta({
                page: res.data.page || 1,
                pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || data.length) / limit)),
                total: res.data.total || data.length
            })
        } catch (err) {
            console.error(err)
            setError("Unable to load events.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, orderBy, order, limit])

    // Render clubs and events
    return (
        <div>
            <h1>Club List</h1>
            <div className="clubs">
                {<BrowseClubs />}
            </div>
            <div className="createClub">
                <h4>No club interest you?</h4>
                <button><Link to={"/CreateClub"}>Create Club</Link></button>
            </div>
            <h1>Incoming Events</h1>
            {error && <div className="alert error">{error}</div>}
            <div className="filter-panel event-filter">
                <input
                    type="text"
                    placeholder="Search events, descriptions or clubs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <label>
                    Order by:
                    <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
                        <option value="startDate">Start date</option>
                        <option value="endDate">End date</option>
                        <option value="title">Title</option>
                        <option value="clubName">Club</option>
                    </select>
                </label>
                <label>
                    Direction:
                    <select value={order} onChange={(e) => setOrder(e.target.value)}>
                        <option value="asc">Asc</option>
                        <option value="desc">Desc</option>
                    </select>
                </label>
                <label>
                    Per page:
                    <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                        <option value={4}>4</option>
                        <option value={8}>8</option>
                        <option value={12}>12</option>
                    </select>
                </label>
            </div>
            <div className="events">
                {loading && <p style={{ textAlign: "center", opacity: 0.6 }}>Loading events...</p>}
                {events.map((event) => (
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
                    <p className="event-club">Hold by {event.clubName}</p>
                    <p className="event-description">{event.description}</p>
                    </div>
                ))}
            </div>
            <div className="pagination">
                {Array.from({ length: eventMeta.pages }, (_, i) => (
                    <button
                        key={i}
                        className={eventMeta.page === i + 1 ? "active" : ""}
                        onClick={() => fetchEvents(i + 1)}
                    >
                        {i + 1}
                    </button>
                ))}
                <span className="pagination-meta">{eventMeta.total} results</span>
            </div>
        </div>
    )
}

export default Home
