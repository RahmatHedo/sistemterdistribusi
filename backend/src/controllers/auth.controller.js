// Controller Autentikasi — logika bisnis register & login
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const config = require('../config');

/**
 * POST /api/auth/register
 * Daftarkan akun baru dengan username dan password
 */
const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password minimal 4 karakter' });
    }

    // Cek apakah username sudah dipakai
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }

    // Hash password dan simpan user baru
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    });

    console.log(`[${config.PORT}] User baru terdaftar: ${username}`);

    res.status(201).json({
      message: 'Registrasi berhasil',
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error(`[${config.PORT}] Error register:`, err.message);
    res.status(500).json({ error: 'Gagal mendaftarkan akun' });
  }
};

/**
 * POST /api/auth/login
 * Login dan dapatkan token JWT
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    // Cari user berdasarkan username
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Verifikasi password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Buat token JWT (berlaku 24 jam)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[${config.PORT}] User login: ${username}`);

    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error(`[${config.PORT}] Error login:`, err.message);
    res.status(500).json({ error: 'Gagal melakukan login' });
  }
};

module.exports = { register, login };
