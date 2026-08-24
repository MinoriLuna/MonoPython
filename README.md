# Monopython

Monopython is a hybrid web-based board game based on the classic game of Monopoly, developed to help players learn Python programming concepts through gameplay[cite: 4].

## Features

* **User Authentication:** Registration, login, and profile management with secure password hashing[cite: 4].
* **Real-Time Multiplayer:** Turn-based gameplay, virtual dice rolling, and live game state synchronization supported by Socket.io[cite: 4].
* **QR Code Integration:** Dynamic QR code generation for players to join game lobbies, and a built-in scanner to bridge physical board spaces with digital questions[cite: 4].
* **Question-Based Real Estate:** Players landing on unowned properties must correctly answer a Python question to purchase the property[cite: 4]. If landing on an owned property, players can answer a question to avoid paying rent[cite: 4].
* **Game Logging:** Real-time tracking of player actions, property purchases, and rent payments[cite: 4].
* **Game Summary:** A post-game leaderboard displaying final balances and the overall winner[cite: 4].

## Tech Stack

* **Backend:** Node.js, Express.js[cite: 4]
* **Frontend:** HTML5, CSS, Pug template engine[cite: 4]
* **Real-Time Communication:** Socket.io[cite: 4]
* **Database:** MySQL[cite: 4]
* **Authentication & Security:** bcrypt, express-session[cite: 4]
