// Page for creating a new club
import { React, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../api"
import { getSession } from "../utils/auth"

const CreateClub = () => {
    const session = getSession()

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

    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            if (!session) {
                alert("Login as CL/VP to create a club.")
                return
            }
            if (!['CL', 'VP'].includes(session.role)) {
                alert("Only CL/VP roles can create clubs.")
                return
            }
            if (session.club) {
                alert("Leave your current club before creating a new one.")
                return
            }
            // Send POST request to backend to create club
            const res = await api.post("/createClub", clubs)

            // If creation is successful, navigate back to home
            if (res.status === 201) navigate("../")
        } catch (err) {
            // Check if error comes from duplicate club
            if (err.response && err.response.status === 400) {
                alert("Club already exists!")
            } else {
                console.error(err)
                alert(err.response?.data?.message || "Unable to create club")
            }
        }
    }

    // ---> UPDATE: change role STU to CL and club NULL to clubName <---

    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Create Club</h1>
            <form>
                <input type="text" placeholder="Club Name" onChange={handleChange} name="clubName" required/><br/>
                <textarea type="text" placeholder="Description" onChange={handleChange} name="description" required/><br/>
                <input type="number" placeholder="Max Members" onChange={handleChange} name="memberMax" required/><br/>
                <button type="submit" onClick={handleClick}>Create</button>
            </form>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default CreateClub
