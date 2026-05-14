import { Router } from 'express';
import { Abono, TipoPago, Venta } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const paymentTypesRouter = Router();

paymentTypesRouter.use(requireAuth);
const adminOnly = requireRole('admin');

function formatType(type) {
  const data = type.get({ plain: true });
  return {
    id: data.id,
    nombre: data.nombre,
    es_credito: !!data.es_credito
  };
}

paymentTypesRouter.get('/', asyncHandler(async (_req, res) => {
  const types = await TipoPago.findAll({ order: [['nombre', 'ASC']] });
  res.json(types.map(formatType));
}));

paymentTypesRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, es_credito } = req.body;
  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ message: 'El nombre es obligatorio.' });
    return;
  }
  const created = await TipoPago.create({
    nombre: String(nombre).trim(),
    es_credito: !!es_credito
  });
  sendCreated(res, formatType(created));
}));

paymentTypesRouter.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const type = await TipoPago.findByPk(req.params.id);
  if (!type) {
    res.status(404).json({ message: 'Tipo de pago no encontrado.' });
    return;
  }
  const { nombre, es_credito } = req.body;
  await type.update({
    nombre: nombre != null ? String(nombre).trim() : type.nombre,
    es_credito: es_credito !== undefined ? !!es_credito : type.es_credito
  });
  res.json(formatType(type));
}));

paymentTypesRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [salesCount, abonosCount] = await Promise.all([
    Venta.count({ where: { tipo_pago_id: id } }),
    Abono.count({ where: { tipo_pago_id: id } })
  ]);
  if (salesCount > 0 || abonosCount > 0) {
    res.status(400).json({
      message: `No se puede eliminar: hay ${salesCount} venta(s) y ${abonosCount} abono(s) que lo usan.`
    });
    return;
  }
  const deleted = await TipoPago.destroy({ where: { id } });
  if (!deleted) {
    res.status(404).json({ message: 'Tipo de pago no encontrado.' });
    return;
  }
  res.status(204).end();
}));
