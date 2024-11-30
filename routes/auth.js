const express = require('express');
const { getViewerToken,getFullAccessToken } = require('../services/aps.js');

let router = express.Router();

router.get('/api/auth/token', async function (req, res, next) {
    try {
        res.json(await getViewerToken());
    } catch (err) {
        next(err);
    }
});
router.get('/api/auth/full_token', async function (req, res, next) {
    try {
        res.json(await getFullAccessToken());
    } catch (err) {
        next(err);
    }
});

module.exports = router;
