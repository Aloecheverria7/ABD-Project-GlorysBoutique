/** @file Hook de autenticacion. Gestiona la sesion del usuario: verificacion inicial, login y logout. */
import { useEffect, useState } from 'react';
import { api, auth } from '../api.js';

/**
 * Hook que maneja el estado de autenticacion del usuario.
 * Al montar verifica si existe un token valido recuperando el usuario actual, y
 * se suscribe a los eventos de sesion no autorizada para limpiar el usuario.
 *
 * @returns {Object} Estado y acciones de autenticacion.
 * @returns {{ id: number, rol: string }|null} return.user - Usuario autenticado o null.
 * @returns {boolean} return.checking - Indica si aun se esta verificando la sesion inicial.
 * @returns {Function} return.login - Funcion para iniciar sesion (username, password).
 * @returns {Function} return.logout - Funcion para cerrar la sesion.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  /**
   * Verifica la sesion al iniciar: si hay token recupera el usuario actual,
   * y en cualquier caso marca como finalizada la comprobacion.
   *
   * @returns {Promise<void>}
   */
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

  /**
   * Inicia sesion con las credenciales dadas, guarda el token y fija el usuario.
   *
   * @param {string} username - Nombre de usuario.
   * @param {string} password - Contrasena del usuario.
   * @returns {Promise<void>}
   */
  async function login(username, password) {
    const { token, user } = await api.post('/auth/login', { username, password });
    auth.setToken(token);
    setUser(user);
  }

  /**
   * Cierra la sesion limpiando el token almacenado y el usuario en estado.
   */
  function logout() {
    auth.clear();
    setUser(null);
  }

  return { user, checking, login, logout };
}
