const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

module.exports = (db) => {
    router.get('/host', async (req, res) => {
        if (!req.session.loggedin) {
            return res.redirect('/login'); // Ensure user is logged in
        }

        const userID = req.session.userID;

        // Get the username
        const getUserSQL = 'SELECT Username FROM users WHERE UserID = ?';
        db.query(getUserSQL, [userID], (err, result) => {
            if (err) return res.send('Database error.');
            if (result.length === 0) return res.send('User not found.');

            const username = result[0].Username;

            // Check if there is an ongoing game
            const checkOngoingGameSQL = 'SELECT GameID FROM games WHERE Status = "active" ORDER BY GameID DESC LIMIT 1';
            db.query(checkOngoingGameSQL, (err, ongoingGame) => {
                if (err) return res.send('Database error.');

                if (ongoingGame.length > 0) {
                    const ongoingGameID = ongoingGame[0].GameID;

                    // Store the gameID before redirecting
                    req.session.gameID = ongoingGameID;

                    console.log(" Stored Ongoing GameID in Session:", req.session.gameID);

                    return res.redirect(`/lobby?gameID=${ongoingGameID}`);
                }

                // No active game, check for a waiting game or create a new one
                const checkWaitingGameSQL = 'SELECT GameID FROM games WHERE Status = "waiting" ORDER BY GameID DESC LIMIT 1';
                db.query(checkWaitingGameSQL, async (err, waitingGame) => {
                    if (err) return res.send('Database error.');

                    let gameID;
                    if (waitingGame.length > 0) {
                        gameID = waitingGame[0].GameID;
                    } else {
                        // Create a new game if no waiting game exists
                        const insertGameSQL = 'INSERT INTO games (Status) VALUES ("waiting")';
                        const gameResult = await db.promise().query(insertGameSQL);
                        gameID = gameResult[0].insertId;

                        const playerSQL = 'INSERT INTO players (Name, Balance) VALUES (?, 5000)';
                        await db.promise().query(playerSQL, [username]);
                    }
                    req.session.gameID = gameID;

                    console.log("Stored New/Waiting GameID in Session:", req.session.gameID);

                    // Generate QR Code
                    const gameLink = `${req.protocol}://${req.get('host')}/join-game?gameID=${gameID}`;
                    QRCode.toDataURL(gameLink, (err, qrCodeData) => {
                        if (err) {
                            console.error('QR Code Generation Failed:', err);
                            return res.send('Error generating QR Code.');
                        }
                        res.render('hostgame', { username, gameID, qrCodeData, gameLink });
                    });
                });
            });
        });
    });

    return router;
};