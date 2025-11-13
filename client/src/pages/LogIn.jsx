import { React, useEffect, useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const LogIn = () => {
    const [credential, setCredential] = useState({
        username: "",
        password: "",
    })
    const [person, setPerson] = useState([])

    const navigate = useNavigate()

    const handleChange = (e) => {
        setCredential((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleClick = async (e) => {
        e.preventDefault()
        try {
            const res = await axios.get("http://localhost:3000/login/", credential)
            setPerson(res.data)
            if (setPerson.role) {
                navigate("../?role=" + data.role + "&club=" + data.club)
            } else {
                alert("Invalid credentials")
            }
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="logIn">
            <h1>Login Page</h1>
            <form>
                <input type="text" placeholder="username" onChange={handleChange} name="username" required/><br/>
                <input type="password" placeholder="password" onChange={handleChange} name="password" required/><br/>
                <button type="submit" onClick={handleClick}>Login</button>
            </form>
        </div>
    )
}

export default LogIn
