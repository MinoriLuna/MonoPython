const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    router.get('/login', (req, res) => {
        res.render('login');
    });

    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.send(`<script>
                sessionStorage.setItem('notification', JSON.stringify({
                    title: "Login Failed",
                    message: "Please enter both username and password!",
                    isSuccess: false
                }));
                window.location.href="/login";
            </script>`);
        }

        const sql = 'SELECT UserID, username, password FROM users WHERE username = ?';
        db.query(sql, [username], async (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.send(`<script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "Database Error",
                        message: "An error occurred while processing your request.",
                        isSuccess: false
                    }));
                    window.location.href="/login";
                </script>`);
            }

            console.log("Entered Username:", username);
            console.log("Entered Password:", password);
            console.log("Query Result:", result);

            if (result.length === 0) {
                return res.send(`<script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "Login Failed",
                        message: "Invalid username or password!",
                        isSuccess: false
                    }));
                    window.location.href="/login";
                </script>`);
            }

            const user = result[0];
            const storedHash = user.password;

            if (!storedHash) {
                console.error('Error: Password is missing in database for this user');
                return res.send(`<script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "Login Error",
                        message: "Unexpected error: Missing password data.",
                        isSuccess: false
                    }));
                    window.location.href="/login";
                </script>`);
            }

            try {
                const match = await bcrypt.compare(password, storedHash);
                console.log("Password Match:", match);

                if (!match) {
                    return res.send(`<script>
                        sessionStorage.setItem('notification', JSON.stringify({
                            title: "Login Failed",
                            message: "Incorrect password!",
                            isSuccess: false
                        }));
                        window.location.href="/login";
                    </script>`);
                }

                // Set session and redirect
                req.session.loggedin = true;
                req.session.userID = user.UserID;
                req.session.username = user.username;

                return res.send(`<script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "Login Successful",
                        message: "Welcome back!",
                        isSuccess: true
                    }));
                    window.location.href="/";
                </script>`);
            } catch (error) {
                console.error('Error comparing passwords:', error);
                res.send(`<script>
                    sessionStorage.setItem('notification', JSON.stringify({
                        title: "Login Error",
                        message: "An error occurred during login.",
                        isSuccess: false
                    }));
                    window.location.href="/login";
                </script>`);
            }
        });
    });

    return router;
};
