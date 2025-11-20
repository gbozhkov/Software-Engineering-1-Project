// Backend server using Express and mysql2 (to connect to MySQL database)

import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'

// Initialize express app
const app = express()

// Create a connection to the database
// USE YOUR OWN DATABASE CREDENTIALS
const db = mysql.createConnection({
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'password',
    database: 'school_club_activity'
})

// Connect to the database
db.connect(err => {
  if (err) {
    console.error('DB connection error:', err)
    process.exit(1)
  }
  console.log('Connected to MySQL via mysql2')
})

// Middleware
app.use(express.json())
app.use(cors())

// Get all clubs
app.get('/clubs', (req, res) => {
    // Create the SELECT query
    const q = "SELECT * FROM clubs"

    // Execute the query
    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})


// Get specific club by clubName
app.get('/clubs/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM clubs WHERE clubName = ?"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Get specific events by clubName
app.get('/events/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM events WHERE clubName = ? ORDER BY startDate ASC"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Get person by clubName
app.get('/person/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT username, role FROM person WHERE club = ? ORDER BY FIELD(role, 'CL', 'VP', 'CM', 'STU'), username ASC"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Get specific comments by clubName
app.get('/comments/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM comments WHERE clubName = ? ORDER BY date DESC"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Get upcoming events
app.get('/events', (req, res) => {
    // Create the SELECT query
    const q = "SELECT * FROM events WHERE accepted = 1 AND (startDate > NOW() OR (endDate IS NOT NULL AND endDate > NOW())) ORDER BY startDate ASC;"

    // Execute the query
    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// User login
app.post('/login', (req, res) => {
    // Create the SELECT query
    const q = "SELECT role, club FROM person WHERE username = ? AND password = ?"
    const values = [
        req.body.username,
        req.body.password
    ]

    // Execute the query
    db.query(q, values, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Create a new club
app.post('/createClub', (req, res) => {
    const values = [
      req.body.clubName,
      req.body.description,
      req.body.memberCount,
      req.body.memberMax
    ]

    // First check if club already exists
    const q1 = "SELECT * FROM clubs WHERE clubName = ?"

    db.query(q1, req.body.clubName, (err, data) => {
        if (err) return res.status(500).json(err)

        // Club already exists
        if (data.length > 0) return res.status(400).json({ message: "Club already exists" })

        // Create the club
        const q2 = "INSERT INTO clubs (clubName, description, memberCount, memberMax) VALUES (?)"
        db.query(q2, [values], (err, data) => {
            if (err) return res.json(err)
            return res.status(201).json("Club added successfully")
        })
    })
})

// Create a new comment
app.post('/comment', (req, res) => {
    // Cerate the INSERT query
    const q = "INSERT INTO comments (date, comment, rating, username, clubName) VALUES (NOW(), ?)"
    const values = [
      req.body.comment,
      req.body.rating,
      req.body.username,
      req.body.clubName
    ]

    // Execute the query
    db.query(q, [values], (err, data) => {
        if (err) return res.json(err)
        return res.json("Comment added successfully")
    })
})

// Create a new event
app.post('/createEvent', (req, res) => {
    // Cerate the INSERT query
    const q = "INSERT INTO events (title, description, startDate, endDate, clubName) VALUES (?)"
    const values = [
      req.body.title,
      req.body.description,
      req.body.startDate,
      req.body.endDate === "" ? null : req.body.endDate,
      req.body.clubName
    ]

    // Execute the query
    db.query(q, [values], (err, data) => {
        if (err) return res.json(err)
        return res.json("Event added successfully")
    })
})

// Delete a club by clubName and reset members
app.delete('/clubs/:clubName', (req, res) => {
    const clubName = req.params.clubName

    // First, update all members of the club
    const q1 = "UPDATE person SET role = 'STU', club = NULL WHERE club = ?"

    db.query(q1, [clubName], (err, updateData) => {
        if (err) return res.json(err)

        // Then delete the club
        const q2 = "DELETE FROM clubs WHERE clubName = ?"
        db.query(q2, [clubName], (err, deleteData) => {
            if (err) return res.json(err)
            return res.json("Club deleted and members reset successfully")
        })
    })
})

// Delete a comment by commentId
app.delete('/comment/:commentid', (req, res) => {
    // Cerate the DELETE query
    const q = "DELETE FROM comments WHERE commentid = ?"
    const commentId = req.params.commentid

    // Execute the query
    db.query(q, commentId, (err, data) => {
        if (err) return res.json(err)
        return res.json("Comment deleted successfully")
    })
})

// Delete a event by eventId
app.delete('/event/:eventid', (req, res) => {
    // Cerate the DELETE query
    const q = "DELETE FROM events WHERE eventid = ?"
    const eventId = req.params.eventid

    // Execute the query
    db.query(q, eventId, (err, data) => {
        if (err) return res.json(err)
        return res.json("Comment deleted successfully")
    })
})

// Accept a event by eventId
app.put('/event/:eventid', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE events SET accepted = 1 WHERE eventid = ?"
    const eventId = req.params.eventid

    // Execute the query
    db.query(q, eventId, (err, data) => {
        if (err) return res.json(err)
        return res.json("Comment accepted successfully")
    })
})

// Update club details
app.post('/updateClub/:clubName', (req, res) => {
    const values = [
      req.body.description,
      req.body.memberMax,
      req.body.clubName
    ]
    
    // Cerate the UPDATE query
    const q1 = "SELECT memberCount FROM clubs WHERE clubName = ?"

    // Execute the query
    db.query(q1, req.body.clubName, (err, data) => {
        if (err) return res.status(500).json(err)

        // Club already exists
        if (data[0].memberCount > req.body.memberMax) return res.status(400).json({ message: "Max members higher lower then current memeres count" })

        // Create the club
        const q2 = "UPDATE clubs SET description = ?, memberMax = ? WHERE clubName = ?"
        db.query(q2, values, (err, data) => {
            if (err) return res.json(err)
            return res.status(201).json("Club updated successfully")
        })
    })
})

app.put('/joinClubs/:clubName', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = ? WHERE username = ? AND password = ?"
    const clubName = req.params.clubName
    const username = req.body.username
    const password = req.body.password

    // Execute the query
    db.query(q, [clubName, username, password], (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

app.put('/expell/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = NULL, role = 'STU' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

app.put('/accept/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET role = 'CM' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

app.put('/reject/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = NULL WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

// Promote a member to VP by username
app.put('/promote/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET role = 'VP' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

// Start the server
app.listen(3000, () => {    
  console.log('Connected to backend on port 3000!')
})
