const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const session = require('express-session');
const QRCode = require('qrcode');
const os = require('os');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'monopython',
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to the Monopython database');
  }
});

// Middleware for session-based authentication
function checkLoggedIn(req, res, next) {
  if (req.session.loggedin) {
    next();
  } else {
    req.session.error = 'Please Login!';
    res.redirect('/login');
  }
}

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Session config
app.use(session({
  secret: 'monopython_secret',
  resave: true,
  saveUninitialized: true
}));

// Middleware to make session data available in all views
app.use((req, res, next) => {
  res.locals.loggedin = req.session.loggedin || false;
  res.locals.username = req.session.username || null;
  next();
});

// Set the directory for view templates and Pug as the view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Define main routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Monopython' });
});

//--------------------
// Game routes
app.get('/qrcodescanner', checkLoggedIn, (req, res) => {
  res.render('qrcodescanner');
})

const QRScan = require('./routes/processing_qrcode_data'); //need the route js file
app.use('/', QRScan);

// Scan to join game
app.get('/processing_qrcode_data/:gameID', checkLoggedIn, (req, res) => {
  const gameID = req.params.gameID;

  if (!gameID) {
      return res.send("Invalid QR Code. No Game ID found.");
  }
  res.redirect(`/join-game?gameID=${gameID}`);
});

app.get('/modals', (req, res) => {
  res.render('modal');
});

// IP Address 
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let dev in interfaces) {
      for (let details of interfaces[dev]) {
          if (details.family === 'IPv4' && !details.internal) {
              return details.address;
          }
      }
  }
  return 'localhost';
}

//--------------------
// Host a game
const hostRoutes = require('./routes/host')(db);
app.use('/', hostRoutes);

app.get('/ongoing-lobby', (req, res) => {
    const getOngoingGameSQL = `SELECT GameID FROM games WHERE Status = "active" ORDER BY GameID DESC LIMIT 1`;
  
    db.query(getOngoingGameSQL, (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.send("Database error.");
        }
  
        if (result.length > 0) {
            const gameID = result[0].GameID;
            return res.redirect(`/lobby?gameID=${gameID}`); // Redirect to the actual game lobby
        } else {
            return res.send(`
                <script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "No Ongoing Game",
                        message: "No ongoing game found.",
                        isSuccess: false
                    }));
                    window.location.href = '/';
                </script>
            `);
        }
    });
});

// Join an existing game
app.get('/join-game', checkLoggedIn, (req, res) => {
  const userID = req.session.userID;
  const gameID = req.query.gameID;

  if (!gameID) return res.send("Invalid game ID.");

  // Retrieve username
  const getUserSQL = 'SELECT Username FROM users WHERE UserID = ?';
  db.query(getUserSQL, [userID], (err, result) => {
      if (err) return res.send('Database error.');
      if (result.length === 0) return res.send('User not found.');

      const username = result[0].Username;

      // Check if the user is already in the game
      const checkPlayerSQL = 'SELECT * FROM players WHERE Name = ?';
      db.query(checkPlayerSQL, [username], async (err, existingPlayer) => {
          if (err) return res.send('Database error.');

          if (existingPlayer.length === 0) {
              // Add player to the game
              const insertPlayerSQL = 'INSERT INTO players (Name, Balance) VALUES (?, 5000)';
              await db.promise().query(insertPlayerSQL, [username]);
          }

          // Retrieve all players in the game
          const getPlayersSQL = 'SELECT Name FROM players';
          db.query(getPlayersSQL, (err, players) => {
              if (err) return res.send('Database error.');

              res.render('joingame', { username, gameID, players });
          });
      });
  });
});

app.get('/start-game', checkLoggedIn, (req, res) => {
  const gameID = req.session.gameID;

  if (!gameID) return res.send('No active game found.');

  // Check if the game is already active
  const checkGameSQL = 'SELECT Status FROM games WHERE GameID = ?';
  db.query(checkGameSQL, [gameID], (err, result) => {
      if (err) return res.send('Database error.');
      if (result.length === 0) return res.send('Game not found.');

      if (result[0].Status === "active") {
          return res.redirect(`/gameplay?gameID=${gameID}`); // If already started, go to game board
      }

      // Update game status to "active"
      const updateGameSQL = 'UPDATE games SET Status = "active" WHERE GameID = ?';
      db.query(updateGameSQL, [gameID], (err) => {
          if (err) return res.send('Database error.');
 
          io.to(`game_${gameID}`).emit('gameStarted', { gameID });
          res.redirect(`/lobby?gameID=${gameID}`);
      });
  });
});

app.get('/lobby', checkLoggedIn, (req, res) => {
  const gameID = req.query.gameID;

  if (!gameID) return res.send("Invalid game ID.");
  const getPlayersSQL = 'SELECT PlayerID, Name, Balance FROM players';
  db.query(getPlayersSQL, (err, players) => {
      if (err) return res.send('Database error.');

      res.render('lobby', { gameID, players });
  });
});

let gameSummary = {}; // Temporary storage for summary

app.get('/end-game', (req, res) => {
    db.query("SELECT PlayerID, Name, Balance FROM players ORDER BY Balance DESC", (err, results) => {
        if (err) {
            console.error("Error fetching final player data:", err);
            return res.status(500).send("Failed to get game summary.");
        }

        if (results.length > 0) {
            global.gameSummary = { players: results, winner: results[0].Name };
        } else {
            global.gameSummary = { players: [], winner: "No players" };
        }

        console.log("Final Game Summary:", global.gameSummary);

        db.query("UPDATE properties SET OwnerID = NULL WHERE OwnerID IS NOT NULL", (err) => {
            if (err) {
                console.error("Error resetting property ownership:", err);
                return res.status(500).send("Failed to reset property ownership.");
            }

            db.query("DELETE FROM players", (err) => {
                if (err) {
                    console.error("Error removing players:", err);
                    return res.status(500).send("Failed to remove players.");
                }

                db.query("UPDATE games SET Status = 'finished'", (err) => {
                    if (err) {
                        console.error("Error updating game status:", err);
                        return res.status(500).send("Failed to update game status.");
                    }

                    io.emit('gameEnded');
                    res.redirect(`/summary?winner=${global.gameSummary.winner}&players=${JSON.stringify(global.gameSummary.players)}`);
                });
            });
        });
    });
});

app.get('/summary', (req, res) => {
  const winner = req.query.winner || "No players";
  const players = JSON.parse(req.query.players || "[]");
  res.render('summary', { summary: { winner, players } });
});

app.get("/get-players", (req, res) => {
    const sql = "SELECT PlayerID, Name FROM players";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching players:", err);
            return res.status(500).json({ error: "Failed to load players" });
        }

        console.log("Players fetched:", results);
        res.json(results);
    });
});

const propertyQuestionRoutes = require('./routes/propertyQuestion');
app.use('/', propertyQuestionRoutes);

app.get('/processing_qrcode_data/:propertyID', (req, res) => {
  const propertyID = req.params.propertyID;

  // Redirect to a random question for that property
  res.redirect(`/question-page?propertyID=${propertyID}`);
});

app.get("/get-property-question/:propertyID", (req, res) => {
  const propertyID = req.params.propertyID;
  const sql = `
      SELECT q.QuestionID, q.Questions, q.Option1, q.Option2, q.Option3, 
             p.Name AS PropertyName 
      FROM questions q
      JOIN properties p ON q.PropertyID = p.PropertyID
      WHERE q.PropertyID = ?  
      LIMIT 1
  `;

  db.query(sql, [propertyID], (err, result) => {
      if (err) {
          console.error("Error fetching question:", err);
          return res.status(500).json({ error: "Failed to load question" });
      }

      if (result.length === 0) {
          return res.status(404).json({ error: "No question found" });
      }

      // Send correct property name
      res.json({
          question: result[0],
          propertyName: result[0].PropertyName || "Unknown"
      });
  });
});


app.get('/game-logs', (req, res) => {
    const gameID = req.session.gameID;
    const fetchLogsSQL = 'SELECT * FROM game_logs WHERE GameID = ? ORDER BY Timestamp DESC';

    db.query(fetchLogsSQL, [gameID], (err, logs) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error retrieving logs.');
        }

        console.log("Retrieved logs:", logs);

        res.render('logs', {logs}); 
    });
});

app.get('/get-property-details/:id', (req, res) => {
  const propertyID = req.params.id;

  db.query(
      "SELECT Name, OwnerID FROM properties WHERE PropertyID = ?",
      [propertyID],
      (error, results) => {
          if (error) {
              console.error("Error fetching property details:", error);
              return res.status(500).json({ error: "Internal Server Error" });
          }

          if (results.length > 0) {
              res.json(results[0]);  // Send property details
          } else {
              res.json({ message: "Property not found" });
          }
      }
  );
});

// Authentication routes
const registerRoutes = require('./routes/register')(db);
app.use('/', registerRoutes);

const loginRoutes = require('./routes/login')(db);
app.use('/', loginRoutes);

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send(`
      <script>
        sessionStorage.setItem('notification', JSON.stringify({
          title: "Logout Successful",
          message: "You have logged out successfully.",
          isSuccess: true
        }));
        window.location.href = '/';
      </script>
    `);
  });
});

// Profile Management
app.get('/profile', checkLoggedIn, (req, res) => {
    const userID = req.session.userID;
  
    const getUserSQL = 'SELECT Username FROM users WHERE UserID = ?';
    db.query(getUserSQL, [userID], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error retrieving user data.');
      }
  
      if (result.length === 0) {
        return res.status(404).send('User not found.');
      }
  
      const user = result[0];
      res.render('profile', { user });
    });
  });
  
  app.post('/profile', checkLoggedIn, (req, res) => {
    const userID = req.session.userID;
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.send(`<script>
        sessionStorage.setItem('notification', JSON.stringify({
          title: "Update Failed",
          message: "Please enter both username and password!",
          isSuccess: false
        }));
        window.location.href="/profile";
      </script>`);
    }
  
    if (password.length < 4 || password.length > 10) {
      return res.send(`<script>
        sessionStorage.setItem('notification', JSON.stringify({
          title: "Update Failed",
          message: "Password must be between 4 and 10 characters long!",
          isSuccess: false
        }));
        window.location.href="/profile";
      </script>`);
    }
  
    const hashedPassword = bcrypt.hashSync(password, 10);
  
    const updateUserSQL = 'UPDATE users SET Username = ?, Password = ? WHERE UserID = ?';
    db.query(updateUserSQL, [username, hashedPassword, userID], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.send(`<script>
          sessionStorage.setItem('notification', JSON.stringify({
            title: "Update Failed",
            message: "Error updating user data.",
            isSuccess: false
          }));
          window.location.href="/profile";
        </script>`);
      }
  
      req.session.username = username;
      res.send(`<script>
        sessionStorage.setItem('notification', JSON.stringify({
          title: "Update Successful",
          message: "Your profile has been updated!",
          isSuccess: true
        }));
        window.location.href="/profile";
      </script>`);
    });
  });

// Middleware to pass user session data to Pug templates
app.use((req, res, next) => {
  if (req.session.loggedin) {
    res.locals.user_name = req.session.user_name;
  }
  next();
});

io.on('connection', (socket) => {
  console.log('A player connected');

  socket.on('joinGame', (gameID) => {
      socket.join(`game_${gameID}`);
  });

  socket.on('disconnect', () => {
      console.log('A player disconnected');
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Monopython server is running on http://localhost:${PORT}`);
});
