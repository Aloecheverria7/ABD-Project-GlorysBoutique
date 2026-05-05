import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { Role, Usuario } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { signToken } from '../auth/tokens.js';
import { asyncHandler } from '../utils/http.js';

export const authRouter = Router();

function publicUser(usuario, rolNombre) {
  return {
    id: usuario.id,
    username: usuario.username,
    rol_id: usuario.rol_id,
    rol: rolNombre,
    activo: usuario.activo
  };
}

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

  if (!user || !user.activo) {
    res.status(401).json({ message: 'Credenciales invalidas.' });
    return;
  }

  const stored = user.password || '';
  const matches = stored.startsWith('$2')
    ? await bcrypt.compare(password, stored)
    : stored === password;

  if (!matches) {
    res.status(401).json({ message: 'Credenciales invalidas.' });
    return;
  }

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
