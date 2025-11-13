import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link, useLocation, useNavigate } from "react-router-dom"

const JoinClub = () => {
    const [person, setPerson] = useState({
        username: "",
        password: ""
    })

    const navigate = useNavigate()

    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    const handleChange = (e) => {
        setPerson((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleClick = async (e) => {
        e.preventDefault()
        try {
            await axios.put("http://localhost:3000/joinClubs/" + clubName, person)
            navigate("../")
        } catch (err) {
            console.error(err)
        }
    }

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
