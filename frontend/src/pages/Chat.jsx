import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Halaman Chat utama bergaya WhatsApp
 * - Sidebar daftar kontak (kiri)
 * - Area percakapan (kanan)
 * - Banner status koneksi (atas)
 * - Panel info load balancer
 */
function Chat({ token, user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({}); // { [userId]: [msg, ...] }
  const [inputText, setInputText] = useState('');
  const [showLBPanel, setShowLBPanel] = useState(false);
  const [lbResults, setLbResults] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // WebSocket hook
  const { status, serverInfo, retryCount, sendMessage, disconnect, addMessageHandler, getQueuedMessages } =
    useWebSocket(token);

  // Header auth untuk fetch
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Ambil daftar user saat pertama kali
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar user:', err);
    }
  };

  // Ambil riwayat chat saat memilih user atau setelah reconnect
  const fetchHistory = useCallback(
    async (userId) => {
      try {
        const res = await fetch(`${API_URL}/messages/${userId}`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          // Format pesan dari API agar seragam
          const formatted = data.map((m) => ({
            id: m.id,
            clientMessageId: m.clientMessageId,
            from: m.senderId,
            to: m.receiverId,
            content: m.content,
            createdAt: m.createdAt,
            status: 'sent', // pesan dari database sudah pasti terkirim
          }));
          setMessages((prev) => ({ ...prev, [userId]: formatted }));
        }
      } catch (err) {
        console.error('Gagal mengambil riwayat pesan:', err);
      }
    },
    [token]
  );

  // Muat riwayat saat memilih kontak
  useEffect(() => {
    if (selectedUser) {
      fetchHistory(selectedUser.id);
    }
  }, [selectedUser]);

  // Muat ulang riwayat setelah reconnect
  useEffect(() => {
    if (status === 'connected' && selectedUser) {
      fetchHistory(selectedUser.id);
    }
  }, [status]);

  // Tangani pesan masuk dari WebSocket
  useEffect(() => {
    const removeHandler = addMessageHandler((data) => {
      if (data.type === 'message') {
        // Pesan masuk dari orang lain
        const chatPartnerId = data.from === user.id ? data.to : data.from;

        setMessages((prev) => {
          const existing = prev[chatPartnerId] || [];
          // Cegah duplikat berdasarkan clientMessageId
          if (existing.some((m) => m.clientMessageId === data.clientMessageId)) {
            return prev;
          }
          return {
            ...prev,
            [chatPartnerId]: [
              ...existing,
              {
                id: data.id,
                clientMessageId: data.clientMessageId,
                from: data.from,
                to: data.to,
                content: data.content,
                createdAt: data.createdAt,
                status: 'sent',
              },
            ],
          };
        });
      } else if (data.type === 'ack') {
        // Konfirmasi pesan terkirim - update status dari 'pending' ke 'sent'
        setMessages((prev) => {
          const updated = { ...prev };
          for (const userId in updated) {
            updated[userId] = updated[userId].map((m) =>
              m.clientMessageId === data.clientMessageId
                ? { ...m, id: data.id, createdAt: data.createdAt, status: 'sent' }
                : m
            );
          }
          return updated;
        });
      }
    });

    return removeHandler;
  }, [addMessageHandler, user.id]);

  // Auto scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  // Kirim pesan
  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser) return;

    const clientMessageId = crypto.randomUUID();
    const msg = {
      type: 'message',
      clientMessageId,
      to: selectedUser.id,
      content: inputText.trim(),
    };

    // Tentukan status: pending jika offline, sending jika online
    const isOnline = status === 'connected';
    const displayStatus = isOnline ? 'sending' : 'pending';

    // Tambahkan ke daftar pesan lokal (optimistic update)
    setMessages((prev) => ({
      ...prev,
      [selectedUser.id]: [
        ...(prev[selectedUser.id] || []),
        {
          clientMessageId,
          from: user.id,
          to: selectedUser.id,
          content: inputText.trim(),
          createdAt: new Date().toISOString(),
          status: displayStatus,
        },
      ],
    }));

    // Kirim via WebSocket (atau masuk antrian jika offline)
    sendMessage(msg);
    setInputText('');
  };

  // Panel load balancer: panggil /api/info 30 kali berurutan
  const testLoadBalancer = async () => {
    setLbLoading(true);
    setLbResults(null);
    const counts = {};

    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${API_URL}/info`);
        if (res.ok) {
          const data = await res.json();
          const serverName = data.server;
          counts[serverName] = (counts[serverName] || 0) + 1;
        }
      } catch {
        // Abaikan error
      }
    }

    setLbResults(counts);
    setLbLoading(false);
  };

  // Logout
  const handleLogout = () => {
    disconnect();
    onLogout();
  };

  // Format waktu pesan
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Pesan di chat yang sedang aktif
  const currentMessages = selectedUser ? messages[selectedUser.id] || [] : [];

  // Warna dan teks banner status koneksi
  const getStatusBanner = () => {
    if (status === 'connected' && serverInfo) {
      return { color: '#4caf50', text: `Terhubung ke ${serverInfo.server}` };
    }
    if (status === 'connecting' || (status === 'disconnected' && retryCount > 0)) {
      return { color: '#ff9800', text: `Terputus, menyambung ulang... (percobaan ke-${retryCount})` };
    }
    return { color: '#f44336', text: 'Offline' };
  };

  const statusBanner = getStatusBanner();

  return (
    <div className="chat-app">
      {/* Banner status koneksi - selalu terlihat */}
      <div className="status-banner" style={{ backgroundColor: statusBanner.color }}>
        <span className="status-dot" />
        {statusBanner.text}
      </div>

      <div className="chat-layout">
        {/* === SIDEBAR === */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>💬 ChatApp</h3>
            <div className="sidebar-actions">
              <button className="btn-icon" onClick={() => setShowLBPanel(!showLBPanel)} title="Info Load Balancer">
                📊
              </button>
              <button className="btn-icon" onClick={handleLogout} title="Logout">
                🚪
              </button>
            </div>
          </div>

          <div className="sidebar-user-info">
            Masuk sebagai: <strong>{user.username}</strong>
          </div>

          <div className="contact-list">
            {users.length === 0 && (
              <div className="no-contacts">Belum ada kontak. Daftarkan user lain terlebih dahulu.</div>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                className={`contact-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div className="contact-avatar">{u.username.charAt(0).toUpperCase()}</div>
                <div className="contact-name">{u.username}</div>
              </div>
            ))}
          </div>
        </div>

        {/* === AREA CHAT === */}
        <div className="chat-area">
          {!selectedUser ? (
            <div className="chat-placeholder">
              <div className="placeholder-icon">💬</div>
              <h2>ChatApp Terdistribusi</h2>
              <p>Pilih kontak di sebelah kiri untuk memulai percakapan</p>
            </div>
          ) : (
            <>
              {/* Header chat */}
              <div className="chat-header">
                <div className="chat-header-avatar">{selectedUser.username.charAt(0).toUpperCase()}</div>
                <h3>{selectedUser.username}</h3>
              </div>

              {/* Daftar pesan */}
              <div className="messages-container">
                {currentMessages.length === 0 && (
                  <div className="no-messages">Belum ada pesan. Kirim pesan pertama!</div>
                )}
                {currentMessages.map((msg, idx) => {
                  const isMine = msg.from === user.id;
                  return (
                    <div key={msg.clientMessageId || idx} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
                      <div className={`message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                        <div className="message-content">{msg.content}</div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            <span className="message-status">
                              {msg.status === 'pending' && ' ⏳'}
                              {msg.status === 'sending' && ' ⏳'}
                              {msg.status === 'sent' && ' ✓✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input pesan */}
              <form className="message-input-area" onSubmit={handleSend}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ketik pesan..."
                  autoFocus
                />
                <button type="submit" disabled={!inputText.trim()}>
                  Kirim
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* === PANEL INFO LOAD BALANCER === */}
      {showLBPanel && (
        <div className="lb-panel-overlay" onClick={() => setShowLBPanel(false)}>
          <div className="lb-panel" onClick={(e) => e.stopPropagation()}>
            <h3>📊 Info Load Balancer</h3>
            <p>Memanggil <code>GET /api/info</code> sebanyak 30 kali lewat Nginx untuk melihat pembagian beban.</p>
            <button className="btn-primary" onClick={testLoadBalancer} disabled={lbLoading}>
              {lbLoading ? 'Menguji...' : 'Mulai Pengujian'}
            </button>

            {lbResults && (
              <div className="lb-results">
                <h4>Hasil:</h4>
                {Object.entries(lbResults)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([server, count]) => (
                    <div key={server} className="lb-bar-row">
                      <span className="lb-label">
                        {server}: {count}x
                      </span>
                      <div className="lb-bar-bg">
                        <div
                          className="lb-bar-fill"
                          style={{ width: `${(count / 30) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                <p className="lb-total">Total: 30 request</p>
              </div>
            )}

            <button className="btn-secondary" onClick={() => setShowLBPanel(false)}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
