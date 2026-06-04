/** @file Cliente HTTP de la aplicacion. Centraliza el manejo del token de autenticacion y las peticiones a la API REST. */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'glorys.auth.token';

const listeners = new Set();

/**
 * Utilidades de autenticacion para manejar el token JWT en localStorage y
 * notificar a los suscriptores cuando la sesion deja de ser valida.
 */
export const auth = {
  /**
   * Obtiene el token de autenticacion almacenado.
   *
   * @returns {string|null} Token guardado o null si no existe.
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  /**
   * Guarda o elimina el token de autenticacion en localStorage.
   *
   * @param {string|null} token - Token a guardar; si es falsy se elimina el existente.
   */
  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
  /**
   * Elimina el token almacenado y notifica a todos los suscriptores de sesion no autorizada.
   */
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    listeners.forEach((listener) => listener());
  },
  /**
   * Suscribe un listener que se ejecuta cuando la sesion se invalida (clear).
   *
   * @param {Function} listener - Callback a invocar al perder la sesion.
   * @returns {Function} Funcion para cancelar la suscripcion.
   */
  onUnauthorized(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

/**
 * Realiza una peticion HTTP a la API agregando cabeceras JSON y el token de autenticacion.
 * Ante una respuesta 401 limpia la sesion; ante otros errores lanza una excepcion con el mensaje del servidor.
 *
 * @param {string} path - Ruta relativa del endpoint (se concatena a API_URL).
 * @param {Object} [options] - Opciones de fetch (method, body, headers, etc.).
 * @returns {Promise<any|null>} Cuerpo de la respuesta parseado como JSON, o null si es 204.
 * @throws {Error} Si la respuesta no es satisfactoria o la sesion expiro.
 */
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = auth.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    auth.clear();
    const error = await response.json().catch(() => ({ message: 'Sesion expirada.' }));
    throw new Error(error.message || 'Sesion expirada.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Cliente con metodos para los verbos HTTP mas comunes sobre la API.
 */
export const api = {
  /**
   * Realiza una peticion GET.
   *
   * @param {string} path - Ruta del endpoint.
   * @returns {Promise<any|null>} Respuesta parseada como JSON.
   */
  get: (path) => request(path),
  /**
   * Realiza una peticion POST con cuerpo JSON.
   *
   * @param {string} path - Ruta del endpoint.
   * @param {Object} body - Datos a enviar en el cuerpo.
   * @returns {Promise<any|null>} Respuesta parseada como JSON.
   */
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  /**
   * Realiza una peticion PUT con cuerpo JSON.
   *
   * @param {string} path - Ruta del endpoint.
   * @param {Object} body - Datos a enviar en el cuerpo.
   * @returns {Promise<any|null>} Respuesta parseada como JSON.
   */
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  /**
   * Realiza una peticion DELETE.
   *
   * @param {string} path - Ruta del endpoint.
   * @returns {Promise<any|null>} Respuesta parseada como JSON.
   */
  delete: (path) => request(path, { method: 'DELETE' })
};
