// Page for creating a new club

import { React, useState } from "react"
import axios from "axios"
import { Link, useNavigate, useLocation } from "react-router-dom"

const CreateClub = () => {
    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    // State for club details
    const [comment, setComment] = useState({
        comment: "",
        rating: 0,
        username: "Francesco", // ---> UPDATE: replace with actual logged-in user <---
        clubName: clubName
    })

    // Navigation hook to return to home page after creation
    const navigate = useNavigate()

    // Handle input changes and update state
    const handleChange = (e) => {
        setComment((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to create a new club
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            // Send POST request to backend to create club
            await axios.post("http://localhost:3000/comment", comment)
            navigate("../../ClubPage/" + clubName) // Navigate back to club page
        } catch (err) {
            // Log any errors
            console.error(err)
        }
    }

    // ---> UPDATE: change role STU to CL and club NULL to clubName <---

    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Comment under {clubName}</h1>
            <form>
                <input type="text" placeholder="comment" onChange={handleChange} name="comment" required/><br/>
                <input type="number" placeholder="rating" min="0" max="5" onChange={handleChange} name="rating" required/><br/>
                <button type="submit" onClick={handleClick}>Comment</button>
            </form>
            <button><Link to={"../../ClubPage/" + clubName}>Back</Link></button>
        </div>
    )
}

export default CreateClub
