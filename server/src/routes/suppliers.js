import { Router } from 'express';
import { sequelize } from '../db.js';
import { Producto, ProductoProveedor, Proveedor } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth);
const adminOnly = requireRole('admin');

function formatSupplier(supplier) {
  const data = supplier.get({ plain: true });
  const productos = (data.productos || []).map((prod) => ({
    id: prod.id,
    nombre: prod.nombre,
    costo: prod.ProductoProveedor?.costo != null ? Number(prod.ProductoProveedor.costo) : null,
    moneda_costo: prod.ProductoProveedor?.moneda_costo || 'NIO'
  }));
  return {
    id: data.id,
    nombre: data.nombre,
    telefono: data.telefono,
    direccion: data.direccion,
    productos,
    total_productos: productos.length
  };
}

const SUPPLIER_INCLUDE = [{
  model: Producto,
  as: 'productos',
  attributes: ['id', 'nombre'],
  through: { attributes: ['costo', 'moneda_costo'] }
}];

suppliersRouter.get('/', asyncHandler(async (_req, res) => {
  const suppliers = await Proveedor.findAll({
    include: SUPPLIER_INCLUDE,
    order: [['nombre', 'ASC']]
  });
  res.json(suppliers.map(formatSupplier));
}));

suppliersRouter.get('/:id', asyncHandler(async (req, res) => {
  const supplier = await Proveedor.findByPk(req.params.id, { include: SUPPLIER_INCLUDE });
  if (!supplier) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }
  res.json(formatSupplier(supplier));
}));

suppliersRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, telefono, direccion, productos } = req.body;
  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' });
    return;
  }

  const supplier = await sequelize.transaction(async (transaction) => {
    const created = await Proveedor.create({
      nombre: String(nombre).trim(),
      telefono: telefono || null,
      direccion: direccion || null
    }, { transaction });

    if (Array.isArray(productos) && productos.length > 0) {
      await ProductoProveedor.bulkCreate(productos.map((p) => ({
        proveedor_id: created.id,
        producto_id: Number(p.producto_id || p.id),
        costo: p.costo === '' || p.costo == null ? null : Number(p.costo),
        moneda_costo: p.moneda_costo === 'USD' ? 'USD' : 'NIO'
      })), { transaction });
    }

    return created;
  });

  const refreshed = await Proveedor.findByPk(supplier.id, { include: SUPPLIER_INCLUDE });
  sendCreated(res, formatSupplier(refreshed));
}));

suppliersRouter.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, telefono, direccion, productos } = req.body;
  const supplier = await Proveedor.findByPk(req.params.id);
  if (!supplier) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }

  await sequelize.transaction(async (transaction) => {
    await supplier.update({
      nombre: nombre != null ? String(nombre).trim() : supplier.nombre,
      telefono: telefono || null,
      direccion: direccion || null
    }, { transaction });

    if (Array.isArray(productos)) {
      await ProductoProveedor.destroy({ where: { proveedor_id: supplier.id }, transaction });
      if (productos.length > 0) {
        await ProductoProveedor.bulkCreate(productos.map((p) => ({
          proveedor_id: supplier.id,
          producto_id: Number(p.producto_id || p.id),
          costo: p.costo === '' || p.costo == null ? null : Number(p.costo),
          moneda_costo: p.moneda_costo === 'USD' ? 'USD' : 'NIO'
        })), { transaction });
      }
    }
  });

  const refreshed = await Proveedor.findByPk(supplier.id, { include: SUPPLIER_INCLUDE });
  res.json(formatSupplier(refreshed));
}));

suppliersRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await Proveedor.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }
  res.status(204).end();
}));

suppliersRouter.post('/:id/products', adminOnly, asyncHandler(async (req, res) => {
  const supplier = await Proveedor.findByPk(req.params.id);
  if (!supplier) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }

  const { producto_id, costo, moneda_costo } = req.body;
  if (!producto_id) {
    res.status(400).json({ message: 'Producto requerido.' });
    return;
  }

  const [link] = await ProductoProveedor.findOrCreate({
    where: { proveedor_id: supplier.id, producto_id: Number(producto_id) },
    defaults: {
      costo: costo === '' || costo == null ? null : Number(costo),
      moneda_costo: moneda_costo === 'USD' ? 'USD' : 'NIO'
    }
  });

  if (costo !== undefined || moneda_costo !== undefined) {
    await link.update({
      costo: costo === '' || costo == null ? null : Number(costo),
      moneda_costo: moneda_costo === 'USD' ? 'USD' : 'NIO'
    });
  }

  sendCreated(res, {
    id: link.id,
    producto_id: link.producto_id,
    proveedor_id: link.proveedor_id,
    costo: link.costo != null ? Number(link.costo) : null,
    moneda_costo: link.moneda_costo
  });
}));

suppliersRouter.delete('/:id/products/:productId', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await ProductoProveedor.destroy({
    where: { proveedor_id: req.params.id, producto_id: req.params.productId }
  });
  if (!deleted) {
    res.status(404).json({ message: 'Vinculo no encontrado.' });
    return;
  }
  res.status(204).end();
}));
