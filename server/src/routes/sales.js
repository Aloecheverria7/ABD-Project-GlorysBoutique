import { Router } from 'express';
import { sequelize } from '../db.js';
import { Cliente, DetalleVenta, Inventario, Producto, ProductoVariante, TipoPago, Usuario, Venta } from '../models/index.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const salesRouter = Router();

function formatSale(sale) {
  const data = sale.get({ plain: true });
  return {
    id: data.id,
    cliente_id: data.cliente_id,
    usuario_id: data.usuario_id,
    tipo_pago_id: data.tipo_pago_id,
    cliente: data.clienteInfo?.nombre || null,
    usuario: data.usuarioInfo?.username || null,
    tipo_pago: data.tipoPagoInfo?.nombre || null,
    total: data.total,
    fecha: data.fecha
  };
}

function formatDetail(detail) {
  const data = detail.get({ plain: true });
  return {
    id: data.id,
    venta_id: data.venta_id,
    producto_variante_id: data.producto_variante_id,
    cantidad: data.cantidad,
    precio_unitario: data.precio_unitario,
    producto: data.varianteInfo?.productoInfo?.nombre || null,
    color: data.varianteInfo?.color || null,
    talla: data.varianteInfo?.talla || null
  };
}

salesRouter.get('/', asyncHandler(async (_req, res) => {
  const sales = await Venta.findAll({
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  res.json(sales.map(formatSale));
}));

salesRouter.get('/:id', asyncHandler(async (req, res) => {
  const sale = await Venta.findByPk(req.params.id, {
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] }
    ]
  });

  if (!sale) {
    res.status(404).json({ message: 'Venta no encontrada.' });
    return;
  }

  const details = await DetalleVenta.findAll({
    where: { venta_id: req.params.id },
    include: [{
      model: ProductoVariante,
      as: 'varianteInfo',
      attributes: ['color', 'talla'],
      include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
    }]
  });

  res.json({ ...formatSale(sale), details: details.map(formatDetail) });
}));

salesRouter.post('/', asyncHandler(async (req, res) => {
  const { cliente_id, usuario_id, tipo_pago_id, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'La venta necesita al menos un producto.' });
    return;
  }

  const total = items.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.precio_unitario), 0);

  const sale = await sequelize.transaction(async (transaction) => {
    for (const item of items) {
      const inventory = await Inventario.findOne({
        where: { producto_variante_id: item.producto_variante_id },
        transaction,
        lock: true
      });

      if (!inventory || Number(inventory.cantidad) < Number(item.cantidad)) {
        const error = new Error('Stock insuficiente');
        error.status = 400;
        throw error;
      }

      await inventory.update({
        cantidad: Number(inventory.cantidad) - Number(item.cantidad)
      }, { transaction });
    }

    const createdSale = await Venta.create({
      cliente_id,
      usuario_id,
      tipo_pago_id,
      total
    }, { transaction });

    await DetalleVenta.bulkCreate(items.map((item) => ({
      venta_id: createdSale.id,
      producto_variante_id: item.producto_variante_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    })), { transaction, individualHooks: true });

    return createdSale;
  });

  sendCreated(res, { id: sale.id, total });
}));
