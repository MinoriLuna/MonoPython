document.addEventListener("DOMContentLoaded", function () {
    const rollDiceBtn = document.getElementById("roll-dice-btn");
    const diceResult = document.getElementById("dice-result");

    rollDiceBtn.addEventListener("click", function () {
        const roll = Math.floor(Math.random() * 6) + 1; // Generate a random number between 1-6
        diceResult.textContent = roll; // Display result

    });
});
