// Page showing all clubs and incoming events

import { React, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from "../api"
import BrowseClubs from "./BrowseClub.jsx";
import { getSession } from "../utils/auth";

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

const Home = () => {
    const session = getSession()
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [orderBy, setOrderBy] = useState("startDate")
    const [order, setOrder] = useState("asc")
    const [limit, setLimit] = useState(4)
    const [filterOpen, setFilterOpen] = useState(false)

    const { data: eventsData, isLoading, isError } = useQuery({
        queryKey: ['events', { search, orderBy, order, page, limit }],
        queryFn: () => api.get("/events", {
            params: { q: search, orderBy, order, page, limit }
        }).then(res => res.data),
        placeholderData: keepPreviousData
    })

    const events = eventsData?.data || eventsData || []
    const eventMeta = {
        page: eventsData?.page || 1,
        pages: eventsData?.pages || Math.max(1, Math.ceil((eventsData?.total || events.length) / limit)),
        total: eventsData?.total || events.length
    }

    useEffect(() => {
        setPage(1)
    }, [search, orderBy, order, limit])

    // Render clubs and events
    return (
        <div>
            <h1>Club List</h1>
            <div className="clubs">
                {<BrowseClubs />}
            </div>
            {!session?.club && (
                <div className="createClub">
                    <h4>No club interest you?</h4>
                    <button><Link to={"/CreateClub"}>Create Club</Link></button>
                </div>
            )}
            <h1>Incoming Events</h1>
            {isError && <div className="alert error">Unable to load events.</div>}
            <div className="top-bar">
                <input
                    type="text"
                    placeholder="Search events, descriptions or clubs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button onClick={() => setFilterOpen(!filterOpen)}>≡</button>
            </div>
            {filterOpen && (
                <div className="filter-panel event-filter">
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
            )}
            <div className="events">
                {isLoading && <p style={{ textAlign: "center", opacity: 0.6 }}>Loading events...</p>}
                {events.map((event) => (
                    <div className="event elevated" key={event.eventid}>
                        <div className="event-header">
                            <div>
                                <div className="eyebrow">Hosted by {event.clubName}</div>
                                <h2>{event.title}</h2>
                                <div className="event-meta">
                                    <span className="pill soft">Incoming</span>
                                    <span className="event-date">{formatDateRange(event.startDate, event.endDate)}</span>
                                </div>
                            </div>
                            <button className="btn-ghost btn-sm" type="button" onClick={() => downloadICS(event)}>
                                Add to calendar
                            </button>
                        </div>
                        <p className="event-description">{event.description}</p>
                        <div className="event-footer">
                            <div className="event-tag">Starts {new Date(event.startDate).toLocaleDateString('en-GB')}</div>
                            {event.endDate && <div className="event-tag neutral">Ends {new Date(event.endDate).toLocaleDateString('en-GB')}</div>}
                        </div>
                    </div>
                ))}
            </div>
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
                                onClick={() => setPage(page)}
                            >
                                {page}
                            </button>
                        )
                    );
                })()}
                <span className="pagination-meta">{eventMeta.total} results</span>
            </div>
        </div>
    )
}

export default Home
