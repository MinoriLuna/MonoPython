const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    router.get('/register', (req, res) => {
        res.render('register');
    });

    router.post('/register', async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.send(`<script>
                sessionStorage.setItem('notification', JSON.stringify({
                    title: "Registration Failed",
                    message: "Please enter both username and password!",
                    isSuccess: false
                }));
                window.location.href="/register";
            </script>`);
        }

        if (password.length < 4 || password.length > 10) {
            return res.send(`<script>
                sessionStorage.setItem('notification', JSON.stringify({
                    title: "Registration Failed",
                    message: "Password must be between 4 and 10 characters long!",
                    isSuccess: false
                }));
                window.location.href="/register";
            </script>`);
        }

        try {
            // Check if username already exists
            db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.send(`<script>
                        sessionStorage.setItem('notification', JSON.stringify({
                            title: "Registration Error",
                            message: "An error occurred while processing your request.",
                            isSuccess: false
                        }));
                        window.location.href="/register";
                    </script>`);
                }

                if (results.length > 0) {
                    return res.send(`<script>
                        sessionStorage.setItem('notification', JSON.stringify({
                            title: "Registration Failed",
                            message: "Username already exists!",
                            isSuccess: false
                        }));
                        window.location.href="/register";
                    </script>`);
                }

                // Hash password before storing
                const hashedPassword = await bcrypt.hash(password, 10);

                db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
                    if (err) {
                        console.error('Registration error:', err);
                        return res.send(`<script>
                            sessionStorage.setItem('notification', JSON.stringify({
                                title: "Registration Failed",
                                message: "Error registering user! Username might already exist.",
                                isSuccess: false
                            }));
                            window.location.href="/register";
                        </script>`);
                    }
                    res.send(`<script>
                        sessionStorage.setItem('notification', JSON.stringify({
                            title: "Registration Successful",
                            message: "You can now log in!",
                            isSuccess: true
                        }));
                        window.location.href="/login";
                    </script>`);
                });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.send(`<script>
                sessionStorage.setItem('notification', JSON.stringify({
                    title: "Registration Error",
                    message: "An error occurred while processing your request.",
                    isSuccess: false
                }));
                window.location.href="/register";
            </script>`);
        }
    });

    return router;
};