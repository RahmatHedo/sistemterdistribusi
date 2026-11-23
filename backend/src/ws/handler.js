// Logika WebSocket: koneksi, pesan, heartbeat
const prisma = require('../lib/prisma');
const pubsub = require('../pubsub/index');
const config = require('../config');

// Map userId -> Set<WebSocket> untuk koneksi aktif di instance ini
const connections = new Map();

/**
 * Hitung total koneksi WebSocket aktif di instance ini
 */
function getTotalConnections() {
  let total = 0;
  for (const conns of connections.values()) {
    total += conns.size;
  }
  return total;
}

/**
 * Kirim data JSON ke satu WebSocket
 */
function sendJSON(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

/**
 * Kirim pesan ke semua koneksi user tertentu di instance ini
 */
function sendToUser(userId, data) {
  const userConns = connections.get(userId);
  if (userConns) {
    const payload = JSON.stringify(data);
    for (const ws of userConns) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }
}

/**
 * Tangani pesan chat dari klien
 */
async function handleChatMessage(ws, msg) {
  const { clientMessageId, to, content } = msg;

  // Validasi input
  if (!clientMessageId || !to || !content) {
    sendJSON(ws, { type: 'error', message: 'Data pesan tidak lengkap (clientMessageId, to, content wajib)' });
    return;
  }

  const receiverId = parseInt(to, 10);
  if (isNaN(receiverId)) {
    sendJSON(ws, { type: 'error', message: 'ID penerima tidak valid' });
    return;
  }

  try {
    // Cek duplikat berdasarkan clientMessageId (idempotent)
    const existing = await prisma.message.findUnique({
      where: { clientMessageId },
    });

    if (existing) {
      // Pesan sudah ada, kirim ack saja tanpa menyimpan ulang
      sendJSON(ws, {
        type: 'ack',
        clientMessageId,
        id: existing.id,
        createdAt: existing.createdAt,
      });
      return;
    }

    // Simpan pesan ke database
    const message = await prisma.message.create({
      data: {
        clientMessageId,
        senderId: ws.userId,
        receiverId,
        content,
      },
    });

    console.log(`[${config.PORT}] Pesan dari ${ws.username} (id:${ws.userId}) ke userId:${receiverId}: "${content.substring(0, 50)}"`);

    // Kirim konfirmasi (ack) ke pengirim
    sendJSON(ws, {
      type: 'ack',
      clientMessageId,
      id: message.id,
      createdAt: message.createdAt,
    });

    // Siapkan payload untuk penerima
    const deliveryPayload = {
      type: 'message',
      id: message.id,
      from: ws.userId,
      to: receiverId,
      content: message.content,
      createdAt: message.createdAt,
      clientMessageId,
    };

    // Publikasikan via pub/sub agar terkirim ke penerima
    // Jika pakai LocalPubSub, hanya sampai ke penerima di instance yang sama
    // Jika pakai RedisPubSub, sampai ke penerima di instance mana pun
    pubsub.publish('chat:deliver', {
      receiverId,
      message: deliveryPayload,
    });
  } catch (err) {
    console.error(`[${config.PORT}] Error simpan pesan:`, err.message);
    sendJSON(ws, { type: 'error', message: 'Gagal mengirim pesan' });
  }
}

/**
 * Setup WebSocket server: koneksi, pesan, heartbeat
 */
function setupWebSocket(wss) {
  // Subscribe channel pengiriman pesan
  // Handler ini meneruskan pesan ke penerima yang terhubung di instance ini
  pubsub.subscribe('chat:deliver', (data) => {
    const { receiverId, message } = data;
    sendToUser(receiverId, message);
  });

  wss.on('connection', (ws) => {
    const userId = ws.userId;
    const username = ws.username;

    // Tambahkan ke daftar koneksi aktif
    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId).add(ws);

    console.log(`[${config.PORT}] User ${username} (id:${userId}) terhubung (total koneksi: ${getTotalConnections()})`);

    // Kirim info server ke klien agar UI bisa menampilkan nama server
    sendJSON(ws, {
      type: 'system',
      server: `Server ${config.PORT}`,
      port: config.PORT,
    });

    // Heartbeat: tandai koneksi masih hidup saat menerima pong
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Tangani pesan masuk dari klien
    ws.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'message') {
          await handleChatMessage(ws, msg);
        }
        // Tipe pesan lain bisa ditambahkan di sini (typing indicator, dll)
      } catch (err) {
        console.error(`[${config.PORT}] Error parsing pesan WebSocket:`, err.message);
      }
    });

    // Tangani koneksi terputus
    ws.on('close', () => {
      const userConns = connections.get(userId);
      if (userConns) {
        userConns.delete(ws);
        if (userConns.size === 0) {
          connections.delete(userId);
        }
      }
      console.log(`[${config.PORT}] User ${username} (id:${userId}) terputus (total koneksi: ${getTotalConnections()})`);
    });

    ws.on('error', (err) => {
      console.error(`[${config.PORT}] WebSocket error untuk ${username}:`, err.message);
    });
  });

  // Interval heartbeat: ping setiap 20 detik, putuskan yang tidak membalas
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        console.log(`[${config.PORT}] Memutuskan koneksi yang tidak responsif`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 20000);

  // Bersihkan interval saat server WebSocket ditutup
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

module.exports = { setupWebSocket, connections, getTotalConnections };
