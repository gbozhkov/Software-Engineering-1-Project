// Page for user login

import { React, useState, useEffect } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const LogIn = () => {
    // State for user credentials
    const [credential, setCredential] = useState({
        username: "",
        password: "",
    })

    // Ensure axios sends cookies with requests
    axios.defaults.withCredentials = true;

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
            if (res.data.login) {
                // If valid credentials, navigate to home with role and 
                navigate("/")
            } else {
                // If invalid credentials, show alert
                alert("Invalid credentials")
            }
        } catch (err) {
            // Log any errors
            console.error(err)
        }
    }

    // Check user session on component mount
    useEffect(() => {
        axios.get("http://localhost:3000/session")
        .then((res) => {
            if (res.data.valid) navigate("/")
        })
        .catch((err) => {
            console.error(err)
        })
    }, [])

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
