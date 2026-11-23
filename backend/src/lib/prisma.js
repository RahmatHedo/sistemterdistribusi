// Singleton Prisma Client — dipakai di seluruh aplikasi
// Mencegah membuat banyak koneksi database saat module di-import berkali-kali
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
