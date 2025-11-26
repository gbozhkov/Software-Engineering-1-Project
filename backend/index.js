// Backend server using Express and mysql2 (to connect to MySQL database)

import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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

// Promise helper for async/await queries
const dbp = db.promise()

// Connect to the database
db.connect(err => {
  if (err) {
    console.error('DB connection error:', err)
    process.exit(1)
  }
  console.log('Connected to MySQL via mysql2')
})

// --- Auth + utilities ---
const unauthorized = res => res.status(401).json({ message: 'Authentication required' })
const forbidden = res => res.status(403).json({ message: 'Not allowed for your role/club' })

const requireAuth = async (req, res, next) => {
  const username = req.headers['x-username']
  const sessionId = req.headers['x-session-id']

  if (!username || !sessionId) return unauthorized(res)

  try {
    const [rows] = await dbp.query(
      'SELECT username, role, club FROM person WHERE username = ? AND sessionId = ?',
      [username, sessionId]
    )
    if (rows.length === 0) return unauthorized(res)
    req.user = rows[0]
    next()
  } catch (err) {
    console.error('Auth check failed', err)
    return res.status(500).json({ message: 'Auth lookup failed' })
  }
}

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res)
  if (roles.length && !roles.includes(req.user.role)) return forbidden(res)
  next()
}

const requireClubMatch = clubGetter => async (req, res, next) => {
  try {
    const targetClub = clubGetter(req)
    if (targetClub && req.user?.club && req.user.club !== targetClub) return forbidden(res)
    next()
  } catch (err) {
    console.error('Club check failed', err)
    return res.status(500).json({ message: 'Club check failed' })
  }
}

const recalcMemberCount = async clubName => {
  if (!clubName) return
  await dbp.query(
    "UPDATE clubs SET memberCount = (SELECT COUNT(*) FROM person WHERE club = ? AND role IN ('CL','VP','CM')) WHERE clubName = ?",
    [clubName, clubName]
  )
}

const createNotification = async ({ username, clubName, type = 'info', message, link = null }) => {
  if (!username || !message) return
  await dbp.query(
    'INSERT INTO notifications (username, clubName, type, message, link) VALUES (?, ?, ?, ?, ?)',
    [username, clubName || null, type, message, link]
  )
}

const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const buildPagination = (query, allowedOrder, defaultOrder) => {
  const search = query.q || ''
  const orderKey = allowedOrder[query.orderBy] || defaultOrder
  const direction = (query.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const limit = Math.min(toNumber(query.limit, 10), 50)
  const page = toNumber(query.page, 1)
  const offset = (page - 1) * limit
  return { search, orderKey, direction, limit, page, offset }
}

// Middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false
})

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))
app.use(apiLimiter)

// Get all clubs with optional search/order/pagination
app.get('/clubs', async (req, res) => {
  try {
    const { search, orderKey, direction, limit, page, offset } = buildPagination(
      req.query,
      { clubName: 'clubName', members: 'memberCount', memberCount: 'memberCount', memberMax: 'memberMax' },
      'clubName'
    )
    const like = `%${search}%`
    const status = req.query.status
    const statusClause =
      status === 'full' ? ' AND memberCount >= memberMax' :
      status === 'notFull' ? ' AND memberCount < memberMax' : ''

    const [rows] = await dbp.query(
      `SELECT * FROM clubs WHERE clubName LIKE ?${statusClause} ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(`SELECT COUNT(*) AS total FROM clubs WHERE clubName LIKE ?${statusClause}`, [like])

    // When pagination/search is used, include metadata
    if (req.query.page || req.query.limit || req.query.q || req.query.orderBy || req.query.order) {
      return res.json({
        data: rows,
        page,
        pages: Math.ceil(total / limit) || 1,
        total
      })
    }

    return res.json(rows)
  } catch (err) {
    console.error('Error fetching clubs', err)
    return res.status(500).json({ message: 'Failed to fetch clubs' })
  }
})


// Get specific club by clubName
app.get('/clubs/:clubName', async (req, res) => {
  const clubName = req.params.clubName
  try {
    const [rows] = await dbp.query('SELECT * FROM clubs WHERE clubName = ?', [clubName])
    return res.json(rows)
  } catch (err) {
    console.error('Error fetching club', err)
    return res.status(500).json({ message: 'Failed to fetch club' })
  }
})

// Get specific events by clubName with optional search/order/pagination
app.get('/events/:clubName', async (req, res) => {
  const clubName = req.params.clubName
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { startDate: 'startDate', endDate: 'endDate', title: 'title', accepted: 'accepted' },
    'startDate'
  )
  const like = `%${search}%`

  try {
    const [rows] = await dbp.query(
      `SELECT * FROM events WHERE clubName = ? AND (title LIKE ? OR description LIKE ?) ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [clubName, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      'SELECT COUNT(*) AS total FROM events WHERE clubName = ? AND (title LIKE ? OR description LIKE ?)',
      [clubName, like, like]
    )

    if (req.query.page || req.query.limit || req.query.q || req.query.orderBy || req.query.order) {
      return res.json({
        data: rows,
        page,
        pages: Math.ceil(total / limit) || 1,
        total
      })
    }

    return res.json(rows)
  } catch (err) {
    console.error('Error fetching events', err)
    return res.status(500).json({ message: 'Failed to fetch events' })
  }
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

// Get specific comments by clubName with optional search/order/pagination
app.get('/comments/:clubName', async (req, res) => {
  const clubName = req.params.clubName
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { date: 'date', rating: 'rating', username: 'username' },
    'date'
  )
  const like = `%${search}%`

  try {
    const [rows] = await dbp.query(
      `SELECT * FROM comments WHERE clubName = ? AND (comment LIKE ? OR username LIKE ?) ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [clubName, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      'SELECT COUNT(*) AS total FROM comments WHERE clubName = ? AND (comment LIKE ? OR username LIKE ?)',
      [clubName, like, like]
    )

    if (req.query.page || req.query.limit || req.query.q || req.query.orderBy || req.query.order) {
      return res.json({
        data: rows,
        page,
        pages: Math.ceil(total / limit) || 1,
        total
      })
    }

    return res.json(rows)
  } catch (err) {
    console.error('Error fetching comments', err)
    return res.status(500).json({ message: 'Failed to fetch comments' })
  }
})

// Get upcoming events with optional search/order/pagination
app.get('/events', async (req, res) => {
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { startDate: 'startDate', endDate: 'endDate', title: 'title', clubName: 'clubName' },
    'startDate'
  )
  const like = `%${search}%`
  try {
    const [rows] = await dbp.query(
      `SELECT * FROM events 
       WHERE accepted = 1 AND (startDate > NOW() OR (endDate IS NOT NULL AND endDate > NOW()))
         AND (title LIKE ? OR description LIKE ? OR clubName LIKE ?)
       ORDER BY ${orderKey} ${direction}
       LIMIT ? OFFSET ?`,
      [like, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      `SELECT COUNT(*) AS total FROM events 
       WHERE accepted = 1 AND (startDate > NOW() OR (endDate IS NOT NULL AND endDate > NOW()))
         AND (title LIKE ? OR description LIKE ? OR clubName LIKE ?)`,
      [like, like, like]
    )

    if (req.query.page || req.query.limit || req.query.q || req.query.orderBy || req.query.order) {
      return res.json({
        data: rows,
        page,
        pages: Math.ceil(total / limit) || 1,
        total
      })
    }

    return res.json(rows)
  } catch (err) {
    console.error('Error fetching events', err)
    return res.status(500).json({ message: 'Failed to fetch events' })
  }
})

// User login (creates a session)
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' })

  try {
    const [rows] = await dbp.query('SELECT username, password, role, club FROM person WHERE username = ?', [username])
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' })

    const stored = rows[0].password || ''
    let isValid = false
    try {
      isValid = await bcrypt.compare(password, stored)
    } catch (err) {
      isValid = false
    }
    // Fallback for legacy plain-text seeds
    if (!isValid && password === stored) isValid = true

    if (!isValid) return res.status(401).json({ message: 'Invalid credentials' })

    const sessionId = crypto.randomUUID()
    await dbp.query('UPDATE person SET sessionId = ? WHERE username = ?', [sessionId, username])

    return res.json({
      username,
      role: rows[0].role,
      club: rows[0].club,
      sessionId
    })
  } catch (err) {
    console.error('Login failed', err)
    return res.status(500).json({ message: 'Login failed' })
  }
})

app.post('/logout', requireAuth, async (req, res) => {
  try {
    await dbp.query('UPDATE person SET sessionId = NULL WHERE username = ?', [req.user.username])
    return res.json({ message: 'Logged out' })
  } catch (err) {
    console.error('Logout failed', err)
    return res.status(500).json({ message: 'Logout failed' })
  }
})

// Create a new club
app.post('/createClub', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const { clubName, description, memberMax } = req.body
  if (!clubName || !description || !memberMax) return res.status(400).json({ message: 'Missing club fields' })
  if (req.user.club) return res.status(400).json({ message: 'Leave your current club before creating a new one' })
  const maxMembers = Number(memberMax)
  if (Number.isNaN(maxMembers) || maxMembers < 1) return res.status(400).json({ message: 'memberMax must be a positive number' })

  try {
    const [exists] = await dbp.query('SELECT 1 FROM clubs WHERE clubName = ?', [clubName])
    if (exists.length > 0) return res.status(400).json({ message: 'Club already exists' })

    await dbp.query(
      'INSERT INTO clubs (clubName, description, memberCount, memberMax) VALUES (?, ?, ?, ?)',
      [clubName, description, 1, maxMembers]
    )
    await dbp.query('UPDATE person SET role = ?, club = ? WHERE username = ?', ['CL', clubName, req.user.username])

    return res.status(201).json({ message: 'Club added successfully' })
  } catch (err) {
    console.error('Create club failed', err)
    return res.status(500).json({ message: 'Failed to create club' })
  }
})

// Create a new comment
app.post('/comment', requireAuth, async (req, res) => {
  const { comment, rating, clubName } = req.body
  if (!comment || !clubName) return res.status(400).json({ message: 'Comment and clubName are required' })

  try {
    await dbp.query(
      'INSERT INTO comments (date, comment, rating, username, clubName) VALUES (NOW(), ?, ?, ?, ?)',
      [comment, rating ?? 0, req.user.username, clubName]
    )
    return res.json({ message: 'Comment added successfully' })
  } catch (err) {
    console.error('Add comment failed', err)
    return res.status(500).json({ message: 'Failed to add comment' })
  }
})

// Create a new event
app.post('/createEvent', requireAuth, requireRoles('CL', 'VP'), requireClubMatch(req => req.body.clubName), async (req, res) => {
  const { title, description, startDate, endDate, clubName } = req.body
  if (!title || !description || !startDate || !clubName) return res.status(400).json({ message: 'Missing event fields' })

  try {
    await dbp.query(
      'INSERT INTO events (title, description, startDate, endDate, clubName) VALUES (?, ?, ?, ?, ?)',
      [title, description, startDate, endDate === '' ? null : endDate, clubName]
    )
    return res.json({ message: 'Event added successfully' })
  } catch (err) {
    console.error('Create event failed', err)
    return res.status(500).json({ message: 'Failed to create event' })
  }
})

// Delete a club by clubName and reset members
app.delete('/clubs/:clubName', requireAuth, requireRoles('CL'), requireClubMatch(req => req.params.clubName), async (req, res) => {
  const clubName = req.params.clubName
  try {
    await dbp.query("UPDATE person SET role = 'STU', club = NULL WHERE club = ?", [clubName])
    await dbp.query("DELETE FROM clubs WHERE clubName = ?", [clubName])
    return res.json({ message: "Club deleted and members reset successfully" })
  } catch (err) {
    console.error('Delete club failed', err)
    return res.status(500).json({ message: 'Failed to delete club' })
  }
})

// Delete a comment by commentId
app.delete('/comment/:commentid', requireAuth, async (req, res) => {
  const commentId = req.params.commentid
  try {
    const [rows] = await dbp.query('SELECT username, clubName FROM comments WHERE commentid = ?', [commentId])
    if (rows.length === 0) return res.status(404).json({ message: 'Comment not found' })
    const comment = rows[0]

    const isOwner = comment.username === req.user.username
    const isClubAdmin = ['CL', 'VP'].includes(req.user.role) && (!req.user.club || req.user.club === comment.clubName)

    if (!isOwner && !isClubAdmin) return forbidden(res)

    await dbp.query("DELETE FROM comments WHERE commentid = ?", [commentId])
    return res.json({ message: "Comment deleted successfully" })
  } catch (err) {
    console.error('Delete comment failed', err)
    return res.status(500).json({ message: 'Failed to delete comment' })
  }
})

// Delete a event by eventId
app.delete('/event/:eventid', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const eventId = req.params.eventid
  try {
    const [rows] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [eventId])
    if (rows.length === 0) return res.status(404).json({ message: 'Event not found' })
    if (req.user.club && req.user.club !== rows[0].clubName) return forbidden(res)

    await dbp.query("DELETE FROM events WHERE eventid = ?", [eventId])
    return res.json({ message: "Event deleted successfully" })
  } catch (err) {
    console.error('Delete event failed', err)
    return res.status(500).json({ message: 'Failed to delete event' })
  }
})

// Accept a event by eventId
app.put('/event/:eventid', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const eventId = req.params.eventid
  try {
    const [rows] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [eventId])
    if (rows.length === 0) return res.status(404).json({ message: 'Event not found' })
    if (req.user.club && req.user.club !== rows[0].clubName) return forbidden(res)
    await dbp.query("UPDATE events SET accepted = 1 WHERE eventid = ?", [eventId])
    return res.json({ message: "Event accepted successfully" })
  } catch (err) {
    console.error('Accept event failed', err)
    return res.status(500).json({ message: 'Failed to accept event' })
  }
})

// Update club details
app.post('/updateClub/:clubName', requireAuth, requireRoles('CL', 'VP'), requireClubMatch(req => req.params.clubName), async (req, res) => {
  const clubName = req.params.clubName
  const { description, memberMax } = req.body
  if (!description || !memberMax) return res.status(400).json({ message: 'Missing fields' })
  const maxMembers = Number(memberMax)
  if (Number.isNaN(maxMembers) || maxMembers < 1) return res.status(400).json({ message: 'memberMax must be positive' })

  try {
    const [rows] = await dbp.query('SELECT memberCount FROM clubs WHERE clubName = ?', [clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'Club not found' })
    if (rows[0].memberCount > maxMembers) return res.status(400).json({ message: 'Member max cannot be below current members' })

    await dbp.query('UPDATE clubs SET description = ?, memberMax = ? WHERE clubName = ?', [description, maxMembers, clubName])
    return res.status(201).json({ message: "Club updated successfully" })
  } catch (err) {
    console.error('Update club failed', err)
    return res.status(500).json({ message: 'Failed to update club' })
  }
})

app.put('/joinClubs/:clubName', async (req, res) => {
  const clubName = req.params.clubName
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' })

  try {
    const [users] = await dbp.query('SELECT password, club FROM person WHERE username = ?', [username])
    if (users.length === 0) return res.status(404).json({ message: 'User not found' })

    const valid = await bcrypt.compare(password, users[0].password)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })
    if (users[0].club) return res.status(400).json({ message: 'Already in a club or pending' })

    const [clubs] = await dbp.query('SELECT memberCount, memberMax FROM clubs WHERE clubName = ?', [clubName])
    if (clubs.length === 0) return res.status(404).json({ message: 'Club not found' })
    if (clubs[0].memberCount >= clubs[0].memberMax) return res.status(400).json({ message: 'Club is already full' })

    await dbp.query("UPDATE person SET club = ?, role = 'STU' WHERE username = ?", [clubName, username])
    return res.json({ message: "Join request submitted" })
  } catch (err) {
    console.error('Join club failed', err)
    return res.status(500).json({ message: 'Failed to join club' })
  }
})

app.put('/expell/:username', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const username = req.params.username
  try {
    const [rows] = await dbp.query('SELECT club FROM person WHERE username = ?', [username])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (req.user.club && req.user.club !== rows[0].club) return forbidden(res)

    await dbp.query("UPDATE person SET club = NULL, role = 'STU' WHERE username = ?", [username])
    await recalcMemberCount(rows[0].club)
    await createNotification({ username, clubName: rows[0].club, type: 'membership', message: `You have been removed from ${rows[0].club}` })
    return res.json({ message: "Member expelled" })
  } catch (err) {
    console.error('Expel failed', err)
    return res.status(500).json({ message: 'Failed to expel member' })
  }
})

app.put('/accept/:username', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const username = req.params.username
  try {
    const [rows] = await dbp.query('SELECT club FROM person WHERE username = ?', [username])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (req.user.club && req.user.club !== rows[0].club) return forbidden(res)

    const [clubRows] = await dbp.query('SELECT memberCount, memberMax FROM clubs WHERE clubName = ?', [rows[0].club])
    if (clubRows.length && clubRows[0].memberCount >= clubRows[0].memberMax) return res.status(400).json({ message: 'Club is full' })

    await dbp.query("UPDATE person SET role = 'CM' WHERE username = ?", [username])
    await recalcMemberCount(rows[0].club)
    await createNotification({ username, clubName: rows[0].club, type: 'membership', message: `You have been accepted into ${rows[0].club}` })
    return res.json({ message: "Member accepted" })
  } catch (err) {
    console.error('Accept failed', err)
    return res.status(500).json({ message: 'Failed to accept member' })
  }
})

app.put('/reject/:username', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const username = req.params.username
  try {
    const [rows] = await dbp.query('SELECT club FROM person WHERE username = ?', [username])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (req.user.club && req.user.club !== rows[0].club) return forbidden(res)

    await dbp.query("UPDATE person SET club = NULL WHERE username = ?", [username])
    await recalcMemberCount(rows[0].club)
    await createNotification({ username, clubName: rows[0].club, type: 'membership', message: `Your request to join ${rows[0].club} was rejected` })
    return res.json({ message: "Membership rejected" })
  } catch (err) {
    console.error('Reject failed', err)
    return res.status(500).json({ message: 'Failed to reject member' })
  }
})

// Promote a member to VP by username
app.put('/promote/:username', requireAuth, requireRoles('CL'), async (req, res) => {
  const username = req.params.username
  try {
    const [rows] = await dbp.query('SELECT club FROM person WHERE username = ?', [username])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (req.user.club && req.user.club !== rows[0].club) return forbidden(res)

    await dbp.query("UPDATE person SET role = 'VP' WHERE username = ?", [username])
    await recalcMemberCount(rows[0].club)
    await createNotification({ username, clubName: rows[0].club, type: 'membership', message: `You have been promoted to VP in ${rows[0].club}` })
    return res.json({ message: "Member promoted" })
  } catch (err) {
    console.error('Promote failed', err)
    return res.status(500).json({ message: 'Failed to promote member' })
  }
})

// Notifications
app.get('/notifications', requireAuth, async (req, res) => {
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { created: 'createdAt', type: 'type', read: 'isRead' },
    'createdAt'
  )
  const like = `%${search}%`
  try {
    const [rows] = await dbp.query(
      `SELECT * FROM notifications WHERE username = ? AND (message LIKE ? OR type LIKE ?)
       ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [req.user.username, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE username = ? AND (message LIKE ? OR type LIKE ?)',
      [req.user.username, like, like]
    )
    return res.json({ data: rows, page, pages: Math.ceil(total / limit) || 1, total })
  } catch (err) {
    console.error('Fetch notifications failed', err)
    return res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

app.get('/notifications/unreadCount', requireAuth, async (req, res) => {
  try {
    const [[{ total }]] = await dbp.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE username = ? AND isRead = 0',
      [req.user.username]
    )
    return res.json({ total })
  } catch (err) {
    console.error('Fetch unread count failed', err)
    return res.status(500).json({ message: 'Failed to fetch unread count' })
  }
})

app.post('/notifications', requireAuth, requireRoles('CL', 'VP'), async (req, res) => {
  const { username, clubName, type, message, link } = req.body
  if (!username || !message) return res.status(400).json({ message: 'Username and message required' })
  if (clubName && req.user.club && req.user.club !== clubName) return forbidden(res)
  try {
    await createNotification({ username, clubName, type, message, link })
    return res.status(201).json({ message: 'Notification sent' })
  } catch (err) {
    console.error('Create notification failed', err)
    return res.status(500).json({ message: 'Failed to create notification' })
  }
})

app.put('/notifications/:id/read', requireAuth, async (req, res) => {
  const id = req.params.id
  try {
    const [rows] = await dbp.query('SELECT username FROM notifications WHERE notificationid = ?', [id])
    if (rows.length === 0) return res.status(404).json({ message: 'Notification not found' })
    if (rows[0].username !== req.user.username) return forbidden(res)
    await dbp.query('UPDATE notifications SET isRead = 1 WHERE notificationid = ?', [id])
    return res.json({ message: 'Notification marked as read' })
  } catch (err) {
    console.error('Update notification failed', err)
    return res.status(500).json({ message: 'Failed to update notification' })
  }
})

// Basic error handler fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error', err)
  if (res.headersSent) return next(err)
  return res.status(500).json({ message: 'Internal server error' })
})

// Start the server
app.listen(3000, () => {    
  console.log('Connected to backend on port 3000!')
})
