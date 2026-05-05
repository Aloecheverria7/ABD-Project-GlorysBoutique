import { Router } from 'express';
import { Configuracion } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler } from '../utils/http.js';

export const configRouter = Router();

configRouter.use(requireAuth);

function formatConfig(config) {
  return {
    tasa_cambio_usd: Number(config.tasa_cambio_usd),
    updated_at: config.updated_at
  };
}

configRouter.get('/', asyncHandler(async (_req, res) => {
  const [config] = await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: 36.62 }
  });
  res.json(formatConfig(config));
}));

configRouter.put('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const tasa = Number(req.body?.tasa_cambio_usd);
  if (!Number.isFinite(tasa) || tasa <= 0) {
    res.status(400).json({ message: 'Tasa de cambio invalida.' });
    return;
  }

  const [config] = await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: tasa }
  });
  await config.update({ tasa_cambio_usd: tasa, updated_at: new Date() });

  res.json(formatConfig(config));
}));
