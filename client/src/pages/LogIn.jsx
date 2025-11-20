// Page for user login

import { React, useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const LogIn = () => {
    // State for user credentials
    const [credential, setCredential] = useState({
        username: "",
        password: "",
    })

    // Navigation hook to redirect to home page after login
    const navigate = useNavigate()

    // Handle input changes and update state
    const handleChange = (e) => {
        setCredential((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    // Handle form submission to login the user
    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            // Send POST request to backend to get user role and club
            const res = await axios.post("http://localhost:3000/login", credential)
            if (res.data.length > 0) {
                // If valid credentials, navigate to home with role and club
                const user = res.data[0]
                navigate("../?username=" + credential.username + "&role=" + user.role + "&club=" + user.club)
            }else {
                // If invalid credentials, show alert
                alert("Invalid credentials")
            }
        } catch (err) {
            // Log any errors
            console.error(err)
        }
    }

    // Render the login form
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
