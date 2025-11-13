import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"

const CreateClub = () => {
    const [clubs, setClubs] = useState({
        clubName: "",
        description: "",
        memberCount: 0,
        memberMax: null
    })

    const navigate = useNavigate()

    const handleChange = (e) => {
        setClubs((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleClick = async (e) => {
        e.preventDefault()
        try {
            await axios.post("http://localhost:3000/clubs/", clubs)
            navigate("/")
        } catch (err) {
            console.error(err)
        }
    }

    // Uptdate role STU to CL and club NULL to clubName

    return (
        <div className="CreateClub">
            <h1>Create Club</h1>
            <form>
                <input type="text" placeholder="Club Name" onChange={handleChange} name="clubName" required/><br/>
                <input type="text" placeholder="Description" onChange={handleChange} name="description" required/><br/>
                <input type="number" placeholder="Max Members" onChange={handleChange} name="memberMax" required/><br/>
                <button type="submit" onClick={handleClick}>Create</button>
            </form>
            <button><Link to={"/"}>Back</Link></button>
        </div>
    )
}

export default CreateClub
