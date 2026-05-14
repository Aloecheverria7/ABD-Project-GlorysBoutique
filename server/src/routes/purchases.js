import { Router } from 'express';
import { sequelize } from '../db.js';
import { Compra, Configuracion, DetalleCompra, Inventario, Producto, ProductoVariante, Proveedor, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const purchasesRouter = Router();

purchasesRouter.use(requireAuth);
const adminOnly = requireRole('admin');

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
