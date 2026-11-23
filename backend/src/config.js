// Konfigurasi server - membaca dari environment variable
require('dotenv').config();

const config = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret_ganti_ini',
  DATABASE_URL: process.env.DATABASE_URL,
  // REDIS_URL: process.env.REDIS_URL, // Aktifkan saat menggunakan Redis
};

module.exports = config;
