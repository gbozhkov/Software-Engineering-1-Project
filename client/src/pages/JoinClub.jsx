// Page to join a specific club
import { React, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import api from "../api"

const JoinClub = () => {
    // State for user credentials
    const [person, setPerson] = useState({
        username: "",
        password: ""
    })

    // Navigation hook to return to home page after joining
    const navigate = useNavigate()

    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    // Handle input changes and update state
    const handleChange = (e) => {
        setPerson((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to join the club
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            // Send PUT request to backend to join club
            await api.put("/joinClubs/" + clubName, person)
            navigate("../") // Navigate back to home
        } catch (err) {
            // Log any errors
            console.error(err)
            alert(err.response?.data?.message || "Unable to join club")
        }
    }

    // Render the join club form
    return (
        <div className="CreateClub">
            <h1>Join {clubName} Club</h1>
            <form>
                <input type="text" placeholder="Name" onChange={handleChange} name="username" required/><br/>
                <input type="password" placeholder="Password" onChange={handleChange} name="password" required/><br/>
                <button type="button" onClick={handleClick}>Request Join</button>
            </form>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default JoinClub
