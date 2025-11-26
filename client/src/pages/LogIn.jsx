// Page for user login
import { React, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../api"
import { saveSession, clearSession } from "../utils/auth"

const LogIn = () => {
    // State for user credentials
    const [credential, setCredential] = useState({
        username: "",
        password: "",
    })
    const [error, setError] = useState("")

    // Navigation hook to redirect to home page after login
    const navigate = useNavigate()

    // Handle input changes and update state
    const handleChange = (e) => {
        setCredential((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to login the user
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        setError("")
        try {
            const res = await api.post("/login", credential)
            clearSession()
            saveSession({
                username: res.data.username,
                role: res.data.role,
                club: res.data.club,
                sessionId: res.data.sessionId
            })
            navigate("../")
        } catch (err) {
            if (err.response?.status === 401) {
                setError("Invalid credentials. Try password: password123")
                return
            }
            console.error(err)
            setError("Unable to login right now")
        }
    }

    // Render the login form
    return (
        <div className="logIn">
            <h1>Login Page</h1>
            {error && <div className="alert error" style={{ maxWidth: 340, margin: "0 auto 1rem" }}>{error}</div>}
            <form>
                <input type="text" placeholder="username" onChange={handleChange} name="username" required/><br/>
                <input type="password" placeholder="password" onChange={handleChange} name="password" required/><br/>
                <button type="submit" onClick={handleClick}>Login</button>
            </form>
        </div>
    )
}

export default LogIn
