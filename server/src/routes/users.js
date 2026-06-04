/** @file Rutas de usuarios: administracion de cuentas (alta, edicion, baja logica) restringida al rol admin. */
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { Role, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Devuelve la representacion publica de un usuario, omitiendo datos sensibles como la contrasena.
 * Resuelve el nombre del rol desde la relacion Role incluida.
 *
 * @param {import('sequelize').Model} usuario - Instancia Sequelize de Usuario con la relacion Role.
 * @returns {{ id: number, username: string, rol_id: number, rol: (string|null), activo: boolean }} Usuario publico.
 */
function publicUser(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    rol_id: usuario.rol_id,
    rol: usuario.Role?.nombre || null,
    activo: !!usuario.activo
  };
}

/**
 * GET /api/users - Lista todos los usuarios ordenados por nombre de usuario, con su rol.
 * Solo accesible para el rol admin.
 *
 * @param {import('express').Request} _req - Peticion HTTP (no usa parametros).
 * @param {import('express').Response} res - Responde con un arreglo de usuarios publicos.
 * @returns {Promise<void>}
 */
usersRouter.get('/', adminOnly, asyncHandler(async (_req, res) => {
  const users = await Usuario.findAll({
    include: [{ model: Role, attributes: ['id', 'nombre'] }],
    order: [['username', 'ASC']]
  });
  res.json(users.map(publicUser));
}));

/**
 * POST /api/users - Crea un usuario con la contrasena cifrada mediante bcrypt.
 * Solo accesible para el rol admin. Valida que el usuario, la contrasena (minimo 3 caracteres)
 * y el rol esten presentes, y que el nombre de usuario no exista ya.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.body: { username, password, rol_id, activo }.
 *   activo es opcional (por defecto true salvo que sea exactamente false).
 * @param {import('express').Response} res - Responde 201 con el usuario publico;
 *   400 si falta usuario, la contrasena es corta, falta rol o el usuario ya existe.
 * @returns {Promise<void>}
 */
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

/**
 * PUT /api/users/:id - Actualiza parcialmente un usuario (nombre, contrasena, rol o estado activo).
 * Solo accesible para el rol admin. Solo se modifican los campos enviados. Si se envia contrasena no vacia,
 * se cifra con bcrypt (minimo 3 caracteres). Valida que el nuevo nombre de usuario no este vacio ni tomado por otro.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id y req.body:
 *   { username, password, rol_id, activo } (todos opcionales).
 * @param {import('express').Response} res - Responde con el usuario publico actualizado;
 *   404 si el usuario no existe; 400 si el nombre queda vacio, esta tomado o la contrasena es corta.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/users/:id - Realiza una baja logica del usuario marcandolo como inactivo (activo = false).
 * Solo accesible para el rol admin. No permite que el usuario autenticado se elimine a si mismo.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id objetivo) y req.user.id (usuario autenticado).
 * @param {import('express').Response} res - Responde con { id, activo: false };
 *   400 si se intenta eliminar el propio usuario; 404 si el usuario no existe.
 * @returns {Promise<void>}
 */
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
