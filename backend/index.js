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
    console.error('DB connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL via mysql2');
});

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
    const q = "SELECT * FROM events WHERE clubName = ?"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// Get person events by clubName
app.get('/person/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT username, role FROM person WHERE club = ?"
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
    const q = "SELECT * FROM comments WHERE clubName = ?"
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
    const q = "SELECT * FROM events WHERE date > NOW() ORDER BY date ASC LIMIT 10"

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
    // Cerate the INSERT query
    const q = "INSERT INTO clubs (clubName, description, memberCount, memberMax) VALUES (?)"
    const values = [
      req.body.clubName,
      req.body.description,
      req.body.memberCount,
      req.body.memberMax
    ]

    // Execute the query
    db.query(q, [values], (err, data) => {
        if (err) return res.json(err)
        return res.json("Person added successfully")
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
        return res.json("Person added successfully")
    })
})

// Delete a club by clubName
app.delete('/clubs/:clubName', (req, res) => {
    // Cerate the DELETE query
    const q = "DELETE FROM clubs WHERE clubName = ?"
    const clubName = req.params.clubName

    // Execute the query
    db.query(q, clubName, (err, data) => {
        if (err) return res.json(err)
        return res.json("Club deleted successfully")
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

// Start the server
app.listen(3000, () => {    
  console.log('Connected to backend on port 3000!')
})
