// Controller Chat — logika bisnis untuk user, pesan, health, info
const prisma = require('../lib/prisma');
const config = require('../config');

/**
 * GET /api/users
 * Daftar semua user kecuali user yang sedang login
 */
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.user.id } },
      select: { id: true, username: true, createdAt: true },
      orderBy: { username: 'asc' },
    });

    res.json(users);
  } catch (err) {
    console.error(`[${config.PORT}] Error ambil daftar user:`, err.message);
    res.status(500).json({ error: 'Gagal mengambil daftar user' });
  }
};

/**
 * GET /api/messages/:userId
 * Riwayat chat antara user yang login dengan user tertentu, urut berdasarkan waktu
 */
const getMessages = async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId, 10);
    if (isNaN(otherUserId)) {
      return res.status(400).json({ error: 'userId tidak valid' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        clientMessageId: true,
        senderId: true,
        receiverId: true,
        content: true,
        createdAt: true,
      },
    });

    res.json(messages);
  } catch (err) {
    console.error(`[${config.PORT}] Error ambil riwayat pesan:`, err.message);
    res.status(500).json({ error: 'Gagal mengambil riwayat pesan' });
  }
};

/**
 * GET /api/health
 * Health check — untuk monitoring apakah server hidup
 */
const healthCheck = (_req, res) => {
  res.json({ status: 'ok', server: `Server ${config.PORT}` });
};

/**
 * GET /api/info
 * Info server: nama, port, dan jumlah koneksi WebSocket aktif
 */
const getInfo = (req, res) => {
  const getTotal = req.app.get('getTotalConnections');
  const jumlahKoneksi = getTotal ? getTotal() : 0;

  res.json({
    server: `Server ${config.PORT}`,
    port: config.PORT,
    jumlahKoneksi,
  });
};

module.exports = { getUsers, getMessages, healthCheck, getInfo };
