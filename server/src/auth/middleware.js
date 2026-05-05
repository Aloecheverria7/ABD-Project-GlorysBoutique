import { verifyToken } from './tokens.js';

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
