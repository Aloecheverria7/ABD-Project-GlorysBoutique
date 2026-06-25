/** @file Rutas de caja: saldo, movimientos de efectivo y apertura de caja con desglose por denominacion. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { CajaApertura, CajaAperturaDetalle, CajaMovimiento, Configuracion, Denominacion, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const cajaRouter = Router();

cajaRouter.use(requireAuth);

/**
 * Obtiene la apertura de caja abierta mas reciente con su desglose por denominacion, o null si no hay.
 *
 * @returns {Promise<{ id: number, total: number, fecha: Date, usuario: (string|null), detalles: Array<{ denominacion_id: number, valor: number, tipo: string, moneda: string, cantidad: number }> }|null>} Apertura actual o null.
 */
async function getAperturaActual() {
  const apertura = await CajaApertura.findOne({
    where: { estado: 'abierta' },
    include: [
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] },
      {
        model: CajaAperturaDetalle,
        as: 'detalles',
        include: [{ model: Denominacion, as: 'denominacionInfo', attributes: ['valor', 'tipo', 'moneda'] }]
      }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  if (!apertura) return null;
  const data = apertura.get({ plain: true });
  return {
    id: data.id,
    total: Number(data.total || 0),
    fecha: data.fecha,
    usuario: data.usuarioInfo?.username || null,
    detalles: (data.detalles || []).map((d) => ({
      denominacion_id: d.denominacion_id,
      valor: d.denominacionInfo ? Number(d.denominacionInfo.valor) : null,
      tipo: d.denominacionInfo?.tipo || null,
      moneda: d.denominacionInfo?.moneda || 'NIO',
      cantidad: d.cantidad
    }))
  };
}

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
  const [base, movimientos, apertura] = await Promise.all([
    getBase(),
    CajaMovimiento.findAll({
      include: [{ model: Usuario, as: 'usuarioInfo', attributes: ['username'] }],
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    }),
    getAperturaActual()
  ]);

  const saldo = movimientos.reduce((sum, mov) => {
    const monto = Number(mov.monto);
    return mov.tipo === 'salida' ? sum - monto : sum + monto;
  }, base);

  res.json({
    base,
    saldo: Number(saldo.toFixed(2)),
    movimientos: movimientos.map(formatMovimiento),
    apertura
  });
}));

/**
 * POST /api/caja/apertura - Abre una caja registrando el conteo de billetes y monedas disponibles.
 * Cierra cualquier apertura previa que siguiera abierta, calcula el total a partir de las
 * denominaciones por su valor y guarda el desglose. Todo en una transaccion.
 *
 * @param {import('express').Request} req - req.user.id (usuario) y req.body con { detalles: [{ denominacion_id, cantidad }] }.
 * @param {import('express').Response} res - Responde 201 con la apertura registrada o 400 si no hay un desglose valido.
 * @returns {Promise<void>}
 */
cajaRouter.post('/apertura', asyncHandler(async (req, res) => {
  const detalles = Array.isArray(req.body?.detalles) ? req.body.detalles : [];
  const limpios = detalles
    .map((d) => ({ denominacion_id: Number(d.denominacion_id), cantidad: Math.max(0, Math.trunc(Number(d.cantidad) || 0)) }))
    .filter((d) => d.denominacion_id && d.cantidad > 0);

  if (limpios.length === 0) {
    res.status(400).json({ message: 'Registra al menos una denominacion con cantidad.' });
    return;
  }

  // Las denominaciones deben existir; el total se calcula en el servidor a partir de su valor real.
  const ids = limpios.map((d) => d.denominacion_id);
  const denominaciones = await Denominacion.findAll({ where: { id: ids } });
  const valorPorId = new Map(denominaciones.map((d) => [d.id, Number(d.valor)]));
  if (denominaciones.length !== new Set(ids).size) {
    res.status(400).json({ message: 'Alguna denominacion no existe.' });
    return;
  }

  const total = limpios.reduce((sum, d) => sum + (valorPorId.get(d.denominacion_id) || 0) * d.cantidad, 0);

  await sequelize.transaction(async (transaction) => {
    // Solo puede haber una apertura abierta a la vez: se cierran las anteriores.
    await CajaApertura.update({ estado: 'cerrada' }, { where: { estado: 'abierta' }, transaction });
    const apertura = await CajaApertura.create({
      usuario_id: req.user.id,
      total: Number(total.toFixed(2)),
      estado: 'abierta'
    }, { transaction });
    await CajaAperturaDetalle.bulkCreate(limpios.map((d) => ({
      apertura_id: apertura.id,
      denominacion_id: d.denominacion_id,
      cantidad: d.cantidad
    })), { transaction });
  });

  sendCreated(res, await getAperturaActual());
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
