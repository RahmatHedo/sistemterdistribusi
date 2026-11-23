/**
 * Adapter Pub/Sub untuk komunikasi antar instance server.
 *
 * Saat ini menggunakan LocalPubSub (EventEmitter) yang hanya bekerja
 * dalam satu proses. Pesan antar klien di server BERBEDA belum
 * tersampaikan secara realtime, tetapi tetap tersimpan di database
 * dan akan muncul saat riwayat chat dimuat ulang.
 *
 * === CARA MENGAKTIFKAN REDIS ===
 * 1. Install ioredis: npm install ioredis
 * 2. Tambahkan REDIS_URL di file .env
 * 3. Uncomment class RedisPubSub di bawah
 * 4. Ganti baris ekspor di paling bawah:
 *      const pubsub = new RedisPubSub(process.env.REDIS_URL);
 * 5. ws/handler.js TIDAK perlu diubah sama sekali
 */

const EventEmitter = require('events');

// === Implementasi lokal (satu proses saja) ===
class LocalPubSub {
  constructor() {
    this.emitter = new EventEmitter();
    // Naikkan batas listener agar tidak warning saat banyak subscribe
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publikasikan payload ke channel tertentu
   * @param {string} channel - Nama channel
   * @param {object} payload - Data yang akan dikirim
   */
  publish(channel, payload) {
    this.emitter.emit(channel, payload);
  }

  /**
   * Daftarkan handler untuk menerima pesan dari channel
   * @param {string} channel - Nama channel
   * @param {function} handler - Fungsi callback(payload)
   */
  subscribe(channel, handler) {
    this.emitter.on(channel, handler);
  }
}

// === Implementasi Redis (uncomment saat Redis sudah tersedia) ===
// const Redis = require('ioredis');
//
// class RedisPubSub {
//   constructor(redisUrl) {
//     // Buat dua koneksi: satu untuk publish, satu untuk subscribe
//     // (ioredis mengharuskan koneksi terpisah untuk subscriber)
//     this.pub = new Redis(redisUrl);
//     this.sub = new Redis(redisUrl);
//     this.handlers = new Map(); // channel -> [handler]
//
//     this.sub.on('message', (channel, message) => {
//       const handlers = this.handlers.get(channel) || [];
//       const payload = JSON.parse(message);
//       handlers.forEach((handler) => handler(payload));
//     });
//
//     console.log('[PubSub] Terhubung ke Redis:', redisUrl);
//   }
//
//   publish(channel, payload) {
//     this.pub.publish(channel, JSON.stringify(payload));
//   }
//
//   subscribe(channel, handler) {
//     if (!this.handlers.has(channel)) {
//       this.handlers.set(channel, []);
//       this.sub.subscribe(channel);
//     }
//     this.handlers.get(channel).push(handler);
//   }
// }

// --- Pilih implementasi ---
// Ganti LocalPubSub dengan RedisPubSub(process.env.REDIS_URL) saat Redis aktif
const pubsub = new LocalPubSub();

module.exports = pubsub;
