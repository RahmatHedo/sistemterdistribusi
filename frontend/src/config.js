/**
 * Konfigurasi URL untuk koneksi ke backend via Nginx
 * Ganti BASE_URL jika demo dari perangkat lain (misal IP laptop)
 */

// Base URL mengarah ke Nginx load balancer (port 80)
const BASE_URL = 'http://localhost';

export const API_URL = `${BASE_URL}/api`;
export const WS_URL = `ws://localhost/ws`;
