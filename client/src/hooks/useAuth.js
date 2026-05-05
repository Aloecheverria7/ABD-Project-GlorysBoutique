import { useEffect, useState } from 'react';
import { api, auth } from '../api.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  async function bootstrap() {
    if (!auth.getToken()) {
      setChecking(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    bootstrap();
    return auth.onUnauthorized(() => setUser(null));
  }, []);

  async function login(username, password) {
    const { token, user } = await api.post('/auth/login', { username, password });
    auth.setToken(token);
    setUser(user);
  }

  function logout() {
    auth.clear();
    setUser(null);
  }

  return { user, checking, login, logout };
}
