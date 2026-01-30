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

// Create a connection pool to the database
// USE YOUR OWN DATABASE CREDENTIALS
const db = mysql.createPool({
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'password',
    database: 'school_club_activity',
    // Ensure UTF-8 round-trip so accents (e.g. "Après-ski") render correctly
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

// Promise helper for async/await queries
const dbp = db.promise()

// Check connection to the database
dbp.query('SELECT 1')
  .then(() => console.log('Connected to MySQL via mysql2'))
  .catch(err => {
    console.error('DB connection error:', err)
    process.exit(1)
  })

// --- Auth + utilities ---
const unauthorized = res => res.status(401).json({ message: 'Authentication required' })
const forbidden = res => res.status(403).json({ message: 'Not allowed for your role/club' })

// Helper to get a user's membership in a specific club
const getMembership = async (username, clubName) => {
  if (!username || !clubName) return null
  const [rows] = await dbp.query(
    'SELECT * FROM membership WHERE username = ? AND clubName = ?',
    [username, clubName]
  )
  return rows.length > 0 ? rows[0] : null
}

// Helper to get all memberships for a user
const getUserMemberships = async (username) => {
  if (!username) return []
  const [rows] = await dbp.query(
    'SELECT * FROM membership WHERE username = ?',
    [username]
  )
  return rows
}

// Helper to check if user is a Club Leader anywhere (needed for CL join restriction)
const isClubLeaderAnywhere = async (username) => {
  if (!username) return false
  const [rows] = await dbp.query(
    "SELECT 1 FROM membership WHERE username = ? AND role = 'CL' LIMIT 1",
    [username]
  )
  return rows.length > 0
}

const requireAuth = async (req, res, next) => {
  const username = req.headers['x-username']
  const sessionId = req.headers['x-session-id']

  if (!username || !sessionId) return unauthorized(res)

  try {
    const [rows] = await dbp.query(
      'SELECT username, isAdmin FROM person WHERE username = ? AND sessionId = ?',
      [username, sessionId]
    )
    if (rows.length === 0) return unauthorized(res)
    
    // Get user's memberships
    const memberships = await getUserMemberships(username)
    
    req.user = {
      username: rows[0].username,
      isAdmin: rows[0].isAdmin === 1,
      memberships: memberships
    }
    next()
  } catch (err) {
    console.error('Auth check failed', err)
    return res.status(500).json({ message: 'Auth lookup failed' })
  }
}

// Legacy role support - for endpoints that need the old format
// Returns the "primary" role/club for backward compatibility
const getLegacyRoleInfo = (user) => {
  if (user.isAdmin) return { role: 'SA', club: null }
  if (!user.memberships || user.memberships.length === 0) return { role: 'STU', club: null }
  // Return the first membership (for backward compat - could be improved to show "primary")
  // Prioritize CL > VP > CM > STU
  const sorted = [...user.memberships].sort((a, b) => {
    const order = { CL: 0, VP: 1, CM: 2, STU: 3 }
    return (order[a.role] ?? 4) - (order[b.role] ?? 4)
  })
  return { role: sorted[0].role, club: sorted[0].clubName }
}

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res)
  const legacy = getLegacyRoleInfo(req.user)
  if (roles.length && !roles.includes(legacy.role)) return forbidden(res)
  next()
}

const requireClubMatch = clubGetter => async (req, res, next) => {
  try {
    const targetClub = clubGetter(req)
    if (!targetClub) return next()
    
    // SA can access any club
    if (req.user?.isAdmin) return next()
    
    // Check if user has any membership in the target club
    const membership = req.user?.memberships?.find(m => m.clubName === targetClub)
    if (!membership) return forbidden(res)
    
    next()
  } catch (err) {
    console.error('Club check failed', err)
    return res.status(500).json({ message: 'Club check failed' })
  }
}

const recalcMemberCount = async clubName => {
  if (!clubName) return
  await dbp.query(
    "UPDATE clubs SET memberCount = (SELECT COUNT(*) FROM membership WHERE clubName = ? AND role IN ('CL','VP','CM')) WHERE clubName = ?",
    [clubName, clubName]
  )
}

// Helper to check if user is System Administrator
const isSA = (user) => user?.isAdmin === true

// Helper to check if user can perform CL actions on a specific club
const canActAsCL = (user, clubName) => {
  if (isSA(user)) return true
  const membership = user?.memberships?.find(m => m.clubName === clubName)
  return membership?.role === 'CL'
}

// Helper to check if user can perform admin (CL/VP) actions on a specific club  
const canActAsAdmin = (user, clubName) => {
  if (isSA(user)) return true
  const membership = user?.memberships?.find(m => m.clubName === clubName)
  return ['CL', 'VP'].includes(membership?.role)
}

// Helper to check if user is member of a club
const canActAsMember = (user, clubName) => {
  if (isSA(user)) return true
  const membership = user?.memberships?.find(m => m.clubName === clubName)
  return ['CL', 'VP', 'CM'].includes(membership?.role)
}

const createNotification = async ({ username, senderUsername = null, clubName, type = 'info', message, link = null, replyTo = null }) => {
  if (!username || !message) return
  await dbp.query(
    'INSERT INTO notifications (username, senderUsername, clubName, type, message, link, replyTo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, senderUsername, clubName || null, type, message, link, replyTo]
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
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
})

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))
app.use(apiLimiter)

// Get all clubs with optional search/order/pagination (requires login)
app.get('/clubs', requireAuth, async (req, res) => {
  console.log(`GET /clubs - User: ${req.user?.username}`)
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


// Get specific club by clubName (requires login)
app.get('/clubs/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  console.log(`GET /clubs/${clubName} - User: ${req.user?.username}`)
  try {
    const [rows] = await dbp.query('SELECT * FROM clubs WHERE clubName = ?', [clubName])
    return res.json(rows)
  } catch (err) {
    console.error('Error fetching club', err)
    return res.status(500).json({ message: 'Failed to fetch club' })
  }
})

// Get specific events by clubName with optional search/order/pagination (requires login)
app.get('/events/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  console.log(`GET /events/${clubName} - User: ${req.user?.username}`)
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { startDate: 'startDate', endDate: 'endDate', title: 'title', accepted: 'accepted' },
    'startDate'
  )
  const like = `%${search}%`

  try {
    // Only CL or SA can see unaccepted events
    const canSeeUnaccepted = canActAsCL(req.user, clubName)
    const acceptedFilter = canSeeUnaccepted ? '' : ' AND accepted = 1'
    
    const [rows] = await dbp.query(
      `SELECT * FROM events WHERE clubName = ? AND (title LIKE ? OR description LIKE ?)${acceptedFilter} ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [clubName, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      `SELECT COUNT(*) AS total FROM events WHERE clubName = ? AND (title LIKE ? OR description LIKE ?)${acceptedFilter}`,
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

// Get person by clubName (requires login)
app.get('/person/:clubName', requireAuth, async (req, res) => {
    // Create the SELECT query from membership table
    const q = "SELECT username, role FROM membership WHERE clubName = ? ORDER BY FIELD(role, 'CL', 'VP', 'CM', 'STU'), username ASC"
    const clubName = req.params.clubName
    console.log(`GET /person/${clubName} - User: ${req.user?.username}`)

    try {
        const [data] = await dbp.query(q, [clubName])
        return res.json(data)
    } catch (err) {
        console.error('Error fetching members', err)
        return res.status(500).json({ message: 'Failed to fetch members' })
    }
})

// Get specific comments by clubName with optional search/order/pagination (requires login)
app.get('/comments/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  console.log(`GET /comments/${clubName} - User: ${req.user?.username}`)
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

// Get upcoming events with optional search/order/pagination (requires login)
app.get('/events', requireAuth, async (req, res) => {
  console.log(`GET /events - User: ${req.user?.username}`)
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { startDate: 'startDate', endDate: 'endDate', title: 'title', clubName: 'clubName' },
    'startDate'
  )
  const like = `%${search}%`
  const timeFilter = req.query.timeFilter
  let timeClause = ''
  if (timeFilter === 'incoming') {
    timeClause = ' AND (startDate > NOW() OR (endDate IS NOT NULL AND endDate > NOW()))'
  } else if (timeFilter === 'past') {
    timeClause = ' AND startDate <= NOW() AND (endDate IS NULL OR endDate <= NOW())'
  }
  
  try {
    const [rows] = await dbp.query(
      `SELECT * FROM events 
       WHERE accepted = 1${timeClause}
         AND (title LIKE ? OR description LIKE ? OR clubName LIKE ?)
       ORDER BY ${orderKey} ${direction}
       LIMIT ? OFFSET ?`,
      [like, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      `SELECT COUNT(*) AS total FROM events 
       WHERE accepted = 1${timeClause}
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

// Public signup (creates a STU account and logs in)
app.post('/signup', async (req, res) => {
  const { username, password } = req.body || {}
  console.log(`POST /signup - Username: ${username}`)
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })
  if (String(username).length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters' })
  if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

  try {
    const [exists] = await dbp.query('SELECT 1 FROM person WHERE username = ?', [username])
    if (exists.length > 0) return res.status(400).json({ message: 'Username already exists' })

    const hash = await bcrypt.hash(password, 10)
    await dbp.query('INSERT INTO person (username, password, isAdmin) VALUES (?, ?, 0)', [username, hash])

    // Create session immediately so the user is logged in after signup
    const sessionId = crypto.randomUUID()
    await dbp.query('UPDATE person SET sessionId = ? WHERE username = ?', [sessionId, username])

    return res.status(201).json({ username, memberships: [], sessionId })
  } catch (err) {
    console.error('Signup failed', err)
    return res.status(500).json({ message: 'Failed to create account' })
  }
})

// User login (creates a session)
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  console.log(`POST /login - Username: ${username}`)
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' })

  try {
    const [rows] = await dbp.query('SELECT username, password, isAdmin FROM person WHERE username = ?', [username])
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

    // Get user's memberships
    const memberships = await getUserMemberships(username)

    return res.json({
      username,
      isAdmin: rows[0].isAdmin === 1,
      memberships,
      sessionId
    })
  } catch (err) {
    console.error('Login failed', err)
    return res.status(500).json({ message: 'Login failed' })
  }
})

app.post('/logout', requireAuth, async (req, res) => {
  console.log(`POST /logout - User: ${req.user?.username}`)
  try {
    await dbp.query('UPDATE person SET sessionId = NULL WHERE username = ?', [req.user.username])
    return res.json({ message: 'Logged out' })
  } catch (err) {
    console.error('Logout failed', err)
    return res.status(500).json({ message: 'Logout failed' })
  }
})

// Get current session information
app.get('/session', requireAuth, async (req, res) => {
  console.log(`GET /session - User: ${req.user?.username}`)
  return res.json({
    username: req.user.username,
    isAdmin: req.user.isAdmin,
    memberships: req.user.memberships
  })
})

// Create a new club
app.post('/createClub', requireAuth, async (req, res) => {
  const { clubName, description, memberMax, bannerImage, bannerColor, initialLeader } = req.body
  console.log(`POST /createClub - User: ${req.user?.username}, Club: ${clubName}`)
  if (!clubName || !description || !memberMax) return res.status(400).json({ message: 'Missing club fields' })
  
  // SA can create clubs without being in one, but must specify initial leader
  if (isSA(req.user)) {
    if (!initialLeader) return res.status(400).json({ message: 'SA must specify an initial leader for the club' })
  } else {
    // Check if user is already a CL somewhere - CLs cannot create new clubs
    const isLeader = await isClubLeaderAnywhere(req.user.username)
    if (isLeader) return res.status(400).json({ message: 'Club Leaders cannot create new clubs' })
    
    // User must not have any confirmed memberships (CL, VP, CM) to create a club
    const confirmedMemberships = req.user.memberships.filter(m => ['CL', 'VP', 'CM'].includes(m.role))
    if (confirmedMemberships.length > 0) return res.status(400).json({ message: 'You must not be a confirmed member of any club to create a new one' })
  }
  
  const maxMembers = Number(memberMax)
  if (Number.isNaN(maxMembers) || maxMembers < 1) return res.status(400).json({ message: 'memberMax must be a positive number' })

  try {
    const [exists] = await dbp.query('SELECT 1 FROM clubs WHERE clubName = ?', [clubName])
    if (exists.length > 0) return res.status(400).json({ message: 'Club already exists' })

    if (isSA(req.user)) {
      // SA creates club - verify initial leader is valid (not already a CL, not SA)
      const [leaderRows] = await dbp.query(
        "SELECT username, isAdmin FROM person WHERE username = ?",
        [initialLeader]
      )
      if (leaderRows.length === 0) return res.status(404).json({ message: 'Initial leader not found' })
      if (leaderRows[0].isAdmin) return res.status(400).json({ message: 'Cannot assign SA as club leader' })
      
      // Check if user is already a CL somewhere
      const leaderIsCL = await isClubLeaderAnywhere(initialLeader)
      if (leaderIsCL) return res.status(400).json({ message: 'Initial leader is already a Club Leader in another club' })
      
      // Create club with memberCount=1 and assign leader via membership
      await dbp.query(
        'INSERT INTO clubs (clubName, description, memberCount, memberMax, bannerImage, bannerColor) VALUES (?, ?, ?, ?, ?, ?)',
        [clubName, description, 1, maxMembers, bannerImage || '', bannerColor || '#38bdf8']
      )
      await dbp.query('INSERT INTO membership (username, clubName, role) VALUES (?, ?, ?)', [initialLeader, clubName, 'CL'])
      
      return res.status(201).json({ message: 'Club created successfully with leader: ' + initialLeader })
    } else {
      // Regular user creates club and becomes CL
      await dbp.query(
        'INSERT INTO clubs (clubName, description, memberCount, memberMax, bannerImage, bannerColor) VALUES (?, ?, ?, ?, ?, ?)',
        [clubName, description, 1, maxMembers, bannerImage || '', bannerColor || '#38bdf8']
      )
      
      // Cancel any pending join requests first
      await dbp.query("DELETE FROM membership WHERE username = ? AND role = 'STU'", [req.user.username])
      
      // Add user as CL
      await dbp.query('INSERT INTO membership (username, clubName, role) VALUES (?, ?, ?)', [req.user.username, clubName, 'CL'])

      return res.status(201).json({ 
        message: 'Club added successfully', 
        sessionUpdate: { memberships: [{ clubName, role: 'CL' }] } 
      })
    }
  } catch (err) {
    console.error('Create club failed', err)
    return res.status(500).json({ message: 'Failed to create club' })
  }
})

// Create a new comment (anyone logged in can comment)
app.post('/comment', requireAuth, async (req, res) => {
  const { comment, rating, clubName } = req.body
  console.log(`POST /comment - User: ${req.user?.username}, Club: ${clubName}`)
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

// Get event comments with optional search/order/pagination (public - everyone can view)
app.get('/eventComments/:eventid', async (req, res) => {
  const eventid = parseInt(req.params.eventid)
  console.log(`GET /eventComments/${eventid}`)
  
  const { search, orderKey, direction, limit, page, offset } = buildPagination(
    req.query,
    { date: 'date', username: 'username' },
    'date'
  )
  const like = `%${search}%`

  try {
    // Verify event exists
    const [[event]] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [eventid])
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const [rows] = await dbp.query(
      `SELECT * FROM comments WHERE eventid = ? AND (comment LIKE ? OR username LIKE ?) ORDER BY ${orderKey} ${direction} LIMIT ? OFFSET ?`,
      [eventid, like, like, limit, offset]
    )
    const [[{ total }]] = await dbp.query(
      'SELECT COUNT(*) AS total FROM comments WHERE eventid = ? AND (comment LIKE ? OR username LIKE ?)',
      [eventid, like, like]
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
    console.error('Error fetching event comments', err)
    return res.status(500).json({ message: 'Failed to fetch event comments' })
  }
})

// Create a new event comment (requires club membership)
app.post('/eventComment', requireAuth, async (req, res) => {
  const { comment, eventid } = req.body
  console.log(`POST /eventComment - User: ${req.user?.username}, Event: ${eventid}`)
  if (!comment || !eventid) return res.status(400).json({ message: 'Comment and eventid are required' })

  try {
    // Check if user is a member of the club that owns this event
    const [[event]] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [eventid])
    if (!event) return res.status(404).json({ message: 'Event not found' })
    
    const isMember = canActAsMember(req.user, event.clubName)
    if (!isMember) return res.status(403).json({ message: 'You must be a member of this club to comment on events' })

    await dbp.query(
      'INSERT INTO comments (date, comment, rating, username, eventid) VALUES (NOW(), ?, 0, ?, ?)',
      [comment, req.user.username, eventid]
    )
    return res.json({ message: 'Event comment added successfully' })
  } catch (err) {
    console.error('Add event comment failed', err)
    return res.status(500).json({ message: 'Failed to add event comment' })
  }
})

// Delete an event comment (author or club admin)
app.delete('/eventComment/:commentid', requireAuth, async (req, res) => {
  const commentid = parseInt(req.params.commentid)
  console.log(`DELETE /eventComment/${commentid} - User: ${req.user?.username}`)
  
  try {
    const [[comment]] = await dbp.query('SELECT username, eventid FROM comments WHERE commentid = ? AND eventid IS NOT NULL', [commentid])
    if (!comment) return res.status(404).json({ message: 'Event comment not found' })
    
    // Check if user is comment author or club admin or SA
    const [[event]] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [comment.eventid])
    const isAdmin = canActAsAdmin(req.user, event.clubName)
    const isAuthor = comment.username === req.user.username
    
    if (!isAdmin && !isAuthor) return res.status(403).json({ message: 'Not authorized to delete this comment' })

    await dbp.query('DELETE FROM comments WHERE commentid = ?', [commentid])
    return res.json({ message: 'Event comment deleted successfully' })
  } catch (err) {
    console.error('Delete event comment failed', err)
    return res.status(500).json({ message: 'Failed to delete event comment' })
  }
})

// Create a new event
app.post('/createEvent', requireAuth, async (req, res) => {
  const { title, description, startDate, endDate, clubName } = req.body
  console.log(`POST /createEvent - User: ${req.user?.username}, Event: ${title}, Club: ${clubName}`)
  if (!title || !description || !startDate || !clubName) return res.status(400).json({ message: 'Missing event fields' })
  
  // Check if user can act as admin (CL/VP) for this club
  if (!canActAsAdmin(req.user, clubName)) return forbidden(res)

  try {
    // Convert datetime-local format to MySQL datetime format
    const formatDate = (date) => date ? date.replace('T', ' ') + ':00' : null
    const formattedStartDate = formatDate(startDate)
    const formattedEndDate = endDate && endDate !== '' ? formatDate(endDate) : null
    
    await dbp.query(
      'INSERT INTO events (title, description, startDate, endDate, clubName) VALUES (?, ?, ?, ?, ?)',
      [title, description, formattedStartDate, formattedEndDate, clubName]
    )
    
    // Notify club leader about the new event
    const [members] = await dbp.query(
      "SELECT username FROM membership WHERE clubName = ? AND role = 'CL'",
      [clubName]
    )
    for (const member of members) {
      await createNotification({
        username: member.username,
        clubName: clubName,
        type: 'event',
        message: `New event "${title}" has been created for ${clubName}`,
        link: `/ClubPage/${clubName}`
      })
    }
    
    return res.json({ message: 'Event added successfully' })
  } catch (err) {
    console.error('Create event failed', err)
    return res.status(500).json({ message: 'Failed to create event', error: err.message })
  }
})

// Delete a club by clubName and reset members
app.delete('/clubs/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  console.log(`DELETE /clubs/${clubName} - User: ${req.user?.username}`)
  
  // Only CL of this club or SA can delete
  if (!canActAsCL(req.user, clubName)) return forbidden(res)
  
  try {
    // Delete all memberships for this club (cascade will handle, but be explicit)
    await dbp.query("DELETE FROM membership WHERE clubName = ?", [clubName])
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
  console.log(`DELETE /comment/${commentId} - User: ${req.user?.username}`)
  try {
    const [rows] = await dbp.query('SELECT username, clubName FROM comments WHERE commentid = ?', [commentId])
    if (rows.length === 0) return res.status(404).json({ message: 'Comment not found' })
    const comment = rows[0]

    const isOwner = comment.username === req.user.username
    const isClubAdmin = canActAsAdmin(req.user, comment.clubName)

    if (!isOwner && !isClubAdmin) return forbidden(res)

    await dbp.query("DELETE FROM comments WHERE commentid = ?", [commentId])
    return res.json({ message: "Comment deleted successfully" })
  } catch (err) {
    console.error('Delete comment failed', err)
    return res.status(500).json({ message: 'Failed to delete comment' })
  }
})

// Delete a event by eventId
app.delete('/event/:eventid', requireAuth, async (req, res) => {
  const eventId = req.params.eventid
  console.log(`DELETE /event/${eventId} - User: ${req.user?.username}`)
  try {
    const [rows] = await dbp.query('SELECT clubName FROM events WHERE eventid = ?', [eventId])
    if (rows.length === 0) return res.status(404).json({ message: 'Event not found' })
    
    // Check if user can act as admin for this club
    if (!canActAsAdmin(req.user, rows[0].clubName)) return forbidden(res)

    await dbp.query("DELETE FROM events WHERE eventid = ?", [eventId])
    return res.json({ message: "Event deleted successfully" })
  } catch (err) {
    console.error('Delete event failed', err)
    return res.status(500).json({ message: 'Failed to delete event' })
  }
})

// Accept a event by eventId (CL or SA only per user story)
app.put('/event/:eventid', requireAuth, async (req, res) => {
  const eventId = req.params.eventid
  console.log(`PUT /event/${eventId} - User: ${req.user?.username} - Accepting event`)
  try {
    const [rows] = await dbp.query('SELECT clubName, title FROM events WHERE eventid = ?', [eventId])
    if (rows.length === 0) return res.status(404).json({ message: 'Event not found' })
    
    // Only CL of this club or SA can accept events
    if (!canActAsCL(req.user, rows[0].clubName)) return forbidden(res)
    
    const clubName = rows[0].clubName
    const eventTitle = rows[0].title
    
    await dbp.query("UPDATE events SET accepted = 1 WHERE eventid = ?", [eventId])
    
    // Notify all club members about the accepted event
    const [members] = await dbp.query(
      "SELECT username FROM membership WHERE clubName = ? AND role IN ('CL', 'VP', 'CM')",
      [clubName]
    )
    for (const member of members) {
      await createNotification({
        username: member.username,
        clubName: clubName,
        type: 'event',
        message: `Event "${eventTitle}" has been created for ${clubName}`,
        link: `/ClubPage/${clubName}`
      })
    }
    
    return res.json({ message: "Event accepted successfully" })
  } catch (err) {
    console.error('Accept event failed', err)
    return res.status(500).json({ message: 'Failed to accept event' })
  }
})

// Update club details (only CL or SA can change description and memberMax)
app.post('/updateClub/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  const { description, memberMax, bannerImage, bannerColor } = req.body
  console.log(`POST /updateClub/${clubName} - User: ${req.user?.username}`)
  
  // Only CL of this club or SA can update
  if (!canActAsCL(req.user, clubName)) return forbidden(res)
  
  if (!memberMax) return res.status(400).json({ message: 'Missing fields' })
  const maxMembers = Number(memberMax)
  if (Number.isNaN(maxMembers) || maxMembers < 1) return res.status(400).json({ message: 'memberMax must be positive' })

  try {
    const [rows] = await dbp.query('SELECT memberCount FROM clubs WHERE clubName = ?', [clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'Club not found' })
    if (rows[0].memberCount > maxMembers) return res.status(400).json({ message: 'Member max cannot be below current members' })

    await dbp.query(
      'UPDATE clubs SET description = ?, memberMax = ?, bannerImage = ?, bannerColor = ? WHERE clubName = ?',
      [description || '', maxMembers, bannerImage || '', bannerColor || '#38bdf8', clubName]
    )
    return res.status(201).json({ message: "Club updated successfully" })
  } catch (err) {
    console.error('Update club failed', err)
    return res.status(500).json({ message: 'Failed to update club' })
  }
})

app.put('/joinClubs/:clubName', requireAuth, async (req, res) => {
  const clubName = req.params.clubName
  console.log(`PUT /joinClubs/${clubName} - User: ${req.user?.username}`)

  try {
    // Check if user is already a CL in any club - CLs cannot join other clubs
    const isLeader = await isClubLeaderAnywhere(req.user.username)
    if (isLeader) return res.status(400).json({ message: 'Club Leaders cannot join other clubs. Transfer leadership first.' })
    
    // Check if user already has a membership in this club
    const existingMembership = req.user.memberships.find(m => m.clubName === clubName)
    if (existingMembership) return res.status(400).json({ message: 'Already a member or pending in this club' })
    
    // Check if user has reached the maximum of 3 pending requests
    const pendingRequests = req.user.memberships.filter(m => m.role === 'STU')
    if (pendingRequests.length >= 3) {
      return res.status(400).json({ message: 'You already have 3 pending requests. Please cancel one before request joining another club.' })
    }

    const [clubs] = await dbp.query('SELECT memberCount, memberMax FROM clubs WHERE clubName = ?', [clubName])
    if (clubs.length === 0) return res.status(404).json({ message: 'Club not found' })
    if (clubs[0].memberCount >= clubs[0].memberMax) return res.status(400).json({ message: 'Club is already full' })

    // Create a pending membership (STU role)
    await dbp.query("INSERT INTO membership (username, clubName, role) VALUES (?, ?, 'STU')", [req.user.username, clubName])
    
    // Return updated session
    const updatedMemberships = [...req.user.memberships, { username: req.user.username, clubName, role: 'STU' }]
    return res.json({ message: "Join request submitted", sessionUpdate: { memberships: updatedMemberships } })
  } catch (err) {
    console.error('Join club failed', err)
    return res.status(500).json({ message: 'Failed to join club' })
  }
})

app.put('/expell/:username', requireAuth, async (req, res) => {
  const username = req.params.username
  const { clubName } = req.body // Need to specify which club to expel from
  console.log(`PUT /expell/${username} - User: ${req.user?.username}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const [rows] = await dbp.query('SELECT * FROM membership WHERE username = ? AND clubName = ?', [username, clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found in this club' })
    
    // Check if user can act as admin for this club
    if (!canActAsAdmin(req.user, clubName)) return forbidden(res)

    await dbp.query("DELETE FROM membership WHERE username = ? AND clubName = ?", [username, clubName])
    await recalcMemberCount(clubName)
    await createNotification({ username, clubName, type: 'membership', message: `You have been removed from ${clubName}` })
    return res.json({ message: "Member expelled" })
  } catch (err) {
    console.error('Expel failed', err)
    return res.status(500).json({ message: 'Failed to expel member' })
  }
})

app.put('/accept/:username', requireAuth, async (req, res) => {
  const username = req.params.username
  const { clubName } = req.body // Need to specify which club
  console.log(`PUT /accept/${username} - User: ${req.user?.username}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const [rows] = await dbp.query('SELECT * FROM membership WHERE username = ? AND clubName = ?', [username, clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found in this club' })
    if (rows[0].role !== 'STU') return res.status(400).json({ message: 'User is not pending' })
    
    // Check if user can act as admin for this club
    if (!canActAsAdmin(req.user, clubName)) return forbidden(res)

    const [clubRows] = await dbp.query('SELECT memberCount, memberMax FROM clubs WHERE clubName = ?', [clubName])
    if (clubRows.length && clubRows[0].memberCount >= clubRows[0].memberMax) return res.status(400).json({ message: 'Club is full' })

    await dbp.query("UPDATE membership SET role = 'CM' WHERE username = ? AND clubName = ?", [username, clubName])
    await recalcMemberCount(clubName)
    await createNotification({ username, clubName, type: 'membership', message: `You have been accepted into ${clubName}` })
    return res.json({ message: "Member accepted" })
  } catch (err) {
    console.error('Accept failed', err)
    return res.status(500).json({ message: 'Failed to accept member' })
  }
})

app.put('/reject/:username', requireAuth, async (req, res) => {
  const username = req.params.username
  const { clubName } = req.body // Need to specify which club
  console.log(`PUT /reject/${username} - User: ${req.user?.username}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const [rows] = await dbp.query('SELECT * FROM membership WHERE username = ? AND clubName = ?', [username, clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found in this club' })
    
    // Check if user can act as admin for this club
    if (!canActAsAdmin(req.user, clubName)) return forbidden(res)

    await dbp.query("DELETE FROM membership WHERE username = ? AND clubName = ?", [username, clubName])
    await createNotification({ username, clubName, type: 'membership', message: `Your request to join ${clubName} was rejected` })
    return res.json({ message: "Membership rejected" })
  } catch (err) {
    console.error('Reject failed', err)
    return res.status(500).json({ message: 'Failed to reject member' })
  }
})

// Cancel own pending join request
app.delete('/cancelJoinRequest', requireAuth, async (req, res) => {
  const { clubName } = req.body // Optionally specify club, or cancel all pending
  console.log(`DELETE /cancelJoinRequest - User: ${req.user?.username}, Club: ${clubName || 'all'}`)
  try {
    // Find pending memberships (role = STU)
    const pendingMemberships = req.user.memberships.filter(m => m.role === 'STU')
    if (pendingMemberships.length === 0) {
      return res.status(400).json({ message: 'No pending join request to cancel' })
    }

    if (clubName) {
      // Cancel specific club request
      const pending = pendingMemberships.find(m => m.clubName === clubName)
      if (!pending) return res.status(400).json({ message: 'No pending join request for this club' })
      await dbp.query("DELETE FROM membership WHERE username = ? AND clubName = ? AND role = 'STU'", [req.user.username, clubName])
    } else {
      // Cancel all pending requests
      await dbp.query("DELETE FROM membership WHERE username = ? AND role = 'STU'", [req.user.username])
    }
    
    return res.json({ message: "Join request cancelled" })
  } catch (err) {
    console.error('Cancel request failed', err)
    return res.status(500).json({ message: 'Failed to cancel join request' })
  }
})

// Quit club (for CM and VP members)
app.delete('/quitClub', requireAuth, async (req, res) => {
  const { clubName } = req.body // Need to specify which club to quit
  console.log(`DELETE /quitClub - User: ${req.user?.username}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const membership = req.user.memberships.find(m => m.clubName === clubName)
    if (!membership) return res.status(400).json({ message: 'You are not in this club' })
    
    if (membership.role === 'CL') {
      return res.status(403).json({ message: 'Club Leaders cannot quit. Transfer leadership first or delete the club.' })
    }
    if (membership.role === 'STU') {
      return res.status(400).json({ message: 'Use cancel join request instead' })
    }

    await dbp.query("DELETE FROM membership WHERE username = ? AND clubName = ?", [req.user.username, clubName])
    await recalcMemberCount(clubName)
    return res.json({ message: "Successfully quit the club" })
  } catch (err) {
    console.error('Quit club failed', err)
    return res.status(500).json({ message: 'Failed to quit club' })
  }
})

// Promote a member to VP or demote VP to CM by username
app.put('/promote/:username', requireAuth, async (req, res) => {
  const username = req.params.username
  const { action, clubName } = req.body // 'promote' or 'demote', and which club
  console.log(`PUT /promote/${username} - User: ${req.user?.username}, Action: ${action}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const [rows] = await dbp.query('SELECT * FROM membership WHERE username = ? AND clubName = ?', [username, clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found in this club' })
    
    // Only CL of this club or SA can promote/demote
    if (!canActAsCL(req.user, clubName)) return forbidden(res)

    let newRole, message
    if (action === 'demote' && rows[0].role === 'VP') {
      newRole = 'CM'
      message = `You have been demoted to member in ${clubName}`
    } else {
      newRole = 'VP'
      message = `You have been promoted to VP in ${clubName}`
    }

    await dbp.query("UPDATE membership SET role = ? WHERE username = ? AND clubName = ?", [newRole, username, clubName])
    await recalcMemberCount(clubName)
    await createNotification({ username, clubName, type: 'membership', message })
    return res.json({ message: action === 'demote' ? "Member demoted" : "Member promoted" })
  } catch (err) {
    console.error('Promote/demote failed', err)
    return res.status(500).json({ message: 'Failed to promote/demote member' })
  }
})

// Transfer club leadership (CL or SA only)
app.put('/transferLeadership/:username', requireAuth, async (req, res) => {
  const newLeaderUsername = req.params.username
  const { clubName } = req.body // Need to specify which club
  console.log(`PUT /transferLeadership/${newLeaderUsername} - User: ${req.user?.username}, Club: ${clubName}`)
  try {
    if (!clubName) return res.status(400).json({ message: 'Club name required' })
    
    const [rows] = await dbp.query('SELECT * FROM membership WHERE username = ? AND clubName = ?', [newLeaderUsername, clubName])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found in this club' })
    
    // Check if the new leader has memberships in other clubs
    // A CL can only be enrolled in their own club, not in any other club
    const otherMemberships = await getUserMemberships(newLeaderUsername)
    const hasOtherClubs = otherMemberships.some(m => m.clubName !== clubName)
    if (hasOtherClubs) {
      return res.status(400).json({ message: 'User is enrolled in other clubs. A Club Leader can only be a member of their own club.' })
    }
    
    // SA can transfer leadership for any club, CL only for their own club
    if (isSA(req.user)) {
      // SA is transferring - they don't become VP
      if (!['CM', 'VP'].includes(rows[0].role)) return res.status(400).json({ message: 'User must be a club member (CM or VP)' })
      
      // Get current CL of the target club
      const [[currentCL]] = await dbp.query("SELECT username FROM membership WHERE clubName = ? AND role = 'CL'", [clubName])
      
      // Transfer leadership: new leader becomes CL, old leader becomes VP
      await dbp.query("UPDATE membership SET role = 'CL' WHERE username = ? AND clubName = ?", [newLeaderUsername, clubName])
      if (currentCL) {
        await dbp.query("UPDATE membership SET role = 'VP' WHERE username = ? AND clubName = ?", [currentCL.username, clubName])
      }
      
      await createNotification({ 
        username: newLeaderUsername, 
        clubName, 
        type: 'membership', 
        message: `You are now the Club Leader of ${clubName}` 
      })
      
      return res.json({ message: 'Leadership transferred successfully' })
    }
    
    // Regular CL transfer
    const currentUserMembership = req.user.memberships.find(m => m.clubName === clubName)
    if (!currentUserMembership || currentUserMembership.role !== 'CL') return forbidden(res)
    if (!['CM', 'VP'].includes(rows[0].role)) return res.status(400).json({ message: 'User must be a club member (CM or VP)' })
    if (newLeaderUsername === req.user.username) return res.status(400).json({ message: 'Cannot transfer leadership to yourself' })

    // Transfer leadership: new leader becomes CL, old leader becomes VP
    await dbp.query("UPDATE membership SET role = 'CL' WHERE username = ? AND clubName = ?", [newLeaderUsername, clubName])
    await dbp.query("UPDATE membership SET role = 'VP' WHERE username = ? AND clubName = ?", [req.user.username, clubName])
    
    await createNotification({ 
      username: newLeaderUsername, 
      clubName, 
      type: 'membership', 
      message: `You are now the Club Leader of ${clubName}` 
    })
    
    return res.json({ 
      message: "Leadership transferred successfully"
    })
  } catch (err) {
    console.error('Transfer leadership failed', err)
    return res.status(500).json({ message: 'Failed to transfer leadership' })
  }
})

// Notifications
app.get('/notifications', requireAuth, async (req, res) => {
  console.log(`GET /notifications - User: ${req.user?.username}, Mailbox: ${req.query.mailbox || 'inbox'}`)
  const { search, limit, page, offset } = buildPagination(
    req.query,
    { created: 'createdAt', type: 'type', read: 'isRead' },
    'createdAt'
  )
  // Handle groupBy and order separately
  // groupBy determines primary sort field, order determines direction (newest/oldest = desc/asc)
  const groupByMap = { created: 'createdAt', type: 'type', read: 'isRead' }
  const groupByField = groupByMap[req.query.groupBy] || 'createdAt'
  const direction = req.query.order === 'asc' ? 'ASC' : 'DESC'
  // For groupBy, we sort by the group field first, then by date within the group
  // If groupBy is 'created' (date), we just sort by date
  // If groupBy is 'type' or 'read', we sort by that field (fixed order), then by date as secondary
  const orderKey = groupByField
  // Build ORDER BY clause: primary sort by groupBy field (fixed), secondary by date (user direction)
  const buildOrderBy = (prefix = 'n.', usesLastReplyTime = false) => {
    const dateField = usesLastReplyTime ? 'lastReplyTime' : `${prefix}createdAt`
    if (groupByField === 'createdAt') {
      // Group by date: just sort by date with user's direction
      return `${dateField} ${direction}`
    }
    // Group by type: alphabetical order (ASC) - email, event, membership
    // Group by read: unread first (ASC) - 0 (unread) before 1 (read)
    // The date within each group uses the user's direction (newest/oldest)
    const groupDirection = 'ASC'
    return `${prefix}${groupByField} ${groupDirection}, ${dateField} ${direction}`
  }
  
  const like = `%${search}%`
  const unreadFilter = req.query.unread === 'true' ? ' AND isRead = 0' : ''
  // For mixed mailboxes (all/inbox), need different filter to handle club-wide notifications
  // For club-wide: check notification_reads.readAt IS NULL (unread) or readAt IS NOT NULL (read)
  // Also exclude sent club-wide emails from unread filter (sender should see them as read)
  const mixedUnreadFilter = req.query.unread === 'true' 
    ? ' AND ((n.username IS NOT NULL AND n.isRead = 0) OR (n.username IS NULL AND nr_check.readAt IS NULL AND n.senderUsername != ?))' 
    : ''
  const mailbox = req.query.mailbox || 'inbox'
  
  try {
    let rows, total
    
    if (mailbox === 'conversation') {
      // Show conversations - only parent emails with replies
      // username check: person-to-person (username set) or sent by user (any email type)
      const [convRows] = await dbp.query(
        `SELECT DISTINCT n.*, 1 as recipientCount,
                COALESCE((SELECT MAX(r.createdAt) FROM notifications r WHERE r.replyTo = n.notificationid), n.createdAt) as lastReplyTime
         FROM notifications n
         WHERE ((n.username = ? AND n.type = 'email') OR (n.senderUsername = ? AND n.type = 'email'))
           AND (n.message LIKE ? OR n.type LIKE ?)${unreadFilter}
           AND n.replyTo IS NULL
           AND EXISTS(SELECT 1 FROM notifications r WHERE r.replyTo = n.notificationid)
         ORDER BY ${buildOrderBy('n.', true)} LIMIT ? OFFSET ?`,
        [req.user.username, req.user.username, like, like, limit, offset]
      )
      const [[{ total: convTotal }]] = await dbp.query(
        `SELECT COUNT(DISTINCT n.notificationid) AS total
         FROM notifications n
         WHERE ((n.username = ? AND n.type = 'email') OR (n.senderUsername = ? AND n.type = 'email'))
           AND (n.message LIKE ? OR n.type LIKE ?)${unreadFilter}
           AND n.replyTo IS NULL
           AND EXISTS(SELECT 1 FROM notifications r WHERE r.replyTo = n.notificationid)`,
        [req.user.username, req.user.username, like, like]
      )
      rows = convRows
      total = convTotal
    } else if (mailbox === 'sent') {
      // Show sent person-to-person emails - all sent parent messages + conversations with at least one sent message (no club-wide)
      // When filtering by unread, sent items should not appear (sender always considers them "read")
      if (req.query.unread === 'true') {
        rows = []
        total = 0
      } else {
      const [sentRows] = await dbp.query(
        `SELECT DISTINCT n.*, 1 as recipientCount,
                COALESCE((SELECT MAX(r.createdAt) FROM notifications r WHERE r.replyTo = n.notificationid), n.createdAt) as lastReplyTime
         FROM notifications n
         WHERE n.replyTo IS NULL
           AND (n.message LIKE ? OR n.type LIKE ?)
           AND (
             n.senderUsername = ? 
             OR EXISTS(
               SELECT 1 FROM notifications r 
               WHERE r.replyTo = n.notificationid AND r.senderUsername = ?
             )
           )
         ORDER BY ${buildOrderBy('n.', true)} LIMIT ? OFFSET ?`,
        [like, like, req.user.username, req.user.username, limit, offset]
      )
      const [[{ total: sentTotal }]] = await dbp.query(
        `SELECT COUNT(DISTINCT n.notificationid) AS total FROM notifications n
         WHERE n.replyTo IS NULL
           AND (n.message LIKE ? OR n.type LIKE ?)
           AND (
             n.senderUsername = ? 
             OR EXISTS(
               SELECT 1 FROM notifications r 
               WHERE r.replyTo = n.notificationid AND r.senderUsername = ?
             )
           )`,
        [like, like, req.user.username, req.user.username]
      )
      rows = sentRows
      total = sentTotal
      }
    } else if (mailbox === 'club') {
      // Show club-wide emails that user was a recipient of OR sent (based on notification_reads and senderUsername)
      // readAt IS NULL = unread, readAt IS NOT NULL = read
      // For sent emails, sender should always see them as read (exclude from unread filter)
      // Key: when sender has no notification_reads entry, nr.readAt is NULL, but we still want to exclude sent items
      const clubUnreadFilter = req.query.unread === 'true' ? ' AND nr.readAt IS NULL AND n.senderUsername != ?' : ''
      const clubUnreadParams = req.query.unread === 'true' 
        ? [req.user.username, like, like, req.user.username, req.user.username, limit, offset]
        : [req.user.username, like, like, req.user.username, limit, offset]
      const [clubRows] = await dbp.query(
        `SELECT n.*, 1 as recipientCount, (nr.readAt IS NOT NULL) as isReadByUser
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notificationid = n.notificationid AND nr.username = ?
         WHERE n.replyTo IS NULL
           AND (n.message LIKE ? OR n.type LIKE ?)${clubUnreadFilter}
           AND n.username IS NULL
           AND n.type != 'report'
           AND (nr.username IS NOT NULL OR n.senderUsername = ?)
         ORDER BY ${buildOrderBy('n.', false)} LIMIT ? OFFSET ?`,
        clubUnreadParams
      )
      const clubCountParams = req.query.unread === 'true' 
        ? [req.user.username, like, like, req.user.username, req.user.username]
        : [req.user.username, like, like, req.user.username]
      const [[{ total: clubTotal }]] = await dbp.query(
        `SELECT COUNT(DISTINCT n.notificationid) AS total 
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notificationid = n.notificationid AND nr.username = ?
         WHERE n.replyTo IS NULL
           AND (n.message LIKE ? OR n.type LIKE ?)${clubUnreadFilter}
           AND n.username IS NULL
           AND n.type != 'report'
           AND (nr.username IS NOT NULL OR n.senderUsername = ?)`,
        clubCountParams
      )
      // Map isReadByUser to isRead for consistency with frontend
      // For sent club-wide emails, mark as read since sender sent it
      rows = clubRows.map(row => ({ 
        ...row, 
        isRead: row.senderUsername === req.user.username ? 1 : (row.isReadByUser ? 1 : 0) 
      }))
      total = clubTotal
    } else if (mailbox === 'report') {
      // Only SA can view reports - show all report notifications
      if (!isSA(req.user)) {
        return res.status(403).json({ message: 'Only System Administrators can view reports' })
      }
      // For sent reports, sender should always see them as read (exclude from unread filter)
      const reportUnreadFilter = req.query.unread === 'true' ? ' AND nr.readAt IS NULL AND n.senderUsername != ?' : ''
      const reportParams = req.query.unread === 'true'
        ? [req.user.username, like, like, req.user.username, req.user.username, limit, offset]
        : [req.user.username, like, like, req.user.username, limit, offset]
      const [reportRows] = await dbp.query(
        `SELECT n.*, 1 as recipientCount, (nr.readAt IS NOT NULL) as isReadByUser
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notificationid = n.notificationid AND nr.username = ?
         WHERE n.replyTo IS NULL
           AND n.type = 'report'
           AND (n.message LIKE ? OR n.type LIKE ?)${reportUnreadFilter}
           AND (nr.username IS NOT NULL OR n.senderUsername = ?)
         ORDER BY ${buildOrderBy('n.', false)} LIMIT ? OFFSET ?`,
        reportParams
      )
      const reportCountParams = req.query.unread === 'true'
        ? [req.user.username, like, like, req.user.username, req.user.username]
        : [req.user.username, like, like, req.user.username]
      const [[{ total: reportTotal }]] = await dbp.query(
        `SELECT COUNT(DISTINCT n.notificationid) AS total 
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notificationid = n.notificationid AND nr.username = ?
         WHERE n.replyTo IS NULL
           AND n.type = 'report'
           AND (n.message LIKE ? OR n.type LIKE ?)${reportUnreadFilter}
           AND (nr.username IS NOT NULL OR n.senderUsername = ?)`,
        reportCountParams
      )
      rows = reportRows.map(row => ({ 
        ...row, 
        isRead: row.senderUsername === req.user.username ? 1 : (row.isReadByUser ? 1 : 0) 
      }))
      total = reportTotal
    } else if (mailbox === 'all') {
      // Show both inbox and sent - all messages user is involved in
      // For club-wide: check notification_reads table (readAt IS NULL = unread)
      // Parameter order: isReadByUser subquery, LEFT JOIN, 2x LIKE, [mixedUnreadFilter if unread], username=?, senderUsername=?, EXISTS r.username, EXISTS r.senderUsername
      const allParams = req.query.unread === 'true' 
        ? [req.user.username, req.user.username, like, like, req.user.username, req.user.username, req.user.username, req.user.username, req.user.username]
        : [req.user.username, req.user.username, like, like, req.user.username, req.user.username, req.user.username, req.user.username]
      const [allRows] = await dbp.query(
        `SELECT DISTINCT n.*, 1 as recipientCount,
                COALESCE((SELECT MAX(r.createdAt) FROM notifications r WHERE r.replyTo = n.notificationid), n.createdAt) as lastReplyTime,
                CASE WHEN n.username IS NULL THEN (SELECT nr.readAt IS NOT NULL FROM notification_reads nr WHERE nr.notificationid = n.notificationid AND nr.username = ?) ELSE n.isRead END as isReadByUser
         FROM notifications n
         LEFT JOIN notification_reads nr_check ON n.username IS NULL AND nr_check.notificationid = n.notificationid AND nr_check.username = ?
         WHERE n.replyTo IS NULL
           AND n.type != 'report'
           AND (n.message LIKE ? OR n.type LIKE ?)${mixedUnreadFilter}
           AND (
             n.username = ? 
             OR n.senderUsername = ?
             OR (n.username IS NULL AND nr_check.username IS NOT NULL)
             OR EXISTS(
               SELECT 1 FROM notifications r 
               WHERE r.replyTo = n.notificationid 
               AND (r.username = ? OR r.senderUsername = ?)
             )
           )
         ORDER BY ${buildOrderBy('n.', true)}`,
        allParams
      )
      rows = allRows.slice(offset, offset + limit).map(row => ({ ...row, isRead: row.isReadByUser ? 1 : 0 }))
      total = allRows.length
    } else {
      // Default: inbox - all received person-to-person messages + conversations with at least one received message + club-wide emails user received
      // For club-wide: check notification_reads table (readAt IS NULL = unread)
      // Params: isReadByUser subquery, LEFT JOIN, 2x LIKE, [mixedUnreadFilter if unread], username=?, EXISTS username, limit, offset
      const inboxParams = req.query.unread === 'true' 
        ? [req.user.username, req.user.username, like, like, req.user.username, req.user.username, req.user.username, limit, offset]
        : [req.user.username, req.user.username, like, like, req.user.username, req.user.username, limit, offset]
      const [inboxRows] = await dbp.query(
        `SELECT DISTINCT n.*, 1 as recipientCount,
                COALESCE((SELECT MAX(r.createdAt) FROM notifications r WHERE r.replyTo = n.notificationid), n.createdAt) as lastReplyTime,
                CASE WHEN n.username IS NULL THEN (SELECT nr.readAt IS NOT NULL FROM notification_reads nr WHERE nr.notificationid = n.notificationid AND nr.username = ?) ELSE n.isRead END as isReadByUser
         FROM notifications n
         LEFT JOIN notification_reads nr_check ON n.username IS NULL AND nr_check.notificationid = n.notificationid AND nr_check.username = ?
         WHERE n.replyTo IS NULL
           AND n.type != 'report'
           AND (n.message LIKE ? OR n.type LIKE ?)${mixedUnreadFilter}
           AND (
             n.username = ? 
             OR EXISTS(
               SELECT 1 FROM notifications r 
               WHERE r.replyTo = n.notificationid AND r.username = ?
             )
             OR (n.username IS NULL AND nr_check.username IS NOT NULL)
           )
         ORDER BY ${buildOrderBy('n.', true)} LIMIT ? OFFSET ?`,
        inboxParams
      )
      // Params: LEFT JOIN, 2x LIKE, [mixedUnreadFilter if unread], username=?, EXISTS username
      const inboxCountParams = req.query.unread === 'true' 
        ? [req.user.username, like, like, req.user.username, req.user.username, req.user.username]
        : [req.user.username, like, like, req.user.username, req.user.username]
      const [[{ total: inboxTotal }]] = await dbp.query(
        `SELECT COUNT(DISTINCT n.notificationid) AS total 
         FROM notifications n
         LEFT JOIN notification_reads nr_check ON n.username IS NULL AND nr_check.notificationid = n.notificationid AND nr_check.username = ?
         WHERE n.replyTo IS NULL
           AND n.type != 'report'
           AND (n.message LIKE ? OR n.type LIKE ?)${mixedUnreadFilter}
           AND (
             n.username = ? 
             OR EXISTS(
               SELECT 1 FROM notifications r 
               WHERE r.replyTo = n.notificationid AND r.username = ?
             )
             OR (n.username IS NULL AND nr_check.username IS NOT NULL)
           )`,
        inboxCountParams
      )
      rows = inboxRows.map(row => ({ ...row, isRead: row.isReadByUser ? 1 : 0 }))
      total = inboxTotal
    }
    
    // Fetch replies for each notification
    for (const row of rows) {
      const [replies] = await dbp.query(
        'SELECT * FROM notifications WHERE replyTo = ? ORDER BY createdAt ASC',
        [row.notificationid]
      )
      row.replies = replies
      
      // For conversations, update createdAt to use lastReplyTime (calculated in SQL query)
      if (row.lastReplyTime) {
        row.createdAt = row.lastReplyTime
        delete row.lastReplyTime // Remove the helper field
      }
    }
    
    // Re-sort the rows after updating timestamps, respecting groupBy field
    rows.sort((a, b) => {
      // If groupBy is type or read, sort by that field first (ascending), then by date
      if (groupByField === 'type') {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type) // alphabetical: email < event < membership
        }
      } else if (groupByField === 'isRead') {
        // For sent items (including club-wide), treat as "read" from sender's perspective
        const aRead = (a.isRead || a.senderUsername === req.user.username) ? 1 : 0
        const bRead = (b.isRead || b.senderUsername === req.user.username) ? 1 : 0
        if (aRead !== bRead) {
          return aRead - bRead // unread (0) first, then read (1)
        }
      }
      // Secondary sort by date
      const dateA = new Date(a.createdAt)
      const dateB = new Date(b.createdAt)
      return direction === 'DESC' ? dateB - dateA : dateA - dateB
    })
    
    return res.json({ data: rows, page, pages: Math.ceil(total / limit) || 1, total })
  } catch (err) {
    console.error('Fetch notifications failed', err)
    return res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

app.get('/notifications/unreadCount', requireAuth, async (req, res) => {
  console.log(`GET /notifications/unreadCount - User: ${req.user?.username}`)
  try {
    // Count individual notifications that are unread (excludes reports)
    const [[{ individualCount }]] = await dbp.query(
      `SELECT COUNT(DISTINCT COALESCE(replyTo, notificationid)) AS individualCount 
       FROM notifications 
       WHERE username = ? AND isRead = 0`,
      [req.user.username]
    )
    
    // Count club-wide and report notifications that user received but hasn't read (readAt IS NULL)
    // This includes both club-wide emails and reports sent to admins
    const [[{ clubCount }]] = await dbp.query(
      `SELECT COUNT(*) AS clubCount 
       FROM notification_reads nr
       INNER JOIN notifications n ON n.notificationid = nr.notificationid
       WHERE nr.username = ? 
         AND nr.readAt IS NULL
         AND n.username IS NULL`,
      [req.user.username]
    )
    
    return res.json({ total: individualCount + clubCount })
  } catch (err) {
    console.error('Fetch unread count failed', err)
    return res.status(500).json({ message: 'Failed to fetch unread count' })
  }
})

app.post('/notifications', requireAuth, async (req, res) => {
  const { username, clubName, type, message, link } = req.body
  console.log(`POST /notifications - User: ${req.user?.username}, To: ${username}`)
  if (!username || !message) return res.status(400).json({ message: 'Username and message required' })
  
  // SA can send to any club, CL/VP only to their own clubs
  if (!isSA(req.user) && !canActAsAdmin(req.user, clubName)) return forbidden(res)
  
  try {
    await createNotification({ username, clubName, type, message, link })
    return res.status(201).json({ message: 'Notification sent' })
  } catch (err) {
    console.error('Create notification failed', err)
    return res.status(500).json({ message: 'Failed to create notification' })
  }
})

app.post('/replyEmail', requireAuth, async (req, res) => {
  const { replyTo, message } = req.body
  console.log(`POST /replyEmail - User: ${req.user?.username}, ReplyTo: ${replyTo}`)
  if (!message || !replyTo) return res.status(400).json({ message: 'Message and replyTo required' })
  
  try {
    // Get the original notification to determine recipient
    const [[original]] = await dbp.query(
      'SELECT * FROM notifications WHERE notificationid = ?',
      [replyTo]
    )
    if (!original) return res.status(404).json({ message: 'Original notification not found' })
    
    // Prevent nested replies - can only reply to parent emails
    if (original.replyTo) {
      return res.status(400).json({ message: 'Cannot reply to a reply. Please reply to the original message.' })
    }
    
    // Verify this is a person-to-person email
    // Club-wide emails have username = NULL, person-to-person have username set
    if (original.type !== 'email') {
      return res.status(400).json({ message: 'Can only reply to email notifications' })
    }
    
    if (!original.username) {
      return res.status(400).json({ message: 'Cannot reply to club-wide emails' })
    }
    
    // Determine recipient: if current user is the original sender, reply to the recipient; otherwise reply to the sender
    const recipient = original.senderUsername === req.user.username ? original.username : original.senderUsername
    
    if (!recipient) return res.status(400).json({ message: 'Unable to determine reply recipient' })
    
    // Mark the parent notification as unread for the recipient
    await dbp.query(
      'UPDATE notifications SET isRead = 0 WHERE notificationid = ? AND username = ?',
      [replyTo, recipient]
    )
    
    // Create reply notification
    await createNotification({
      username: recipient,
      senderUsername: req.user.username,
      clubName: null,
      type: 'email',
      message: message,
      link: null,
      replyTo: replyTo
    })
    
    return res.status(201).json({ message: 'Reply sent successfully' })
  } catch (err) {
    console.error('Reply email failed', err)
    return res.status(500).json({ message: 'Failed to send reply' })
  }
})

app.post('/sendEmail', requireAuth, async (req, res) => {
  const { recipient, message, sendToAllClub, sendReport, type, link, targetClub } = req.body
  console.log(`POST /sendEmail - User: ${req.user?.username}, To: ${sendReport ? 'All admins' : sendToAllClub ? 'All club' : recipient}`)
  if (!message) return res.status(400).json({ message: 'Message required' })
  
  // Validate notification type
  const notificationType = type && ['event', 'membership', 'email', 'report'].includes(type) ? type : 'email'
  
  try {
    // Handle report to all admins
    if (sendReport) {
      // Only SA can send reports
      if (isSA(req.user)) {
        return res.status(403).json({ message: 'System Administrators can not send reports' })
      }
      
      // Create single report notification with username=NULL
      const [result] = await dbp.query(
        `INSERT INTO notifications (username, senderUsername, clubName, type, message, link, isRead, createdAt) 
         VALUES (NULL, ?, NULL, 'report', ?, ?, 1, NOW())`,
        [req.user.username, message, link || null]
      )
      const notificationId = result.insertId
      
      // Insert rows into notification_reads for all admins (isAdmin=1) except sender
      const [admins] = await dbp.query(
        "SELECT username FROM person WHERE isAdmin = 1 AND username != ?",
        [req.user.username]
      )
      if (admins.length > 0) {
        const values = admins.map(a => [notificationId, a.username, null])
        await dbp.query(
          'INSERT INTO notification_reads (notificationid, username, readAt) VALUES ?',
          [values]
        )
      }
      
      return res.status(201).json({ message: `Report sent to all admins` })
    }
    
    // Check if user is CL/VP or SA for sending to all club members
    if (sendToAllClub) {
      // SA can send to any club, CL/VP to their own clubs
      if (!isSA(req.user) && !canActAsAdmin(req.user, targetClub)) {
        return res.status(403).json({ message: 'Only Club Leaders, Vice Presidents, and System Administrators can send to all members' })
      }
      if (!targetClub) {
        return res.status(400).json({ message: 'Target club required for sending to all members' })
      }
      
      // Create single club-wide notification with username=NULL
      const [result] = await dbp.query(
        `INSERT INTO notifications (username, senderUsername, clubName, type, message, link, isRead, createdAt) 
         VALUES (NULL, ?, ?, ?, ?, ?, 1, NOW())`,
        [req.user.username, targetClub, notificationType, message, link || null]
      )
      const notificationId = result.insertId
      
      // Insert rows into notification_reads for all current club members (except sender)
      // readAt = NULL means unread
      const [members] = await dbp.query(
        "SELECT username FROM membership WHERE clubName = ? AND role IN ('CL', 'VP', 'CM') AND username != ?",
        [targetClub, req.user.username]
      )
      if (members.length > 0) {
        const values = members.map(m => [notificationId, m.username, null])
        await dbp.query(
          'INSERT INTO notification_reads (notificationid, username, readAt) VALUES ?',
          [values]
        )
      }
      
      return res.status(201).json({ message: `Email sent to all club members` })
    } else {
      // Send to individual
      if (!recipient) return res.status(400).json({ message: 'Recipient required' })
      // Check if recipient exists
      const [users] = await dbp.query('SELECT username FROM person WHERE username = ?', [recipient])
      if (users.length === 0) return res.status(404).json({ message: 'Recipient not found' })
      
      await createNotification({
        username: recipient,
        senderUsername: req.user.username,
        clubName: targetClub || null,
        type: 'email',
        message: message,
        link: link || null
      })
      return res.status(201).json({ message: 'Email sent successfully' })
    }
  } catch (err) {
    console.error('Send email failed', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
})

app.get('/clubMembers', requireAuth, async (req, res) => {
  console.log(`GET /clubMembers - User: ${req.user?.username}`)
  try {
    // SA can see members of any club (via query param), others see their own clubs
    const targetClub = req.query.club
    
    if (!isSA(req.user) && !canActAsMember(req.user, targetClub)) return forbidden(res)
    if (!targetClub) return res.status(400).json({ message: 'Club not specified' })
    
    const [members] = await dbp.query(
      "SELECT username, role FROM membership WHERE clubName = ? AND role IN ('CL', 'VP', 'CM') ORDER BY role, username",
      [targetClub]
    )
    return res.json(members)
  } catch (err) {
    console.error('Fetch club members failed', err)
    return res.status(500).json({ message: 'Failed to fetch club members' })
  }
})

app.get('/allUsers', requireAuth, async (req, res) => {
  console.log(`GET /allUsers - User: ${req.user?.username}, Search: ${req.query.q || ''}`)
  try {
    const search = req.query.q || ''
    const like = `%${search}%`
    // Return user info with their memberships
    const [users] = await dbp.query(
      "SELECT DISTINCT p.username, p.isAdmin FROM person p WHERE p.username LIKE ? AND p.username != ? ORDER BY p.username LIMIT 5",
      [like, req.user.username]
    )
    // For each user, get their memberships (optional - for display)
    const results = await Promise.all(users.map(async (u) => {
      const memberships = await getUserMemberships(u.username)
      return { ...u, memberships }
    }))
    return res.json(results)
  } catch (err) {
    console.error('Fetch users failed', err)
    return res.status(500).json({ message: 'Failed to fetch users' })
  }
})

// Get users available to become club leaders (no club memberships, not SA) - SA only
app.get('/availableLeaders', requireAuth, async (req, res) => {
  console.log(`GET /availableLeaders - User: ${req.user?.username}, Search: ${req.query.q || ''}`)
  if (!isSA(req.user)) return forbidden(res)
  
  try {
    const search = req.query.q || ''
    const like = `%${search}%`
    // Users who have no memberships at all and are not SA
    const [users] = await dbp.query(
      `SELECT p.username 
       FROM person p 
       LEFT JOIN membership m ON p.username = m.username
       WHERE p.username LIKE ? AND p.isAdmin = 0 AND m.username IS NULL 
       ORDER BY p.username LIMIT 20`,
      [like]
    )
    return res.json(users)
  } catch (err) {
    console.error('Fetch available leaders failed', err)
    return res.status(500).json({ message: 'Failed to fetch available leaders' })
  }
})

app.put('/notifications/:id/read', requireAuth, async (req, res) => {
  const id = req.params.id
  console.log(`PUT /notifications/${id}/read - User: ${req.user?.username}`)
  try {
    const [[notification]] = await dbp.query('SELECT * FROM notifications WHERE notificationid = ?', [id])
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    
    // Handle club-wide notifications (username=NULL)
    if (notification.username === null) {
      // Check if user received this notification (exists in notification_reads)
      const [[recipient]] = await dbp.query(
        'SELECT * FROM notification_reads WHERE notificationid = ? AND username = ?',
        [id, req.user.username]
      )
      if (!recipient) {
        return res.status(403).json({ message: 'You did not receive this notification' })
      }
      // Set readAt to current timestamp
      await dbp.query(
        'UPDATE notification_reads SET readAt = NOW() WHERE notificationid = ? AND username = ?',
        [id, req.user.username]
      )
      return res.json({ message: 'Club notification marked as read' })
    }
    
    // Check if notification belongs to user
    if (notification.username !== req.user.username && notification.senderUsername !== req.user.username) {
      return forbidden(res)
    }
    
    // Check if this is part of a conversation (has replies or is a parent with replies)
    const [[{ hasReplies }]] = await dbp.query(
      'SELECT COUNT(*) as hasReplies FROM notifications WHERE replyTo = ?',
      [id]
    )
    
    if (hasReplies > 0 || notification.replyTo) {
      // This is a conversation - mark all messages in thread where current user is recipient as read
      const parentId = notification.replyTo || id
      await dbp.query(
        'UPDATE notifications SET isRead = 1 WHERE username = ? AND (notificationid = ? OR replyTo = ?)',
        [req.user.username, parentId, parentId]
      )
    } else {
      // Single notification
      if (notification.username !== req.user.username) return forbidden(res)
      await dbp.query('UPDATE notifications SET isRead = 1 WHERE notificationid = ?', [id])
    }
    
    return res.json({ message: 'Notification marked as read' })
  } catch (err) {
    console.error('Update notification failed', err)
    return res.status(500).json({ message: 'Failed to update notification' })
  }
})

app.put('/notifications/:id/unread', requireAuth, async (req, res) => {
  const id = req.params.id
  console.log(`PUT /notifications/${id}/unread - User: ${req.user?.username}`)
  try {
    const [[notification]] = await dbp.query('SELECT * FROM notifications WHERE notificationid = ?', [id])
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    
    // Handle club-wide notifications (username=NULL)
    if (notification.username === null) {
      // Check if user received this notification (exists in notification_reads)
      const [[recipient]] = await dbp.query(
        'SELECT * FROM notification_reads WHERE notificationid = ? AND username = ?',
        [id, req.user.username]
      )
      if (!recipient) {
        return res.status(403).json({ message: 'You did not receive this notification' })
      }
      // Set readAt to NULL
      await dbp.query(
        'UPDATE notification_reads SET readAt = NULL WHERE notificationid = ? AND username = ?',
        [id, req.user.username]
      )
      return res.json({ message: 'Club notification marked as unread' })
    }
    
    // Check if notification belongs to user
    if (notification.username !== req.user.username && notification.senderUsername !== req.user.username) {
      return forbidden(res)
    }
    
    // Check if this is part of a conversation (has replies or is a parent with replies)
    const [[{ hasReplies }]] = await dbp.query(
      'SELECT COUNT(*) as hasReplies FROM notifications WHERE replyTo = ?',
      [id]
    )
    
    if (hasReplies > 0 || notification.replyTo) {
      // This is a conversation - mark all messages in thread where current user is recipient as unread
      const parentId = notification.replyTo || id
      await dbp.query(
        'UPDATE notifications SET isRead = 0 WHERE username = ? AND (notificationid = ? OR replyTo = ?)',
        [req.user.username, parentId, parentId]
      )
    } else {
      // Single notification
      if (notification.username !== req.user.username) return forbidden(res)
      await dbp.query('UPDATE notifications SET isRead = 0 WHERE notificationid = ?', [id])
    }
    
    return res.json({ message: 'Notification marked as unread' })
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
