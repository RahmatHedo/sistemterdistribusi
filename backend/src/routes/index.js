// Central Route Index — kumpulkan semua route di satu tempat
// Tambahkan route baru di sini agar server.js tetap bersih
const express = require('express');
const authRoutes = require('./auth.routes');
const chatRoutes = require('./chat.routes');

const router = express.Router();

// /api/auth/* — register, login
router.use('/auth', authRoutes);

// /api/* — users, messages, health, info
router.use('/', chatRoutes);

// Tambahkan route baru di sini, contoh:
// const groupRoutes = require('./group.routes');
// router.use('/groups', groupRoutes);

module.exports = router;
