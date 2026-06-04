/** @file Middlewares de Express para autenticacion JWT y control de acceso por rol. */
import { verifyToken } from './tokens.js';

/**
 * Verifica el token JWT del encabezado Authorization Bearer y adjunta el usuario a req.user.
 * Responde 401 si el token falta o es invalido.
 *
 * @param {import('express').Request} req - Peticion HTTP; usa el header Authorization Bearer.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Continua si el token es valido.
 * @returns {void}
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Token de acceso requerido.' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      rol_id: payload.rol_id,
      rol: payload.rol
    };
    next();
  } catch {
    res.status(401).json({ message: 'Token invalido o expirado.' });
  }
}

/**
 * Crea un middleware que restringe el acceso a los roles indicados.
 * Responde 401 si no hay usuario autenticado y 403 si el rol no esta permitido.
 *
 * @param {...string} allowedRoles - Nombres de roles autorizados para continuar.
 * @returns {import('express').RequestHandler} Middleware de Express que valida el rol de req.user.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }
    if (!allowedRoles.includes(req.user.rol)) {
      res.status(403).json({ message: 'No tienes permiso para realizar esta accion.' });
      return;
    }
    next();
  };
}
