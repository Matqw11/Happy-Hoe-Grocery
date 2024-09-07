const express = require('express');
const router = express.Router();
const Sales = require('../models/Sales');

// Fetch all sales
router.get('/allSales', async (req, res) => {
    try {
        const sales = await Sales.find();
        res.status(200).json(sales);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch sales', error });
    }
});

module.exports = router;