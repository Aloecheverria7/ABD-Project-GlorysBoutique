/** @file Rutas de caja: consulta de saldo y registro/borrado de movimientos de entrada y salida de efectivo. */
import { Router } from 'express';
import { CajaMovimiento, Configuracion, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const cajaRouter = Router();

cajaRouter.use(requireAuth);

/**
 * Convierte una instancia de CajaMovimiento a un objeto plano para la respuesta JSON,
 * resolviendo el nombre del usuario desde la relacion incluida.
 *
 * @param {import('sequelize').Model} movimiento - Instancia Sequelize de CajaMovimiento con 'usuarioInfo'.
 * @returns {{ id: number, tipo: string, monto: number, motivo: (string|null), usuario_id: number, usuario: (string|null), fecha: Date }} Movimiento normalizado.
 */
function formatMovimiento(movimiento) {
  const data = movimiento.get({ plain: true });
  return {
    id: data.id,
    tipo: data.tipo,
    monto: Number(data.monto),
    motivo: data.motivo,
    usuario_id: data.usuario_id,
    usuario: data.usuarioInfo?.username || null,
    fecha: data.fecha
  };
}

/**
 * Obtiene el monto base de la caja desde la Configuracion (id 1), creandola si no existe.
 *
 * @returns {Promise<number>} El monto base de la caja (0 si no esta definido).
 */
async function getBase() {
  const [config] = await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 }
  });
  return Number(config.caja_base || 0);
}

/**
 * GET /api/caja - Devuelve el monto base, el saldo actual y el historial de movimientos.
 * El saldo se calcula como base mas las entradas menos las salidas.
 *
 * @param {import('express').Request} _req - Peticion HTTP (no usa parametros).
 * @param {import('express').Response} res - Responde con { base, saldo, movimientos }.
 * @returns {Promise<void>}
 */
cajaRouter.get('/', asyncHandler(async (_req, res) => {
  const [base, movimientos] = await Promise.all([
    getBase(),
    CajaMovimiento.findAll({
      include: [{ model: Usuario, as: 'usuarioInfo', attributes: ['username'] }],
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    })
  ]);

  const saldo = movimientos.reduce((sum, mov) => {
    const monto = Number(mov.monto);
    return mov.tipo === 'salida' ? sum - monto : sum + monto;
  }, base);

  res.json({
    base,
    saldo: Number(saldo.toFixed(2)),
    movimientos: movimientos.map(formatMovimiento)
  });
}));

/**
 * POST /api/caja/movimientos - Registra un movimiento de caja de entrada o salida.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.user.id (usuario autenticado) y req.body:
 *   { tipo, monto, motivo }. tipo debe ser 'entrada' o 'salida'; monto debe ser un numero mayor que cero.
 * @param {import('express').Response} res - Responde 201 con el movimiento normalizado;
 *   400 si el tipo es invalido o el monto no es un numero mayor que cero.
 * @returns {Promise<void>}
 */
cajaRouter.post('/movimientos', asyncHandler(async (req, res) => {
  const { tipo, monto, motivo } = req.body || {};

  if (tipo !== 'entrada' && tipo !== 'salida') {
    res.status(400).json({ message: 'El tipo debe ser entrada o salida.' });
    return;
  }

  const montoNumber = Number(monto);
  if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
    res.status(400).json({ message: 'El monto debe ser un numero mayor que cero.' });
    return;
  }

  const created = await CajaMovimiento.create({
    tipo,
    monto: montoNumber,
    motivo: motivo ? String(motivo).slice(0, 255) : null,
    usuario_id: req.user.id
  });

  const refreshed = await CajaMovimiento.findByPk(created.id, {
    include: [{ model: Usuario, as: 'usuarioInfo', attributes: ['username'] }]
  });

  sendCreated(res, formatMovimiento(refreshed));
}));

/**
 * DELETE /api/caja/movimientos/:id - Elimina un movimiento de caja. Solo accesible para el rol admin.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del movimiento).
 * @param {import('express').Response} res - Responde 204 sin contenido si se elimino, o 404 si no existe.
 * @returns {Promise<void>}
 */
cajaRouter.delete('/movimientos/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const deleted = await CajaMovimiento.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Movimiento no encontrado.' });
    return;
  }
  res.status(204).end();
}));
