// Page to display specific club information

import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link, useLocation } from "react-router-dom"

const ClubPage = () => {
    // State to hold clubs and events data
    const [clubs, setClubs] = useState([])
    const [events, setEvents] = useState([])
    const [person, setPerson] = useState([])
    const [comments, setComments] = useState([])

    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    // Fetch clubs data from backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/clubs/" + clubName)
                setClubs(res.data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    // Fetch clubs data from backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/events/" + clubName)
                setEvents(res.data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    // Fetch clubs data from backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/person/" + clubName)
                setPerson(res.data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    // Fetch clubs data from backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/comments/" + clubName)
                setComments(res.data)   
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    const handleAccept = async (username) => {
        try {
            await axios.put("http://localhost:3000/accept/" + username)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    const handlePromote = async (username) => {
        try {
            await axios.put("http://localhost:3000/promote/" + username)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    const handleExpell = async (username) => {
        try {
            await axios.put("http://localhost:3000/expell/" + username)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDelateEvent = async (eventid) => {
        try {
            await axios.delete("http://localhost:3000/event/" + eventid)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDeleteComment = async (commentid) => {
        try {
            await axios.delete("http://localhost:3000/comment/" + commentid)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    // Render club information
    return (
        <div className="club-page">

            <main className="club-main">
            {clubs.map((club) => (
                <div className="club-header" key={club.clubName}>
                <h2>{club.clubName}</h2>
                <p>{club.description}</p>
                </div>
            ))}
            <button><Link to={"/UpdateClub/" + clubName}>Update Info</Link></button>
            <div className="events">
                <h3 style={{margin: "0 0 0.5rem 0"}}>Events:</h3>
                {events.map((event) => (
                <div className="event" key={event.eventid}>
                    <div className="event-header">
                    <h2>{event.title}</h2>
                    <span className="event-date">{new Date(event.date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <p className="event-description">{event.description}</p>
                    <div className="actions">
                    <button className="deletebtn" onClick={() => handleDelateEvent(event.eventid)}>Delete Event</button>
                    </div>
                </div>
                ))}
                <div style={{marginTop: "0.5rem"}}>
                <button><Link to={"/CreateEvent/" + clubName}>Create Event</Link></button>
                </div>
            </div>
            </main>

            <aside className="club-sidebar">
                <div className="members-card">
                    <div className="members-section">
                    <h3>Members:</h3>
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
                                    <td><button className="deletebtn" onClick={() => handleExpell(p.username)}>Expell</button>
                                    {p.role === "CM" && (<button onClick={() => handlePromote(p.username)} style={{margin: "0 0 0 0.5rem"}}>Promote</button>)}
                                    {p.role === "VP" && (<button onClick={() => handleAccept(p.username)} style={{margin: "0 0 0 0.5rem"}}>Depromote</button>)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <h3>Pending:</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {person.filter((p) => p.role === "STU").map((p) => (
                                <tr key={p.username}>
                                    <td>{p.username}</td>
                                    <td><button onClick={() => handleAccept(p.username)}>Accept</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </div>
                <h3 style={{marginTop: "0.6rem"}}>Comments:</h3>
                <div className="comments-list">
                    {comments.map((c) => (
                    <div className="comment" key={c.commentid}>
                        <div className="comment-header">
                        <div style={{fontWeight: 700, color: "#0f172a"}}>{c.username}</div>
                        <div className="comment-meta">{new Date(c.date).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                        </div>

                        <div className="comment-body">
                        {c.comment}
                        </div>

                        <div className="comment-footer">
                        <div className="rating">⭐ {c.rating}/5</div>
                        <div style={{marginLeft: "auto"}}>
                            <button className="deletebtn" onClick={() => handleDeleteComment(c.commentid)}>Delete</button>
                        </div>
                        </div>
                    </div>
                    ))}
                    <button><Link to={"/Comment/" + clubName}>Comment</Link></button>
                </div>
            </aside>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default ClubPage
