import { useRef, useState, useEffect, useCallback } from 'react';
import { WS_URL } from '../config';

/**
 * Hook WebSocket dengan fitur:
 * - Auto-reconnect (exponential backoff: 1s, 2s, 4s, maks 10s)
 * - Antrian pesan saat koneksi putus
 * - Status koneksi dan info server
 */
export function useWebSocket(token) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected'); // connected | connecting | disconnected
  const [serverInfo, setServerInfo] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Ref untuk tracking internal (tidak perlu trigger re-render)
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const messageQueueRef = useRef([]); // antrian pesan saat offline
  const handlersRef = useRef([]); // callback listener pesan masuk
  const intentionalCloseRef = useRef(false);

  // Daftarkan listener pesan (dipanggil dari komponen Chat)
  const addMessageHandler = useCallback((handler) => {
    handlersRef.current.push(handler);
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  // Fungsi koneksi WebSocket
  const connect = useCallback(() => {
    if (!token) return;

    // Tutup koneksi lama (jika ada) agar tidak ada koneksi ganda
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      try {
        oldWs.close();
      } catch {
        // abaikan
      }
    }

    setStatus('connecting');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Abaikan socket lama yang sudah digantikan
      if (wsRef.current !== ws) return;

      setStatus('connected');
      retryCountRef.current = 0;
      setRetryCount(0);

      // Kirim semua pesan yang ada di antrian
      const queue = [...messageQueueRef.current];
      messageQueueRef.current = [];
      queue.forEach((msg) => {
        ws.send(JSON.stringify(msg));
      });
    };

    ws.onmessage = (event) => {
      // Abaikan pesan dari socket lama
      if (wsRef.current !== ws) return;

      try {
        const data = JSON.parse(event.data);

        // Simpan info server dari pesan system
        if (data.type === 'system') {
          setServerInfo(data);
        }

        // Teruskan ke semua handler yang terdaftar
        handlersRef.current.forEach((handler) => handler(data));
      } catch (err) {
        console.error('Error parsing pesan WebSocket:', err);
      }
    };

    ws.onclose = () => {
      // Abaikan close dari socket lama (misal StrictMode / reconnect)
      if (wsRef.current !== ws) return;
      wsRef.current = null;

      // Jangan reconnect kalau sengaja ditutup (misal logout)
      if (intentionalCloseRef.current) {
        setStatus('disconnected');
        return;
      }

      setStatus('disconnected');

      // Auto-reconnect dengan exponential backoff
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
      console.log(`WebSocket terputus, mencoba ulang dalam ${delay}ms (percobaan ke-${retryCountRef.current})`);
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      if (wsRef.current !== ws) return;
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, [token]);

  // Koneksi awal dan cleanup
  useEffect(() => {
    intentionalCloseRef.current = false;
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Kirim pesan (atau masukkan antrian jika sedang offline)
  const sendMessage = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      // Simpan ke antrian, akan dikirim otomatis saat reconnect
      messageQueueRef.current.push(msg);
    }
  }, []);

  // Tutup koneksi secara sengaja
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (wsRef.current) wsRef.current.close();
  }, []);

  // Ambil pesan yang masih di antrian
  const getQueuedMessages = useCallback(() => {
    return [...messageQueueRef.current];
  }, []);

  return {
    status,
    serverInfo,
    retryCount,
    sendMessage,
    disconnect,
    addMessageHandler,
    getQueuedMessages,
  };
}
