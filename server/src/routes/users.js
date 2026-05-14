import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { Role, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);
const adminOnly = requireRole('admin');

function publicUser(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    rol_id: usuario.rol_id,
    rol: usuario.Role?.nombre || null,
    activo: !!usuario.activo
  };
}

usersRouter.get('/', adminOnly, asyncHandler(async (_req, res) => {
  const users = await Usuario.findAll({
    include: [{ model: Role, attributes: ['id', 'nombre'] }],
    order: [['username', 'ASC']]
  });
  res.json(users.map(publicUser));
}));

usersRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { username, password, rol_id, activo } = req.body;
  if (!username || !String(username).trim()) {
    res.status(400).json({ message: 'El usuario es obligatorio.' });
    return;
  }
  if (!password || String(password).length < 3) {
    res.status(400).json({ message: 'La contrasena debe tener al menos 3 caracteres.' });
    return;
  }
  if (!rol_id) {
    res.status(400).json({ message: 'Selecciona un rol.' });
    return;
  }

  const existing = await Usuario.findOne({ where: { username: String(username).trim() } });
  if (existing) {
    res.status(400).json({ message: 'Ese usuario ya existe.' });
    return;
  }

  const created = await Usuario.create({
    username: String(username).trim(),
    password: await bcrypt.hash(String(password), 10),
    rol_id: Number(rol_id),
    activo: activo === false ? false : true
  });

  const refreshed = await Usuario.findByPk(created.id, { include: [{ model: Role, attributes: ['id', 'nombre'] }] });
  sendCreated(res, publicUser(refreshed));
}));

usersRouter.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const user = await Usuario.findByPk(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado.' });
    return;
  }

  const { username, password, rol_id, activo } = req.body;
  const patch = {};

  if (username !== undefined) {
    const trimmed = String(username).trim();
    if (!trimmed) {
      res.status(400).json({ message: 'El usuario no puede quedar vacio.' });
      return;
    }
    if (trimmed !== user.username) {
      const taken = await Usuario.findOne({ where: { username: trimmed } });
      if (taken && taken.id !== user.id) {
        res.status(400).json({ message: 'Ese usuario ya existe.' });
        return;
      }
    }
    patch.username = trimmed;
  }
  if (password !== undefined && password !== null && password !== '') {
    if (String(password).length < 3) {
      res.status(400).json({ message: 'La contrasena debe tener al menos 3 caracteres.' });
      return;
    }
    patch.password = await bcrypt.hash(String(password), 10);
  }
  if (rol_id !== undefined) patch.rol_id = Number(rol_id);
  if (activo !== undefined) patch.activo = !!activo;

  await user.update(patch);

  const refreshed = await Usuario.findByPk(user.id, { include: [{ model: Role, attributes: ['id', 'nombre'] }] });
  res.json(publicUser(refreshed));
}));

usersRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const target = Number(req.params.id);
  if (target === req.user.id) {
    res.status(400).json({ message: 'No puedes eliminar tu propio usuario.' });
    return;
  }
  const user = await Usuario.findByPk(target);
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado.' });
    return;
  }
  await user.update({ activo: false });
  res.json({ id: user.id, activo: false });
}));
