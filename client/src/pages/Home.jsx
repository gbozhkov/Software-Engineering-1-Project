import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link } from "react-router-dom"

const ProgressBar = ({ percentage }) => {
  return (
    <div className="progress-bar-container">
        <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
        </div>
        {percentage.toFixed(0)}%
    </div>
  );
};

const Home = () => {
    const [clubs, setClubs] = useState([])
    const [events, setEvents] = useState([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/clubs")
                setClubs(res.data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:3000/events")
                setEvents(res.data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [])

    const handleDelate = async (clubName) => {
        try {
            await axios.delete("http://localhost:3000/clubs/" + clubName)
            window.location.reload()
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div>
            <h1>Club List</h1>
            <div className="clubs">
                {clubs.map((club) => (
                    <div className="club card" key={club.clubName}>
                        <h2>{club.clubName}</h2>
                        <p>{club.description}</p>
                        <p>Members: {club.memberCount} / {club.memberMax}</p>
                        <ProgressBar percentage={club.memberCount / club.memberMax * 100} />
                        <button className="joinClub"><Link to={`/JoinClub/${club.clubName}`}>Join Club</Link></button>
                        <button className="deleteClub" onClick={() => handleDelate(club.clubName)}>Delate Club</button>
                        <button className="detail"><Link to={`/ClubPage/${club.clubName}`}>View Club</Link></button>
                    </div>
                ))}
            </div>
            <div className="createClub">
                <h4>No club interest you?</h4>
                <button><Link to={"/CreateClub"}>Create Club</Link></button>
            </div>
            <h1>Incoming Events</h1>
            <div className="events">
                {events.map((event) => (
                    <div className="event" key={event.eventid}>
                    <div className="event-header">
                        <h2>{event.title}</h2>
                        <span className="event-date">
                        {new Date(event.date).toLocaleDateString('en-GB')}
                        </span>
                    </div>
                    <p className="event-club">Hold by {event.clubName}</p>
                    <p className="event-description">{event.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Home
