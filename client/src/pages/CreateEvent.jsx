// Page for creating a new club

import { React, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import api from "../api"
import { getSession } from "../utils/auth"

const CreateEvent = () => {
    // Get club name from URL
    const location = useLocation()
    const clubName = decodeURIComponent(location.pathname.split("/")[2])

    const session = getSession()

    // State for event details
    const [event, setEvent] = useState({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        clubName: clubName
    })

    // Navigation hook to return to home page after creation
    const navigate = useNavigate()

    // Handle input changes and update state
    const handleChange = (e) => {
        setEvent((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to create a new club
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            // SA can create events for any club, CL/VP only for their own club
            const isSA = session?.isAdmin === true
            const myMembership = session?.memberships?.find(m => m.clubName === clubName)
            if (!session || (!isSA && (!myMembership || !['CL', 'VP'].includes(myMembership.role)))) {
                alert("Only club admins can create events.")
                return
            }
            await api.post("/createEvent", event)
            navigate("../../ClubPage/" + clubName) // Navigate back to club page
        } catch (err) {
            // Log any errors
            console.error(err)
            alert(err.response?.data?.message || "Unable to create event")
        }
    }

    // ---> UPDATE: change role STU to CL and club NULL to clubName <---

    // Render the create club form
    const isSA = session?.isAdmin === true
    const myMembership = session?.memberships?.find(m => m.clubName === clubName)
    const canCreateEvent = isSA || (myMembership && ['CL', 'VP'].includes(myMembership.role))
    
    return (
        <div className="CreateClub">
            <h1>Create event for {clubName}</h1>
            {canCreateEvent ? (
                <form>
                    <input type="text" placeholder="title" onChange={handleChange} name="title" required/><br/>
                    <textarea type="text" placeholder="description" onChange={handleChange} name="description" required/><br/>
                    <input type="datetime-local" onChange={handleChange} name="startDate" required/><br/>
                    <input type="datetime-local" onChange={handleChange} name="endDate" /><br/>
                    <button type="submit" onClick={handleClick}>Create</button>
                </form>
            ) : (
                <p style={{ opacity: 0.7 }}>Only club admins can create events.</p>
            )}
            <button><Link to={"../../ClubPage/" + clubName}>Back</Link></button>
        </div>
    )
}

export default CreateEvent
