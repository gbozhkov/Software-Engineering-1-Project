-- create
CREATE TABLE Person (
  username TEXT NOT NULL PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT,
  club TEXT,
  sessionId TEXT UNIQUE
);

CREATE TABLE Clubs (
  clubName TEXT NOT NULL PRIMARY KEY,
  description TEXT,
  memberCount INT,
  memberMax INT
);

CREATE TABLE Events (
  eventid INT NOT NULL PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT,
  description TEXT,
  clubName TEXT NOT NULL,
  FOREIGN KEY (clubName) REFERENCES Clubs(clubName)
);

CREATE TABLE Comments (
  commentid INT NOT NULL PRIMARY KEY,
  date DATE NOT NULL,
  comment TEXT,
  rating INT,
  username TEXT NOT NULL,
  clubName TEXT NOT NULL,
  FOREIGN KEY (username) REFERENCES Person(username),
  FOREIGN KEY (clubName) REFERENCES Clubs(clubName)
);

-- insert
INSERT INTO Person VALUES ('Francesco', '123456', 'CL', 'Ski', NULL),
                          ('Giorgie', 'password', 'CL', 'Basketball', 'akenfue3kd'),
                          ('Ayoub', 'ayoub1', 'STU', 'Basketball', NULL),
                          ('Samuele', 'gocciole', 'CM', 'Ski', NULL);

INSERT INTO Clubs VALUES ('Ski', 'We ski!', 2, 5),
                         ('Basketball', 'We play basketball!', 1, 10);

INSERT INTO Events VALUES (0, '2025-11-12', 'Afterski', 'Aperitivo on skislopes.', 'Ski'),
                          (1, '2025-11-16', 'Basketball match', 'In the back field.', 'Basketball'),
                          (2, '2025-11-14', 'Skiday', 'One day on the mounains.', 'Ski');

INSERT INTO Comments VALUES (0, '2025-10-29', 'I got so much fun!', 5, 'Samuele', 'Ski'),
                            (1, '2025-10-29', 'Samuele ate all the gocciole!!1!', 1, 'Francesco', 'Ski'),
                            (2, '2025-11-05', 'Hope to play with you.', 3, 'Ayoub', 'Basketball');

-- fetch

-- Login
SELECT role, club
FROM Person
WHERE username = 'Francesco' AND password = '123456';

-- Set session
UPDATE Person SET sessionId = 'dejdniuen' WHERE username = 'Francesco';

-- Login with session
SELECT role, club
FROM Person
WHERE sessionId = 'dejdniuen'; -- from cookie

-- See pending list
SELECT username AS pending_list
FROM Person
WHERE club = 'Basketball' AND role = 'STU';

-- Get club information about ski
SELECT *
FROM Clubs
WHERE clubName = 'Ski';
SELECT *
FROM Events
WHERE clubName = 'Ski';
SELECT *
FROM Comments
WHERE clubName = 'Ski';

SELECT * FROM Person;
SELECT * FROM Clubs;
SELECT * FROM Events ORDER BY date;
SELECT * FROM Comments ORDER BY date;
