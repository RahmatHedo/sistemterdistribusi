import { useState } from 'react';
import Login from './pages/Login';
import Chat from './pages/Chat';

function App() {
  // State autentikasi: token dan data user
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        return { token, user: JSON.parse(user) };
      } catch {
        return null;
      }
    }
    return null;
  });

  // Handler login berhasil
  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setAuth({ token, user });
  };

  // Handler logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth(null);
  };

  // Tampilkan halaman login atau chat berdasarkan status autentikasi
  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return <Chat token={auth.token} user={auth.user} onLogout={handleLogout} />;
}

export default App;
