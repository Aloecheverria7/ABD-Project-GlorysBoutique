/** @file Rutas de autenticacion: inicio de sesion y consulta del usuario autenticado. */
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { Role, Usuario } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { signToken } from '../auth/tokens.js';
import { asyncHandler } from '../utils/http.js';

export const authRouter = Router();

/**
 * Construye la representacion publica de un usuario, sin exponer datos sensibles como la contrasena.
 *
 * @param {object} usuario - Instancia o registro del usuario con id, username, rol_id y activo.
 * @param {string|null} rolNombre - Nombre del rol asociado al usuario.
 * @returns {{ id: number, username: string, rol_id: number, rol: string|null, activo: boolean }} Datos publicos del usuario.
 */
function publicUser(usuario, rolNombre) {
  return {
    id: usuario.id,
    username: usuario.username,
    rol_id: usuario.rol_id,
    rol: rolNombre,
    activo: usuario.activo
  };
}

/**
 * POST /api/auth/login - Autentica un usuario y emite un token JWT.
 * Verifica la contrasena con bcrypt; si el hash almacenado no esta cifrado lo migra a bcrypt tras un inicio de sesion correcto.
 *
 * @param {import('express').Request} req - req.body con { username, password }.
 * @param {import('express').Response} res - Responde 200 con { token, user }, 400 si faltan credenciales o 401 si son invalidas o el usuario esta inactivo.
 * @returns {Promise<void>}
 */
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ message: 'Usuario y contrasena son requeridos.' });
    return;
  }

  const user = await Usuario.findOne({
    where: { username },
    include: [{ model: Role, attributes: ['id', 'nombre'] }]
  });

  // Regla de negocio: un usuario inactivo (activo = false) no puede iniciar sesion, aunque la
  // contrasena sea correcta. Se devuelve el mismo mensaje generico que con credenciales malas
  // para no revelar si el usuario existe.
  if (!user || !user.activo) {
    res.status(401).json({ message: 'Credenciales invalidas.' });
    return;
  }

  // Compatibilidad: los hashes de bcrypt empiezan con "$2". Si la contrasena guardada no es un
  // hash, se trata como texto plano heredado y se compara directamente. Esto permite migrar
  // usuarios antiguos sin forzar un reseteo.
  const stored = user.password || '';
  const matches = stored.startsWith('$2')
    ? await bcrypt.compare(password, stored)
    : stored === password;

  if (!matches) {
    res.status(401).json({ message: 'Credenciales invalidas.' });
    return;
  }

  // Auto-upgrade: si la contrasena estaba en texto plano y el login fue correcto, se reemplaza por
  // su hash bcrypt. Asi la base se va asegurando de forma transparente en el primer login de cada
  // usuario heredado.
  if (!stored.startsWith('$2')) {
    await user.update({ password: await bcrypt.hash(password, 10) });
  }

  const rolNombre = user.Role?.nombre || null;
  const token = signToken({
    sub: user.id,
    username: user.username,
    rol_id: user.rol_id,
    rol: rolNombre
  });

  res.json({ token, user: publicUser(user, rolNombre) });
}));

/**
 * GET /api/auth/me - Devuelve los datos del usuario autenticado.
 * Requiere autenticacion (requireAuth) y valida que el usuario siga activo.
 *
 * @param {import('express').Request} req - req.user.id identifica al usuario autenticado.
 * @param {import('express').Response} res - Responde 200 con { user } o 401 si la sesion es invalida o el usuario esta inactivo.
 * @returns {Promise<void>}
 */
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await Usuario.findByPk(req.user.id, {
    include: [{ model: Role, attributes: ['id', 'nombre'] }]
  });

  if (!user || !user.activo) {
    res.status(401).json({ message: 'Sesion invalida.' });
    return;
  }

  res.json({ user: publicUser(user, user.Role?.nombre || null) });
}));
