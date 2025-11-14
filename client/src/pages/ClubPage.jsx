// Page to display specific club information

import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link, useLocation } from "react-router-dom"

const ClubPage = () => {
    // Get club name from URL
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    // Render club information
    return (
        <div>
            {clubName}<br/>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default ClubPage
