import { React, useEffect, useState } from "react"
import axios from "axios"
import { Link, useLocation } from "react-router-dom"

const ClubPage = () => {
    const location = useLocation()
    const clubName = location.pathname.split("/")[2]

    return (
        <div>
            {clubName}<br/>
            <button><Link to={"../"}>Back</Link></button>
        </div>
    )
}

export default ClubPage
