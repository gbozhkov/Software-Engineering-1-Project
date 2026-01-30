// Page for creating a new club
import { React, useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import api from "../api"
import { getSession } from "../utils/auth"

const CreateClub = () => {
    const session = getSession()
    const isSA = useMemo(() => session?.isAdmin === true, [session?.isAdmin])
    
    // Check if user is a Club Leader anywhere (CL cannot create new clubs)
    const isClubLeaderAnywhere = useMemo(() => {
        if (!session?.memberships) return false
        return session.memberships.some(m => m.role === 'CL')
    }, [session])

    // State for club details
    const [clubs, setClubs] = useState({
        clubName: "",
        description: "",
        memberCount: 0,
        memberMax: null,
        bannerImage: "",
        bannerColor: "#38bdf8"
    })

    // State for SA leader selection
    const [leaderSearch, setLeaderSearch] = useState("")
    const [selectedLeader, setSelectedLeader] = useState(null)
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Navigation hook to return to home page after creation
    const navigate = useNavigate()

    // Fetch available leaders for SA
    const { data: availableLeaders = [] } = useQuery({
        queryKey: ['availableLeaders', leaderSearch],
        queryFn: () => api.get("/availableLeaders", { params: { q: leaderSearch } }).then(res => res.data),
        enabled: isSA && leaderSearch.length > 0,
        staleTime: 1000 * 30
    })

    // Handle input changes and update state
    const handleChange = (e) => {
        setClubs((prev) => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleClick = async (e) => {
        e.preventDefault() // Prevent default form submission behavior
        try {
            if (!session) {
                alert("Login to create a club.")
                return
            }
            
            // SA can create without being in a club, but must select a leader
            if (isSA) {
                if (!selectedLeader) {
                    alert("Please select an initial club leader.")
                    return
                }
            } else {
                // Non-SA Club Leaders cannot create new clubs
                if (isClubLeaderAnywhere) {
                    alert("Club Leaders cannot create new clubs.")
                    return
                }
            }
            
            // Send POST request to backend to create club
            const payload = { ...clubs }
            if (isSA) {
                payload.initialLeader = selectedLeader
            }
            
            const res = await api.post("/createClub", payload)

            // If creation is successful, navigate back to home
            if (res.status === 201) {
                alert(res.data.message || "Club created successfully!")
                navigate("../")
            }
        } catch (err) {
            // Check if error comes from duplicate club
            if (err.response && err.response.status === 400) {
                alert(err.response?.data?.message || "Club already exists!")
            } else {
                console.error(err)
                alert(err.response?.data?.message || "Unable to create club")
            }
        }
    }

    // Render the create club form
    return (
        <div className="CreateClub">
            <h1>Create Club</h1>
            {!isSA && isClubLeaderAnywhere ? (
                <p style={{ opacity: 0.7, textAlign: "center" }}>Club Leaders cannot create new clubs.</p>
            ) : (
                <form>
                    <input type="text" placeholder="Club Name" onChange={handleChange} name="clubName" required/><br/>
                    <textarea type="text" placeholder="Description" onChange={handleChange} name="description" required/><br/>
                    <input type="number" placeholder="Max Members" onChange={handleChange} name="memberMax" required/><br/>
                    <input type="url" placeholder="Banner Image URL (optional)" onChange={handleChange} name="bannerImage"/><br/>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                        Banner Color:
                        <input type="color" onChange={handleChange} name="bannerColor" value={clubs.bannerColor} style={{ width: "60px", height: "40px", cursor: "pointer" }}/>
                    </label>
                    
                    {/* SA must select an initial leader */}
                    {isSA && (
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
                                Initial Club Leader: *
                            </label>
                            <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "0.5rem" }}>
                                As System Admin, you must assign a leader for this club.
                            </p>
                            <div style={{ position: "relative" }}>
                                <input 
                                    type="text" 
                                    placeholder="Search for a user..." 
                                    value={selectedLeader || leaderSearch}
                                    onChange={(e) => {
                                        setLeaderSearch(e.target.value)
                                        setSelectedLeader(null)
                                        setShowSuggestions(true)
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    style={{ width: "100%", marginBottom: 0 }}
                                />
                                {showSuggestions && availableLeaders.length > 0 && !selectedLeader && (
                                    <div style={{ 
                                        position: "absolute", 
                                        top: "100%", 
                                        left: 0, 
                                        right: 0, 
                                        backgroundColor: "#ffffff", 
                                        border: "1px solid var(--border, #e2e8f0)",
                                        borderRadius: "0.5rem",
                                        maxHeight: "200px",
                                        overflowY: "auto",
                                        zIndex: 10,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                                    }}>
                                        {availableLeaders.map(user => (
                                            <div 
                                                key={user.username}
                                                onClick={() => {
                                                    setSelectedLeader(user.username)
                                                    setLeaderSearch("")
                                                    setShowSuggestions(false)
                                                }}
                                                style={{ 
                                                    padding: "0.75rem 1rem", 
                                                    cursor: "pointer",
                                                    borderBottom: "1px solid #e2e8f0",
                                                    color: "#1f2937"
                                                }}
                                                onMouseEnter={(e) => e.target.style.backgroundColor = "#f1f5f9"}
                                                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                                            >
                                                {user.username} <span style={{ opacity: 0.6, fontSize: "0.85rem" }}>({user.role})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedLeader && (
                                <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ color: "var(--success, #10b981)" }}>✓ Selected: {selectedLeader}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setSelectedLeader(null)
                                            setLeaderSearch("")
                                        }}
                                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <button type="submit" onClick={handleClick}>Create</button>
                </form>
            )}
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default CreateClub
