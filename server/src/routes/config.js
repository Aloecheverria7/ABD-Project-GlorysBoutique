/** @file Rutas de configuracion: tasa de cambio, caja base y catalogo de denominaciones (billetes/monedas). */
import { Router } from 'express';
import { Configuracion, Denominacion } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const configRouter = Router();

configRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Da formato a la configuracion convirtiendo los montos a numeros.
 *
 * @param {object} config - Registro de configuracion con tasa_cambio_usd, caja_base y updated_at.
 * @returns {{ tasa_cambio_usd: number, caja_base: number, updated_at: Date }} Configuracion normalizada.
 */
function formatConfig(config) {
  return {
    tasa_cambio_usd: Number(config.tasa_cambio_usd),
    caja_base: Number(config.caja_base || 0),
    updated_at: config.updated_at
  };
}

/**
 * GET /api/config - Devuelve la configuracion global del sistema.
 * Crea el registro id 1 con valores por defecto si aun no existe.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con { tasa_cambio_usd, caja_base, updated_at }.
 * @returns {Promise<void>}
 */
configRouter.get('/', asyncHandler(async (_req, res) => {
  const [config] = await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: 36.62 }
  });
  res.json(formatConfig(config));
}));

/**
 * PUT /api/config - Actualiza la tasa de cambio y, opcionalmente, la caja base. Requiere rol admin.
 * Valida que la tasa sea un numero positivo y que la caja base, si se envia, sea un numero no negativo.
 *
 * @param {import('express').Request} req - req.body con { tasa_cambio_usd, caja_base? }.
 * @param {import('express').Response} res - Responde 200 con la configuracion actualizada o 400 si la tasa o la caja base son invalidas.
 * @returns {Promise<void>}
 */
configRouter.put('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const tasa = Number(req.body?.tasa_cambio_usd);
  if (!Number.isFinite(tasa) || tasa <= 0) {
    res.status(400).json({ message: 'Tasa de cambio invalida.' });
    return;
  }

  const updates = { tasa_cambio_usd: tasa, updated_at: new Date() };

  if (req.body?.caja_base !== undefined) {
    const cajaBase = Number(req.body.caja_base);
    if (!Number.isFinite(cajaBase) || cajaBase < 0) {
      res.status(400).json({ message: 'El monto de caja base no es valido.' });
      return;
    }
    updates.caja_base = cajaBase;
  }

  const [config] = await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: tasa }
  });
  await config.update(updates);

  res.json(formatConfig(config));
}));

/**
 * Da formato a una denominacion convirtiendo el valor a numero.
 *
 * @param {object} denominacion - Registro de denominacion.
 * @returns {{ id: number, valor: number, tipo: string, moneda: string, activo: boolean }} Denominacion normalizada.
 */
function formatDenominacion(denominacion) {
  const data = denominacion.get({ plain: true });
  return {
    id: data.id,
    valor: Number(data.valor),
    tipo: data.tipo,
    moneda: data.moneda || 'NIO',
    activo: !!data.activo
  };
}

/**
 * GET /api/config/denominaciones - Lista el catalogo de denominaciones ordenado por valor descendente.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de denominaciones.
 * @returns {Promise<void>}
 */
configRouter.get('/denominaciones', asyncHandler(async (_req, res) => {
  const rows = await Denominacion.findAll({ order: [['valor', 'DESC']] });
  res.json(rows.map(formatDenominacion));
}));

/**
 * POST /api/config/denominaciones - Crea una denominacion. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.body con { valor, tipo, moneda }.
 * @param {import('express').Response} res - Responde 201 con la denominacion creada o 400 si el valor es invalido.
 * @returns {Promise<void>}
 */
configRouter.post('/denominaciones', adminOnly, asyncHandler(async (req, res) => {
  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    res.status(400).json({ message: 'El valor de la denominacion debe ser mayor que cero.' });
    return;
  }
  const created = await Denominacion.create({
    valor,
    tipo: req.body?.tipo === 'moneda' ? 'moneda' : 'billete',
    moneda: req.body?.moneda === 'USD' ? 'USD' : 'NIO',
    activo: req.body?.activo === undefined ? true : !!req.body.activo
  });
  sendCreated(res, formatDenominacion(created));
}));

/**
 * PUT /api/config/denominaciones/:id - Actualiza una denominacion. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.params.id identifica la denominacion; req.body con { valor, tipo, moneda, activo }.
 * @param {import('express').Response} res - Responde 200 con la denominacion actualizada, 400 si el valor es invalido o 404 si no existe.
 * @returns {Promise<void>}
 */
configRouter.put('/denominaciones/:id', adminOnly, asyncHandler(async (req, res) => {
  const denominacion = await Denominacion.findByPk(req.params.id);
  if (!denominacion) {
    res.status(404).json({ message: 'Denominacion no encontrada.' });
    return;
  }
  const updates = {};
  if (req.body?.valor !== undefined) {
    const valor = Number(req.body.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      res.status(400).json({ message: 'El valor de la denominacion debe ser mayor que cero.' });
      return;
    }
    updates.valor = valor;
  }
  if (req.body?.tipo !== undefined) updates.tipo = req.body.tipo === 'moneda' ? 'moneda' : 'billete';
  if (req.body?.moneda !== undefined) updates.moneda = req.body.moneda === 'USD' ? 'USD' : 'NIO';
  if (req.body?.activo !== undefined) updates.activo = !!req.body.activo;
  await denominacion.update(updates);
  res.json(formatDenominacion(denominacion));
}));

/**
 * DELETE /api/config/denominaciones/:id - Elimina una denominacion. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.params.id identifica la denominacion a eliminar.
 * @param {import('express').Response} res - Responde 204 sin contenido o 404 si no existe.
 * @returns {Promise<void>}
 */
configRouter.delete('/denominaciones/:id', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await Denominacion.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Denominacion no encontrada.' });
    return;
  }
  res.status(204).end();
}));
