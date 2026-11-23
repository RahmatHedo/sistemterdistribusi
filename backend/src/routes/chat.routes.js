// Route Chat — hanya definisi endpoint, logika ada di controller
const express = require('express');
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Endpoint publik (tanpa auth)
router.get('/health', chatController.healthCheck);
router.get('/info', chatController.getInfo);

// Endpoint yang butuh JWT
router.get('/users', authMiddleware, chatController.getUsers);
router.get('/messages/:userId', authMiddleware, chatController.getMessages);

module.exports = router;
