/** @file Rutas de compras a proveedores: registro de compras con sus detalles y aumento de inventario. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Compra, Configuracion, DetalleCompra, Inventario, Producto, ProductoVariante, Proveedor, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const purchasesRouter = Router();

purchasesRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Convierte una instancia de Compra a un objeto plano para la respuesta JSON,
 * resolviendo los nombres de proveedor y usuario a partir de las relaciones incluidas.
 *
 * @param {import('sequelize').Model} purchase - Instancia Sequelize de Compra con 'proveedorInfo' y 'usuarioInfo'.
 * @returns {{ id: number, proveedor_id: number, proveedor: (string|null), usuario_id: number, usuario: (string|null), total: number, moneda: string, tasa_cambio: (number|null), notas: (string|null), fecha: Date }} Compra normalizada.
 */
function formatPurchase(purchase) {
  const data = purchase.get({ plain: true });
  return {
    id: data.id,
    proveedor_id: data.proveedor_id,
    proveedor: data.proveedorInfo?.nombre || null,
    usuario_id: data.usuario_id,
    usuario: data.usuarioInfo?.username || null,
    total: data.total != null ? Number(data.total) : 0,
    moneda: data.moneda || 'NIO',
    tasa_cambio: data.tasa_cambio != null ? Number(data.tasa_cambio) : null,
    notas: data.notas,
    fecha: data.fecha
  };
}

/**
 * Convierte una instancia de DetalleCompra a un objeto plano para la respuesta JSON,
 * incluyendo el nombre del producto, color y talla de la variante asociada.
 *
 * @param {import('sequelize').Model} detail - Instancia Sequelize de DetalleCompra con 'varianteInfo' y su 'productoInfo'.
 * @returns {{ id: number, compra_id: number, producto_variante_id: number, cantidad: number, costo_unitario: number, producto: (string|null), color: (string|null), talla: (string|null) }} Detalle normalizado.
 */
function formatDetail(detail) {
  const data = detail.get({ plain: true });
  return {
    id: data.id,
    compra_id: data.compra_id,
    producto_variante_id: data.producto_variante_id,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario != null ? Number(data.costo_unitario) : 0,
    producto: data.varianteInfo?.productoInfo?.nombre || null,
    color: data.varianteInfo?.color || null,
    talla: data.varianteInfo?.talla || null
  };
}

/**
 * GET /api/purchases - Lista todas las compras ordenadas por fecha descendente.
 * Solo accesible para el rol admin.
 *
 * @param {import('express').Request} _req - Peticion HTTP (no usa parametros).
 * @param {import('express').Response} res - Responde con un arreglo de compras normalizadas.
 * @returns {Promise<void>}
 */
purchasesRouter.get('/', adminOnly, asyncHandler(async (_req, res) => {
  const purchases = await Compra.findAll({
    include: [
      { model: Proveedor, as: 'proveedorInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  res.json(purchases.map(formatPurchase));
}));

/**
 * GET /api/purchases/:id - Devuelve una compra con el detalle de sus renglones.
 * Solo accesible para el rol admin.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id de la compra).
 * @param {import('express').Response} res - Responde con la compra normalizada mas su arreglo 'details',
 *   o 404 si la compra no existe.
 * @returns {Promise<void>}
 */
purchasesRouter.get('/:id', adminOnly, asyncHandler(async (req, res) => {
  const purchase = await Compra.findByPk(req.params.id, {
    include: [
      { model: Proveedor, as: 'proveedorInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ]
  });
  if (!purchase) {
    res.status(404).json({ message: 'Compra no encontrada.' });
    return;
  }

  const details = await DetalleCompra.findAll({
    where: { compra_id: req.params.id },
    include: [{
      model: ProductoVariante,
      as: 'varianteInfo',
      attributes: ['color', 'talla'],
      include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
    }]
  });

  res.json({ ...formatPurchase(purchase), details: details.map(formatDetail) });
}));

/**
 * POST /api/purchases - Registra una compra a un proveedor con sus renglones y aumenta el inventario.
 * Solo accesible para el rol admin. El total se calcula sumando cantidad por costo unitario de cada item.
 * Si la moneda es USD, toma la tasa de cambio de la Configuracion (id 1). La compra, sus detalles y la
 * actualizacion de inventario se ejecutan dentro de una transaccion.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.user.id (usuario autenticado) y req.body:
 *   { proveedor_id, items, moneda, notas }. items es un arreglo de
 *   { producto_variante_id, cantidad, costo_unitario }.
 * @param {import('express').Response} res - Responde 201 con { id, proveedor_id, total, moneda, tasa_cambio, fecha };
 *   400 si falta proveedor, no hay items, algun renglon es invalido, el proveedor no existe o la tasa USD no esta configurada.
 * @returns {Promise<void>}
 */
purchasesRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { proveedor_id, items, moneda, notas } = req.body;
  const usuario_id = req.user.id;

  if (!proveedor_id) {
    res.status(400).json({ message: 'Selecciona un proveedor.' });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'La compra necesita al menos un producto.' });
    return;
  }
  for (const item of items) {
    if (!item.producto_variante_id || Number(item.cantidad) <= 0 || Number(item.costo_unitario) < 0) {
      res.status(400).json({ message: 'Cada renglon necesita variante, cantidad positiva y costo no negativo.' });
      return;
    }
  }

  const provider = await Proveedor.findByPk(proveedor_id);
  if (!provider) {
    res.status(400).json({ message: 'Proveedor no encontrado.' });
    return;
  }

  const purchaseCurrency = moneda === 'USD' ? 'USD' : 'NIO';
  let tasaCambio = null;
  if (purchaseCurrency === 'USD') {
    const config = await Configuracion.findByPk(1);
    if (!config) {
      res.status(400).json({ message: 'Tasa de cambio no configurada.' });
      return;
    }
    tasaCambio = Number(config.tasa_cambio_usd);
  }

  const total = items.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.costo_unitario), 0);

  const purchase = await sequelize.transaction(async (transaction) => {
    const createdPurchase = await Compra.create({
      proveedor_id: Number(proveedor_id),
      usuario_id,
      total,
      moneda: purchaseCurrency,
      tasa_cambio: tasaCambio,
      notas: notas ? String(notas).slice(0, 255) : null
    }, { transaction });

    await DetalleCompra.bulkCreate(items.map((item) => ({
      compra_id: createdPurchase.id,
      producto_variante_id: Number(item.producto_variante_id),
      cantidad: Number(item.cantidad),
      costo_unitario: Number(item.costo_unitario)
    })), { transaction });

    // Regla de negocio: una compra es el espejo de una venta sobre el inventario: en lugar de
    // descontar, aumenta las existencias de cada variante. Si la variante aun no tiene fila de
    // inventario se crea en cero (findOrCreate) y luego se suma la cantidad comprada. El bloqueo
    // (lock) evita condiciones de carrera con ventas/compras concurrentes sobre la misma variante.
    for (const item of items) {
      const [inventory] = await Inventario.findOrCreate({
        where: { producto_variante_id: Number(item.producto_variante_id) },
        defaults: { cantidad: 0 },
        transaction,
        lock: true
      });
      await inventory.update({
        cantidad: Number(inventory.cantidad) + Number(item.cantidad)
      }, { transaction });
    }

    return createdPurchase;
  });

  sendCreated(res, {
    id: purchase.id,
    proveedor_id: purchase.proveedor_id,
    total,
    moneda: purchaseCurrency,
    tasa_cambio: tasaCambio,
    fecha: purchase.fecha
  });
}));
