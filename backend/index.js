import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'

const app = express()

const db = mysql.createConnection({
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'password',
    database: 'school_club_activity'
})

db.connect(err => {
  if (err) {
    console.error('DB connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL via mysql2');
});

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.json('Hello to the backend!')
})

app.get('/clubs', (req, res) => {
    const q = "SELECT * FROM clubs"

    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

app.get('/events', (req, res) => {
    const q = "SELECT * FROM events WHERE date > NOW() ORDER BY date ASC LIMIT 10"

    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

app.get('/login', (req, res) => {
    const q = "SELECT role, club FROM person WHERE username = ? AND password = ?"
    const values = [
      req.body.username,
      req.body.password
    ]

    db.query(q, [values], (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

app.post('/clubs', (req, res) => {
    const q = "INSERT INTO clubs (clubName, description, memberCount, memberMax) VALUES (?)"
    const values = [
      req.body.clubName,
      req.body.description,
      req.body.memberCount,
      req.body.memberMax
    ]

    db.query(q, [values], (err, data) => {
        if (err) return res.json(err)
        return res.json("Person added successfully")
    })
})

app.delete('/clubs/:clubName', (req, res) => {
    const clubName = req.params.clubName
    const q = "DELETE FROM clubs WHERE clubName = ?"

    db.query(q, [clubName], (err, data) => {
        if (err) return res.json(err)
        return res.json("Club deleted successfully")
    })
})

app.put('/joinClubs/:clubName', (req, res) => {
    const clubName = req.params.clubName
    const username = req.body.username
    const password = req.body.password

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    const q = "UPDATE person SET club = ? WHERE username = ? AND password = ?"

    db.query(q, [clubName, username, password], (err, data) => {
        if (err) return res.json(err)
        return res.json("Club joined successfully")
    })
})

app.listen(3000, () => {    
  console.log('Connected to backend on port 3000!')
})
