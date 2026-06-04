/** @file Rutas de tipos de pago: catalogo de formas de pago, incluyendo las marcadas como credito. */
import { Router } from 'express';
import { Abono, TipoPago, Venta } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const paymentTypesRouter = Router();

paymentTypesRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Convierte una instancia de TipoPago a un objeto plano para la respuesta JSON.
 *
 * @param {import('sequelize').Model} type - Instancia Sequelize de TipoPago.
 * @returns {{ id: number, nombre: string, es_credito: boolean }} Tipo de pago normalizado.
 */
function formatType(type) {
  const data = type.get({ plain: true });
  return {
    id: data.id,
    nombre: data.nombre,
    es_credito: !!data.es_credito
  };
}

/**
 * GET /api/payment-types - Lista todos los tipos de pago ordenados por nombre.
 *
 * @param {import('express').Request} _req - Peticion HTTP (no usa parametros).
 * @param {import('express').Response} res - Responde con un arreglo de tipos de pago normalizados.
 * @returns {Promise<void>}
 */
paymentTypesRouter.get('/', asyncHandler(async (_req, res) => {
  const types = await TipoPago.findAll({ order: [['nombre', 'ASC']] });
  res.json(types.map(formatType));
}));

/**
 * POST /api/payment-types - Crea un tipo de pago. Solo accesible para el rol admin.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.body: { nombre, es_credito }. nombre es obligatorio.
 * @param {import('express').Response} res - Responde 201 con el tipo de pago creado, o 400 si falta el nombre.
 * @returns {Promise<void>}
 */
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

/**
 * PUT /api/payment-types/:id - Actualiza un tipo de pago. Solo accesible para el rol admin.
 * Solo se modifican los campos enviados; los ausentes conservan su valor actual.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id y req.body: { nombre, es_credito } (opcionales).
 * @param {import('express').Response} res - Responde con el tipo de pago actualizado, o 404 si no existe.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/payment-types/:id - Elimina un tipo de pago. Solo accesible para el rol admin.
 * No permite eliminar tipos en uso: si existen ventas o abonos que lo referencian, se rechaza.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del tipo de pago).
 * @param {import('express').Response} res - Responde 204 sin contenido si se elimino;
 *   400 si hay ventas o abonos que lo usan; 404 si no existe.
 * @returns {Promise<void>}
 */
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
