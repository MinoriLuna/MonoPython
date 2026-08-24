const express = require('express');
const router = express.Router();

router.get('/processing_qrcode_data/:propertyID', async (req, res) => {
    const propertyID = req.params.propertyID;

    if (!propertyID) {
        return res.status(400).send("Invalid QR code. Property ID is missing.");
    }

    // Redirect to the property question page
    res.redirect(`/property-question?propertyID=${propertyID}`);
});

module.exports = router;
