# 💬 ChatApp - Aplikasi Chat Terdistribusi

Aplikasi chat real-time mirip WhatsApp (1-ke-1) dengan arsitektur terdistribusi.
Dibuat untuk Tugas Akhir mata kuliah **Sistem Paralel & Terdistribusi**.

## Arsitektur

```
┌──────────────┐
│   Browser    │──┐
│   (React)    │  │
└──────────────┘  │
                  │   ┌───────────────────────────┐
┌──────────────┐  │   │      Nginx (port 80)      │
│   Browser    │──┼──▶│    Load Balancer (HTTP     │
│   (React)    │  │   │    + WebSocket upgrade)    │
└──────────────┘  │   └─────┬─────┬─────┬─────────┘
                  │         │     │     │   round-robin
┌──────────────┐  │         ▼     ▼     ▼
│   Browser    │──┘   ┌─────┐ ┌─────┐ ┌─────┐
│   (React)    │      │:3001│ │:3002│ │:3003│  Node.js
└──────────────┘      └──┬──┘ └──┬──┘ └──┬──┘  instances
                         │      │      │
                         └──────┼──────┘
                                │
                         ┌──────┴──────┐
                         │    MySQL    │
                         │  (Prisma)   │
                         └─────────────┘
```

## Tech Stack

| Komponen       | Teknologi                              |
| -------------- | -------------------------------------- |
| Backend        | Node.js + Express.js + `ws` (WebSocket)|
| ORM            | Prisma                                 |
| Database       | MySQL                                  |
| Frontend       | React + Vite (JavaScript)              |
| Load Balancer  | Nginx (round-robin)                    |
| Auth           | JWT (jsonwebtoken) + bcryptjs          |

## Prasyarat

- **Node.js** v18 atau lebih baru
- **MySQL** berjalan di lokal
- **Nginx** untuk Windows (download dari https://nginx.org/en/download.html)

## Setup & Menjalankan (PowerShell)

### 1. Setup Database

Buat database MySQL bernama `chatapp`:

```sql
CREATE DATABASE chatapp;
```

### 2. Setup Backend

```powershell
cd tugas\backend

# Install dependensi
npm install

# Salin .env.example menjadi .env dan sesuaikan
Copy-Item .env.example .env
# Edit .env: sesuaikan DATABASE_URL, JWT_SECRET

# Jalankan migrasi database
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 3. Jalankan 3 Instance Backend (di 3 terminal berbeda)

**Terminal 1:**
```powershell
cd tugas\backend
$env:PORT=3001; node src/server.js
```

**Terminal 2:**
```powershell
cd tugas\backend
$env:PORT=3002; node src/server.js
```

**Terminal 3:**
```powershell
cd tugas\backend
$env:PORT=3003; node src/server.js
```

Tiap terminal akan menampilkan log koneksi dan pesan dengan format `[PORT]`.

### 4. Setup Nginx

1. Download Nginx untuk Windows dari https://nginx.org/en/download.html
2. Ekstrak ke `C:\nginx` (atau lokasi lain)
3. Salin file `tugas\nginx.conf` ke `C:\nginx\conf\nginx.conf` (timpa yang lama)
4. Jalankan Nginx:

```powershell
cd C:\nginx
.\nginx.exe
```

Untuk menghentikan:
```powershell
cd C:\nginx
.\nginx.exe -s stop
```

Untuk reload konfigurasi:
```powershell
cd C:\nginx
.\nginx.exe -s reload
```

### 5. Setup Frontend

```powershell
cd tugas\frontend

# Install dependensi
npm install

# Jalankan dev server
npm run dev
```

Buka browser di **http://localhost:5173**

## Skenario Demo

### Demo 1: Multi-klien di Server Berbeda

1. Buka **3 browser** (atau gunakan mode Incognito/InPrivate)
2. Register 2–3 akun berbeda (misal: `alice`, `bob`, `carol`)
3. Login di tiap browser dengan akun berbeda
4. Perhatikan **banner hijau** di atas: tiap klien bisa terhubung ke server berbeda (mis. "Terhubung ke Server 3001", "Terhubung ke Server 3002")
5. Kirim pesan antar klien, pesan terkirim dan tersimpan di database

### Demo 2: Failover & Auto-Reconnect

1. Saat klien sedang terhubung ke misal Server 3002
2. **Matikan** Server 3002 dengan menekan `Ctrl+C` di terminal tersebut
3. Banner berubah **kuning**: "Terputus, menyambung ulang... (percobaan ke-1)"
4. Setelah beberapa detik, klien terhubung ke server lain (3001 atau 3003)
5. Banner kembali **hijau** dengan nama server baru

### Demo 3: Antrian Pesan Offline

1. Matikan semua server backend (Ctrl+C di ketiga terminal)
2. Banner berubah **merah/kuning**: koneksi terputus
3. **Ketik dan kirim pesan** — pesan masuk antrian (ditandai ⏳)
4. Nyalakan kembali salah satu server backend
5. Pesan otomatis terkirim saat koneksi pulih (berubah jadi ✓✓)

### Demo 4: Load Balancer

1. Di halaman chat, klik tombol **📊** di sidebar
2. Klik **"Mulai Pengujian"**
3. Aplikasi memanggil `GET /api/info` sebanyak 30 kali lewat Nginx
4. Lihat **bar chart** pembagian request ke tiap server (mendekati rata: ~10 per server)

## Catatan Penting

### Tanpa Redis (Kondisi Saat Ini)

> ⚠️ **Tanpa Redis, pesan antar klien yang terhubung ke server BERBEDA belum tersampaikan secara realtime.**
>
> Contoh: Alice di Server 3001 mengirim pesan ke Bob di Server 3003. Pesan **tetap tersimpan** di database MySQL, tetapi Bob **tidak menerima notifikasi realtime**. Pesan akan muncul saat Bob:
> - Membuka/memilih ulang kontak Alice, atau
> - Reconnect ke server mana pun (riwayat dimuat ulang dari database)
>
> Ini adalah keterbatasan arsitektur tanpa message broker terpusat.

### Mengaktifkan Redis (Untuk Pengembangan Lanjut)

Untuk mengatasi keterbatasan di atas:

1. Install Redis dan `ioredis`:
   ```powershell
   npm install ioredis
   ```
2. Tambahkan `REDIS_URL` di file `.env`:
   ```
   REDIS_URL=redis://localhost:6379
   ```
3. Edit `src/pubsub/index.js`: uncomment class `RedisPubSub` dan ganti baris ekspor
4. File `src/ws/handler.js` **tidak perlu diubah** (desain adapter pattern)

## Struktur Folder

```
tugas/
├── nginx.conf                    # Konfigurasi Nginx load balancer
├── README.md                     # File ini
├── backend/
│   ├── package.json
│   ├── .env.example              # Template environment variable
│   ├── prisma/
│   │   └── schema.prisma         # Skema database (User, Message)
│   └── src/
│       ├── server.js             # Entry point: Express + WebSocket
│       ├── config.js             # Baca env: PORT, JWT_SECRET, dll
│       ├── middleware/
│       │   └── auth.js           # Verifikasi JWT middleware
│       ├── routes/
│       │   ├── auth.js           # Register, Login
│       │   └── chat.js           # Daftar user, riwayat pesan, health, info
│       ├── ws/
│       │   └── handler.js        # Logika WebSocket (koneksi, pesan, heartbeat)
│       └── pubsub/
│           └── index.js          # Adapter pub/sub (Local / Redis)
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx               # Routing: Login atau Chat
        ├── App.css               # Styling bergaya WhatsApp
        ├── config.js             # URL API dan WebSocket
        ├── hooks/
        │   └── useWebSocket.js   # Hook WebSocket + auto-reconnect + antrian
        └── pages/
            ├── Login.jsx         # Halaman login/register
            └── Chat.jsx          # Halaman chat utama
```

## API Endpoints

| Method | Endpoint               | Auth | Deskripsi                       |
| ------ | ---------------------- | ---- | ------------------------------- |
| POST   | `/api/auth/register`   | ❌   | Daftar akun baru                |
| POST   | `/api/auth/login`      | ❌   | Login, dapatkan token JWT       |
| GET    | `/api/users`           | ✅   | Daftar semua user lain          |
| GET    | `/api/messages/:userId`| ✅   | Riwayat chat dengan user        |
| GET    | `/api/health`          | ❌   | Health check server             |
| GET    | `/api/info`            | ❌   | Info server + jumlah koneksi WS |

## WebSocket Protocol

| Arah          | Tipe       | Payload                                                              |
| ------------- | ---------- | -------------------------------------------------------------------- |
| Server→Klien  | `system`   | `{ type, server, port }`                                             |
| Klien→Server  | `message`  | `{ type, clientMessageId, to, content }`                             |
| Server→Klien  | `ack`      | `{ type, clientMessageId, id, createdAt }`                           |
| Server→Klien  | `message`  | `{ type, id, from, to, content, createdAt, clientMessageId }`        |
| Server→Klien  | `error`    | `{ type, message }`                                                  |

## Lisensi

Tugas Akhir - Sistem Paralel & Terdistribusi
