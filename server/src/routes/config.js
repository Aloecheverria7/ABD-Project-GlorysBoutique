/** @file Rutas de configuracion: consulta y actualizacion de tasa de cambio y caja base. */
import { Router } from 'express';
import { Configuracion } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler } from '../utils/http.js';

export const configRouter = Router();

configRouter.use(requireAuth);

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
