// Page for creating a new club

import { React, useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"

const CreateClub = () => {
    // State for club details
    const [clubs, setClubs] = useState({
        clubName: "",
        description: "",
        memberCount: 0,
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
            await axios.post("http://localhost:3000/createClub", clubs)
            navigate("../") // Navigate back to home
        } catch (err) {
            // Log any errors
            console.error(err)
        }
    }

    // ---> UPDATE: change role STU to CL and club NULL to clubName <---

    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Create Club</h1>
            <form>
                <input type="text" placeholder="Club Name" onChange={handleChange} name="clubName" required/><br/>
                <input type="text" placeholder="Description" onChange={handleChange} name="description" required/><br/>
                <input type="number" placeholder="Max Members" onChange={handleChange} name="memberMax" required/><br/>
                <button type="submit" onClick={handleClick}>Create</button>
            </form>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default CreateClub
