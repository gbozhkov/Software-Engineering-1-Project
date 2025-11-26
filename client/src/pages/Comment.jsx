// Page for creating a new club
import { React, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import api from "../api"
import { getSession } from "../utils/auth"

const CommentPage = () => {
    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    const session = getSession()

    // State for club details
    const [comment, setComment] = useState({
        comment: "",
        rating: 0,
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
            if (!session) {
                alert("You need to login to comment.")
                return
            }
            await api.post("/comment", { ...comment, rating: Number(comment.rating) })
            navigate("../../ClubPage/" + clubName) // Navigate back to club page
        } catch (err) {
            // Log any errors
            console.error(err)
            alert(err.response?.data?.message || "Unable to add comment")
        }
    }
    
    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Comment under {clubName}</h1>
            {session ? (
                <form>
                    <textarea type="text" placeholder="Comment" onChange={handleChange} name="comment" required/><br/>
                    <input type="number" placeholder="Rating" min="0" max="5" onChange={handleChange} name="rating" required/><br/>
                    <button type="submit" onClick={handleClick}>Comment</button>
                </form>
            ) : (
                <p style={{ textAlign: "center", opacity: 0.7 }}>Login to comment.</p>
            )}
            <button><Link to={"../../ClubPage/" + clubName}>Back</Link></button>
        </div>
    )
}

export default CommentPage
