const express = require('express');
const router = express.Router();
const controller = require('./track.controller');

router.post('/create', controller.createTrack);
router.get('/', controller.getTracks);

module.exports = router;