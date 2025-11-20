// Page for creating a new club

import { React, useState } from "react"
import axios from "axios"
import { Link, useNavigate, useLocation } from "react-router-dom"

const UpdateClub = () => {
    // Get club name from URL
    const clubName = useLocation().pathname.split("/")[2]

    // State for club details
    const [clubs, setClubs] = useState({
        clubName: clubName,
        description: "",
        memberMax: null
    })

    // Navigation hook to return to home page after creation
    const navigate = useNavigate()

    // Handle input changes and update state
    const handleChange = (e) => {
        setClubs((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to create a new club
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            // Send POST request to backend to create club
            const res = await axios.post("http://localhost:3000/updateClub/" + clubName, clubs)

            if (res.status === 201) navigate("../ClubPage/" + clubName) // Navigate back to home
        } catch (err) {
            if (err.response && err.response.status === 400) {
                alert("Max members higher should be lower then current memeres count!")
            } else {
                console.error(err)
            }
        }
    }

    // ---> UPDATE: change role STU to CL and club NULL to clubName <---

    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Update Club {clubName}</h1>
            <form>
                <textarea type="text" placeholder="Description" onChange={handleChange} name="description" required/><br/>
                <input type="number" placeholder="Max Members" onChange={handleChange} name="memberMax" required/><br/>
                <button type="submit" onClick={handleClick}>Update</button>
            </form>
            <button><Link to={"../ClubPage/" + clubName}>Back</Link></button>
        </div>
    )
}

export default UpdateClub
