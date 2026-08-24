const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'monopython',
});

db.connect((err) => {
  if (err) {
    console.error('Connection failed:', err);
  } else {
    console.log('Connected to Monopython Questions database');
  }
});

router.get('/property-question', (req, res) => {
    const propertyID = req.query.propertyID;

    if (!propertyID) {
        return res.status(400).send("Property ID is required.");
    }

    const getQuestionSQL = `
        SELECT QuestionID, Questions, Option1, Option2, Option3, CorrectAnswer
        FROM questions 
        WHERE PropertyID = ?
        LIMIT 1;
    `;

    db.query(getQuestionSQL, [propertyID], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Database error.");
        }

        if (result.length === 0) {
            return res.render('question-page', { 
                propertyID, 
                question: null, 
                message: "No questions available for this property."
            });
        }

        const question = result[0];

        // Render `question-page.pug` with fetched question
        res.render('question-page', { 
            propertyID, 
            question,
            gameID: req.session.gameID,
        });
    });
});

router.post('/submit-answer', (req, res) => {
    let { PlayerID, questionID, propertyID, answer } = req.body;

    // Ensure `questionID` is a single value
    if (Array.isArray(questionID)) {
        questionID = questionID[0]; 
    }

    // Ensure all required fields are provided
    if (!PlayerID || !questionID || !propertyID || !answer) {
        console.error("Missing data:", { PlayerID, questionID, propertyID, answer });
        return res.status(400).send("Missing required data.");
    }

    console.log("Processing answer:", { PlayerID, questionID, propertyID, answer });

    // Get correct answer from database
    const getAnswerSQL = 'SELECT CorrectAnswer FROM questions WHERE QuestionID = ?';
    db.query(getAnswerSQL, [questionID], (err, questionResult) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error checking answer.');
        }

        if (questionResult.length === 0) {
            console.warn("Question not found for ID:", questionID);
            return res.status(404).send('Question not found.');
        }

        const correctAnswer = questionResult[0].CorrectAnswer;
        const isCorrect = parseInt(answer) === parseInt(correctAnswer);

        // Check property ownership and price
        const propertySQL = 'SELECT OwnerID, Rent, Price FROM properties WHERE PropertyID = ?';
        db.query(propertySQL, [propertyID], (err, propertyResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Error checking property ownership.');
            }

            if (propertyResult.length === 0) {
                console.warn("Property not found for ID:", propertyID);
                return res.status(404).send('Property not found.');
            }

            const { OwnerID, Rent, Price } = propertyResult[0];

            // Case 1: Property is Unowned
            if (!OwnerID) {
                if (isCorrect) {
                    // Deduct price from player's balance before assigning ownership
                    const deductPriceSQL = 'UPDATE players SET Balance = Balance - ? WHERE PlayerID = ? AND Balance >= ?';
                    db.query(deductPriceSQL, [Price, PlayerID, Price], (err, result) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).send('Error deducting balance.');
                        }

                        if (result.affectedRows === 0) {
                            return res.send("Insufficient balance to purchase this property.");
                        }

                        // Assign property to player after successful deduction
                        const updatePropertySQL = 'UPDATE properties SET OwnerID = ? WHERE PropertyID = ?';
                        db.query(updatePropertySQL, [PlayerID, propertyID], (err) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).send('Error assigning property.');
                            }
                            console.log(`Player ${PlayerID} purchased Property ${propertyID} for $${Price}`);
                            const logSQL = "INSERT INTO game_logs (GameID, PlayerID, Action, Timestamp) VALUES (?, ?, ?, NOW())";
                            db.query(logSQL, [req.session.gameID, PlayerID, `Player ${PlayerID} purchased Property ${propertyID} for $${Price}`], (err) => {
                                if (err) console.error('Log insertion error:', err);
                                else console.log('Log inserted successfully');
                            });
                            res.send(`
                                <script>
                                    sessionStorage.setItem('notification', JSON.stringify({
                                        title: "Correct Answer",
                                        message: "You now own this property for $${Price}.",
                                        isSuccess: true
                                    }));
                                    window.location.href = '/lobby?gameID=${req.session.gameID}';
                                </script>
                            `);
                        });
                    });
                } else {
                    res.send(`
                        <script>
                            sessionStorage.setItem('notification', JSON.stringify({
                                title: "Incorrect Answer",
                                message: "You lost the chance to buy.",
                                isSuccess: false
                            }));
                            window.location.href = '/lobby?gameID=${req.session.gameID}';
                        </script>
                    `);
                }
            } 
            // Case 2: Property is Owned
            else {
                if (OwnerID == PlayerID) {
                    res.send(`
                        <script>
                            sessionStorage.setItem('notification', JSON.stringify({
                                title: "Property Owned",
                                message: "You already own this property.",
                                isSuccess: false
                            }));
                            window.location.href = '/lobby?gameID=${req.session.gameID}';
                        </script>
                    `);
                } else {
                    if (isCorrect) {
                        res.send(`
                            <script>
                                sessionStorage.setItem('notification', JSON.stringify({
                                    title: "Correct Answer",
                                    message: "You do not have to pay rent.",
                                    isSuccess: true
                                }));
                                window.location.href = '/lobby?gameID=${req.session.gameID}';
                            </script>
                        `);
                    } else {
                        // Deduct rent from player balance
                        const transferRentSQL = `
                            UPDATE players 
                            SET Balance = CASE 
                                WHEN PlayerID = ? THEN Balance - ? 
                                WHEN PlayerID = ? THEN Balance + ?  
                            END
                            WHERE PlayerID IN (?, ?)`;
                            
                        db.query(transferRentSQL, [PlayerID, Rent, OwnerID, Rent, PlayerID, OwnerID], (err) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).send('Error assigning property.');
                            }
                            console.log(`Player ${PlayerID} paid $${Rent} in rent to Player ${OwnerID}`);
                            const logSQL = "INSERT INTO game_logs (GameID, PlayerID, Action, Timestamp) VALUES (?, ?, ?, NOW())";
                            db.query(logSQL, [req.session.gameID, PlayerID, `Player ${PlayerID} paid $${Rent} in rent to Player ${OwnerID}`], (err) => {
                                if (err) console.error('Log insertion error:', err);
                            });

                            res.send(`
                                <script>
                                    sessionStorage.setItem('notification', JSON.stringify({
                                        title: "Incorrect Answer",
                                        message: "You must pay $${Rent} in rent.",
                                        isSuccess: false
                                    }));
                                    window.location.href = '/lobby?gameID=${req.session.gameID}';
                                </script>
                            `);
                        });
                    }
                }
            }
        });
    });
});

module.exports = router;
