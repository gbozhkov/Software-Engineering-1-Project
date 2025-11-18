-- DROP IN CORRECT ORDER (because of foreign keys)
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS person;
DROP TABLE IF EXISTS clubs;

-- ====== CREATE TABLES ======
CREATE TABLE `clubs` (
    `clubName` varchar(255) NOT NULL,
    `description` text NOT NULL,
    `memberCount` int NOT NULL,
    `memberMax` int NOT NULL,
    PRIMARY KEY (`clubName`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci

CREATE TABLE `person` (
    `username` varchar(255) NOT NULL,
    `password` text NOT NULL,
    `role` text NOT NULL,
    `club` varchar(255) DEFAULT NULL,
    `sessionId` varchar(255) DEFAULT NULL,
    PRIMARY KEY (`username`),
    UNIQUE KEY `sessionId` (`sessionId`),
    KEY `club` (`club`),
    CONSTRAINT `person_ibfk_1` FOREIGN KEY (`club`) REFERENCES `clubs` (`clubName`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci

CREATE TABLE `events` (
    `eventid` int NOT NULL AUTO_INCREMENT,
    `date` date NOT NULL,
    `title` text,
    `description` text,
    `accepted` tinyint(1) DEFAULT FALSE,
    `clubName` varchar(255) NOT NULL,
    PRIMARY KEY (`eventid`),
    KEY `clubName` (`clubName`),
    CONSTRAINT `events_ibfk_1` FOREIGN KEY (`clubName`) REFERENCES `clubs` (`clubName`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 22 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci

CREATE TABLE `comments` (
    `commentid` int NOT NULL AUTO_INCREMENT,
    `date` datetime DEFAULT NULL,
    `comment` text NOT NULL,
    `rating` int NOT NULL,
    `username` varchar(255) NOT NULL,
    `clubName` varchar(255) NOT NULL,
    PRIMARY KEY (`commentid`),
    KEY `username` (`username`),
    KEY `clubName` (`clubName`),
    CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`username`) REFERENCES `person` (`username`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `comments_ibfk_4` FOREIGN KEY (`clubName`) REFERENCES `clubs` (`clubName`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 12 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci

-- ===== CLUBS (parents) =====
INSERT INTO clubs (clubName, description, memberCount, memberMax) VALUES
('Ski', 'Mountain adventurers: apres-ski, hot chocolate battles and occasional avalanche avoidance.', 0, 30),
('Basketball', 'Hoops, trash-talk, and gym-floor legends.', 0, 40),
('Baseball', 'Sun, bats, and the slow-burning rivalry with the Soccer club.', 0, 25),
('Chess', 'Quiet intensity, checkmates at midnight, and stolen pawns.', 0, 20),
('Music', 'Jam sessions, terrible karaoke and one glorious perfect chord.', 0, 30),
('Drama', 'Costumes, last-minute line changes and the yearly tragedy-turned-comedy.', 0, 25),
('Photography', 'From long exposures to short temper', 0, 20),
('Robotics', 'Solder, code, and the occasional smoke test.', 0, 18);

-- ===== PERSONS =====
INSERT INTO person (username, password, role, club, sessionId) VALUES
('Francesco', '123456', 'CL', 'Ski', NULL),
('Samuele', 'gocciole', 'CM', 'Ski', NULL),
('Ari', 'ari_pw', 'CM', 'Ski', NULL),
('Davide', 'skiman', 'STU', 'Ski', NULL),
('Bea', 'beapwd', 'VP', 'Ski', NULL),
('Giorgie', 'password', 'CL', 'Basketball', 'akenfue3kd'),
('Ayoub', 'ayoub1', 'CM', 'Basketball', NULL),
('Asia', 'ballerz', 'CM', 'Basketball', NULL),
('MartaB', 'martaBpw', 'STU', NULL, NULL),
('Rico', 'ric0', 'VP', 'Basketball', NULL),
('Marco', 'basehit', 'CL', 'Baseball', 'sess_base45'),
('Tom', 'tom_pw', 'CM', 'Baseball', NULL),
('Sara', 'sara_pw', 'CM', 'Baseball', NULL),
('Gabe', 'gabepw', 'STU', 'Baseball', NULL),
('Luca', 'l0v3code', 'CL', 'Chess', 'sess_9a1b2c'),
('Paolo', 'paolo_pw', 'CM', 'Chess', NULL),
('Irene', 'irene_pw', 'CM', 'Chess', NULL),
('Roberto', 'ciao', 'STU', NULL, NULL),
('Nina', 'pianist', 'CL', 'Music', 'sess_mus99'),
('Martina', 'martina!', 'CM', 'Music', NULL),
('Nora', 'nora_pw', 'CM', 'Music', NULL),
('Hugo', 'hugo_pw', 'STU', 'Music', NULL),
('Noel', 'noel_pw', 'VP', 'Music', NULL),
('Clara', 'clara_pw', 'CL', 'Drama', 'sess_dr12'),
('Zoe', 'zoe123', 'CM', 'Drama', NULL),
('LucaD', 'lucad_pw', 'CM', 'Drama', NULL),
('Marta', 'queen123', 'STU', NULL, NULL),
('Olga', 'olga_pw', 'CL', 'Photography', NULL),
('Ben', 'ben_pw', 'CM', 'Photography', NULL),
('Yara', 'yara_pw', 'CM', 'Photography', NULL),
('Ethan', 'ethan_pw', 'STU', 'Photography', NULL),
('Raffa', 'raffa_pw', 'CL', 'Robotics', NULL),
('Tessa', 'tess_pw', 'CM', 'Robotics', NULL),
('Jon', 'jon_pw', 'STU', NULL, NULL),
('Lex', 'lex_pw', 'VP', 'Robotics', NULL),
('Elena', 'el3na', 'STU', NULL, NULL),
('Claudio', 'claud_pw', 'STU', NULL, NULL),
('Gina', 'gina_pw', 'STU', 'Chess', NULL),
('Fabio', 'fab_pw', 'CM', 'Chess', NULL),
('Sofia', 'sofia_pw', 'CM', 'Basketball', NULL);

-- ===== EVENTS =====
INSERT INTO events (date, title, description, accepted, clubName) VALUES
('2025-10-25', 'Autumn Ski Trial', 'A small, friendly slope day; someone tried backward skiing.', 1, 'Ski'),
('2025-11-02', 'Apres-ski Pancake Panic', 'The pancake stove exploded during the apres-ski. Chaos and butter everywhere.', 1, 'Ski'),
('2025-10-30', 'Night Hoops: 3-pt Challenge', 'Late-night friendly tournament; video evidence exists.', 1, 'Basketball'),
('2025-11-01', 'Baseball Backfield BBQ', 'Hot dogs, lost mitt and Marco''s tall tale growing each retelling.', 1, 'Baseball'),
('2025-11-10', 'Chess Blitz Marathon', 'Blitz games, whispered taunts, and one marathon match.', 1, 'Chess'),
('2025-11-17', 'Mid-November Jam', 'Quick rehearsal session and open mic.', 1, 'Music'),
('2025-11-20', 'Ski Safety Workshop', 'Learn how to fall with dignity. Hot cocoa afterward.', 0, 'Ski'),
('2025-11-22', 'Friendly Match: Basketball vs. Local Teachers', 'Teachers are surprisingly competitive.', 1, 'Basketball'),
('2025-12-05', 'Winter Concert Rehearsal', 'Full orchestra rehearsal before the winter concert.', 1, 'Music'),
('2025-12-15', 'Holiday Play: Surprise', 'Full cast rehearsal for the December show.', 1, 'Drama'),
('2026-01-10', 'Robotics Mini-Sprint', 'Prototype challenge: make it move or regret it.', 0, 'Robotics');

-- ===== COMMENTS =====
INSERT INTO comments (date, comment, rating, username, clubName) VALUES
('2025-10-25 18:30:00', 'Tried backward skiing — do not recommend. Davide survived.', 3, 'Davide', 'Ski'),
('2025-11-02 11:30:00', 'Pancake Panic was wild; Samuele claimed marshmallow immunity.', 4, 'Francesco', 'Ski'),
('2025-11-03 09:00:00', 'Found leftover syrup in my pockets. Best regrets.', 4, 'Ari', 'Ski'),
('2025-10-30 23:00:00', 'Night Hoops was intense; Ayoub''s half-court shot made our week.', 5, 'Giorgie', 'Basketball'),
('2025-11-15 12:00:00', 'Teachers match next week — can''t wait to see the chaos!', 0, 'Asia', 'Basketball'),
('2025-11-01 13:00:00', 'Marco''s double play became a legend by dessert time.', 5, 'Tom', 'Baseball'),
('2025-11-10 22:30:00', 'Blitz Marathon left me exhausted but smarter (?)', 4, 'Luca', 'Chess'),
('2025-11-17 20:00:00', 'Mid-November Jam was cozy; Nina did a crazy run.', 5, 'Nina', 'Music'),
('2025-11-12 10:00:00', 'Winter concert coming — practicing scales like a responsible monster.', 0, 'Martina', 'Music'),
('2025-11-10 09:30:00', 'Holiday Play rehearsal next month — I already forgot my lines, in advance.', 0, 'Zoe', 'Drama'),
('2025-11-05 16:00:00', 'We fried a microcontroller and learned humility.', 3, 'Raffa', 'Robotics'),
('2025-11-08 14:00:00', 'We found a golden hour that actually looked golden. Yara captured the sunrise.', 5, 'Ben', 'Photography'),
('2025-11-04 18:00:00', 'I''m applying to Chess — fingers crossed.', 0, 'Gina', 'Chess'),
('2025-11-07 17:45:00', 'Applied to Ski club — hoping to join the next trip.', 0, 'Davide', 'Ski');

-- ===== Update clubs.memberCount to match actual inserted people (counts based on above inserts) =====
UPDATE clubs SET memberCount = (
  SELECT COUNT(*) FROM person WHERE person.club = clubs.clubName AND person.role IN ('CL','VP','CM')
) WHERE clubName IN ('Ski','Basketball','Baseball','Chess','Music','Drama','Photography','Robotics');
