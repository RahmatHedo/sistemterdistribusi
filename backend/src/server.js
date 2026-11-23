// Entry point: Express HTTP server + WebSocket server
const http = require('http');
const url = require('url');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const config = require('./config');
const routes = require('./routes');
const { setupWebSocket, getTotalConnections } = require('./ws/handler');

// Inisialisasi Express
const app = express();
app.use(cors());
app.use(express.json());

// Simpan fungsi getTotalConnections agar bisa diakses dari route /api/info
app.set('getTotalConnections', getTotalConnections);

// Daftarkan semua route API (auth, chat, dll) melalui central router
app.use('/api', routes);

// Buat HTTP server dari Express app
const server = http.createServer(app);

// Buat WebSocket server dalam mode noServer agar bisa verifikasi token saat upgrade
const wss = new WebSocketServer({ noServer: true });

// Tangani upgrade HTTP -> WebSocket, verifikasi JWT sebelum menerima koneksi
server.on('upgrade', (request, socket, head) => {
  const { pathname, query } = url.parse(request.url, true);

  // Hanya terima upgrade di path /ws
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const token = query.token;
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    // Verifikasi token JWT
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Token valid, lanjutkan upgrade WebSocket
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Simpan info user di objek WebSocket
      ws.userId = decoded.id;
      ws.username = decoded.username;
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    console.log(`[${config.PORT}] Koneksi WebSocket ditolak: token tidak valid`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

// Setup logika WebSocket (koneksi, pesan, heartbeat)
setupWebSocket(wss);

// Mulai server, bind ke 0.0.0.0 agar bisa diakses dari luar
server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`[${config.PORT}] ======================================`);
  console.log(`[${config.PORT}] Server chat berjalan di port ${config.PORT}`);
  console.log(`[${config.PORT}] HTTP : http://0.0.0.0:${config.PORT}`);
  console.log(`[${config.PORT}] WS   : ws://0.0.0.0:${config.PORT}/ws`);
  console.log(`[${config.PORT}] ======================================`);
});

// Tangani shutdown yang rapi (SIGINT = Ctrl+C, SIGTERM = kill)
function gracefulShutdown(signal) {
  console.log(`\n[${config.PORT}] Menerima sinyal ${signal}, menutup server...`);

  // Tutup semua koneksi WebSocket
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server sedang dimatikan');
  });

  // Tutup WebSocket server
  wss.close(() => {
    console.log(`[${config.PORT}] WebSocket server ditutup`);
  });

  // Tutup HTTP server
  server.close(() => {
    console.log(`[${config.PORT}] HTTP server ditutup`);
    process.exit(0);
  });

  // Paksa tutup jika terlalu lama (5 detik)
  setTimeout(() => {
    console.error(`[${config.PORT}] Timeout, menutup paksa`);
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
