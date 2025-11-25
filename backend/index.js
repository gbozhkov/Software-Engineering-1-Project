// Backend server using Express and mysql2 (to connect to MySQL database)

import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'

// Initialize express app
const app = express()
app.use(express.json())
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}))

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

// Reload session values from DB when the logged-in user is updated
const refreshSessionForUser = (req, username) => {
    if (!req.session || req.session.username !== username) return Promise.resolve()

    return new Promise((resolve, reject) => {
        const q = 'SELECT username, role, club FROM person WHERE username = ? LIMIT 1'
        db.query(q, username, (err, data) => {
            if (err) return reject(err)
            if (data.length > 0) {
                req.session.username = data[0].username
                req.session.role = data[0].role
                req.session.club = data[0].club
            }
            resolve()
        })
    })
}

const SALT_ROUNDS = 10

const hashPassword = plain => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(plain, SALT_ROUNDS, (err, hash) => {
            if (err) return reject(err)
            resolve(hash)
        })
    })
}

const upgradePasswordIfNeeded = (user, suppliedPassword) => {
    if (!user.password || user.password.startsWith('$2')) return Promise.resolve()
    return hashPassword(suppliedPassword)
        .then(hash => new Promise((resolve, reject) => {
            const q = 'UPDATE person SET password = ? WHERE username = ?'
            db.query(q, [hash, user.username], err => {
                if (err) return reject(err)
                resolve()
            })
        }))
}

const updateMemberCount = (clubName, delta) => {
    if (!clubName || typeof delta !== 'number' || delta === 0) return Promise.resolve()

    return new Promise((resolve, reject) => {
        const q = 'UPDATE clubs SET memberCount = GREATEST(memberCount + ?, 0) WHERE clubName = ?'
        db.query(q, [delta, clubName], err => {
            if (err) return reject(err)
            resolve()
        })
    })
}

// Get session info
app.get('/session', (req, res) => {
    if (req.session.username) {
        return res.status(200).json({ valid: true, username: req.session.username, role: req.session.role, club: req.session.club })
    } else {
        return res.status(200).json({ valid: false })
    }
})

// Get all clubs
app.get('/clubs', (req, res) => {
    // Create the SELECT query
    const q = "SELECT * FROM clubs"

    // Execute the query
    db.query(q, (err, data) => {
        if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})


// Get specific club by clubName
app.get('/clubs/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM clubs WHERE clubName = ? LIMIT 1"
    const clubName = req.params.clubName

    // Execute the query
        db.query(q, clubName, (err, data) => {
            if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})

// Get specific events by clubName
app.get('/events/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM events WHERE clubName = ? ORDER BY startDate ASC"
    const clubName = req.params.clubName

    // Execute the query
        db.query(q, clubName, (err, data) => {
            if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})

// Get person by clubName
app.get('/person/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT username, role FROM person WHERE club = ? ORDER BY FIELD(role, 'CL', 'VP', 'CM', 'STU'), username ASC"
    const clubName = req.params.clubName

    // Execute the query
        db.query(q, clubName, (err, data) => {
            if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})

// Get specific comments by clubName
app.get('/comments/:clubName', (req, res) => {
    // Cerate the SELECT query
    const q = "SELECT * FROM comments WHERE clubName = ? ORDER BY date DESC"
    const clubName = req.params.clubName

    // Execute the query
        db.query(q, clubName, (err, data) => {
            if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})

// Get upcoming events
app.get('/events', (req, res) => {
    // Create the SELECT query
    const q = "SELECT * FROM events WHERE accepted = 1 AND (startDate > NOW() OR (endDate IS NOT NULL AND endDate > NOW())) ORDER BY startDate ASC;"

    // Execute the query
        db.query(q, (err, data) => {
            if (err) return res.status(500).json(err)
        return res.status(200).json(data)
    })
})

// User login
app.post('/login', (req, res) => {
    // Create the SELECT query
    const q = "SELECT * FROM person WHERE username = ? LIMIT 1"

    // Execute the query
    db.query(q, [req.body.username], async (err, data) => {
        if (err) return res.status(500).json(err)

        if (data.length === 0) {
            return res.status(401).json({ login: false })
        }

        const user = data[0]
        const storedPassword = user.password || ''
        let isValidPassword = false

        if (storedPassword.startsWith('$2')) {
            try {
                isValidPassword = await bcrypt.compare(req.body.password, storedPassword)
            } catch (compareErr) {
                return res.status(500).json(compareErr)
            }
        } else {
            isValidPassword = storedPassword === req.body.password
        }

        if (!isValidPassword) {
            return res.status(401).json({ login: false })
        }

        upgradePasswordIfNeeded(user, req.body.password).catch(err => console.error('Auto-upgrade password failed', err))

        req.session.username = user.username
        req.session.role = user.role
        req.session.club = user.club
        return res.status(200).json({ login: true })
    })
})

// Temporary endpoint to create accounts for debugging purposes
// UPDATE: DELETE
app.post('/createAccount', async (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' })
    }

    const checkQuery = 'SELECT username FROM person WHERE username = ? LIMIT 1'

    db.query(checkQuery, [username], async (err, data) => {
        if (err) return res.status(500).json(err)
        if (data.length > 0) return res.status(409).json({ message: 'User already exists' })

        let hashedPassword
        try {
            hashedPassword = await hashPassword(password)
        } catch (hashErr) {
            return res.status(500).json(hashErr)
        }

        const insertQuery = 'INSERT INTO person (username, password, role, club) VALUES (?, ?, \'STU\', NULL)'
        db.query(insertQuery, [username, hashedPassword], err => {
            if (err) return res.status(500).json(err)
            return res.status(201).json({ created: true })
        })
    })
})

// Destroy current session
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Unable to logout' })
        res.clearCookie('connect.sid')
        return res.status(200).json({ logout: true })
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
            if (err) return res.status(500).json(err)

            const q3 = "UPDATE person SET role = 'CL', club = ? WHERE username = ?"
            db.query(q3, [req.body.clubName, req.body.username], (err, data) => {
                if (err) return res.status(500).json(err)
                return res.status(201).json("Club added successfully")
            })
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
        if (err) return res.status(500).json(err)
        return res.status(201).json("Comment added successfully")
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
        if (err) return res.status(500).json(err)
        return res.status(201).json("Event added successfully")
    })
})

// Delete a club by clubName and reset members
app.delete('/clubs/:clubName', (req, res) => {
    const clubName = req.params.clubName

    // First, update all members of the club
    const q1 = "UPDATE person SET role = 'STU', club = NULL WHERE club = ?"

    db.query(q1, [clubName], (err, updateData) => {
        if (err) return res.status(500).json(err)

        // Then delete the club
        const q2 = "DELETE FROM clubs WHERE clubName = ?"
        db.query(q2, [clubName], (err, deleteData) => {
            if (err) return res.status(500).json(err)
            return res.status(200).json("Club deleted and members reset successfully")
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
        if (err) return res.status(500).json(err)
        return res.status(200).json("Comment deleted successfully")
    })
})

// Delete a event by eventId
app.delete('/event/:eventid', (req, res) => {
    // Cerate the DELETE query
    const q = "DELETE FROM events WHERE eventid = ?"
    const eventId = req.params.eventid

    // Execute the query
    db.query(q, eventId, (err, data) => {
        if (err) return res.status(500).json(err)
        return res.status(200).json("Comment deleted successfully")
    })
})

// Accept a event by eventId
app.put('/event/:eventid', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE events SET accepted = 1 WHERE eventid = ?"
    const eventId = req.params.eventid

    // Execute the query
    db.query(q, eventId, (err, data) => {
        if (err) return res.status(500).json(err)
        return res.status(200).json("Comment accepted successfully")
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
            if (err) return res.status(500).json(err)
            return res.status(200).json("Club updated successfully")
        })
    })
})

app.put('/joinClubs/:clubName', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = ? WHERE username = ?"
    const clubName = req.params.clubName
    const username = req.body.username

    // Execute the query
    db.query(q, [clubName, username], (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => res.status(200).json("Club joined successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

app.put('/expell/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = NULL, role = 'STU' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => updateMemberCount(req.body.clubName, -1))
            .then(() => res.status(200).json("User expelled successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

app.put('/accept/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET role = 'CM' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => updateMemberCount(req.body.clubName, 1))
            .then(() => res.status(200).json("User accepted successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

app.put('/reject/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET club = NULL WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => res.status(200).json("User rejected successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

// Promote a member to VP by username
app.put('/promote/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET role = 'VP' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => res.status(200).json("User promoted successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

app.put('/depromote/:username', (req, res) => {
    // Cerate the UPDATE query
    const q = "UPDATE person SET role = 'CM' WHERE username = ?"
    const username = req.params.username

    // Execute the query
    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json(err)
        refreshSessionForUser(req, username)
            .then(() => res.status(200).json("User accepted successfully"))
            .catch(syncErr => res.status(500).json(syncErr))
    })
})

// Start the server
app.listen(3000, () => {    
  console.log('Connected to backend on port 3000!')
})
