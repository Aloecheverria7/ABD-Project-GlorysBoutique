import { Router } from 'express';
import { sequelize } from '../db.js';
import { Categoria, Inventario, Producto, ProductoVariante, Proveedor, Subcategoria } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);
const adminOnly = requireRole('admin');

function formatProduct(product) {
  const data = product.get({ plain: true });
  return {
    ...data,
    precio_base: data.precio_base != null ? Number(data.precio_base) : null,
    precio_usd: data.precio_usd != null ? Number(data.precio_usd) : null,
    categoria: data.categoriaInfo?.nombre || null,
    subcategoria: data.subcategoriaInfo?.nombre || null,
    proveedor: data.proveedorInfo?.nombre || null,
    categoriaInfo: undefined,
    subcategoriaInfo: undefined,
    proveedorInfo: undefined
  };
}

function formatVariant(variant) {
  const data = variant.get({ plain: true });
  return {
    id: data.id,
    producto_id: data.producto_id,
    producto: data.productoInfo?.nombre || null,
    precio_base: data.productoInfo?.precio_base != null ? Number(data.productoInfo.precio_base) : null,
    precio_usd: data.productoInfo?.precio_usd != null ? Number(data.productoInfo.precio_usd) : null,
    color: data.color,
    talla: data.talla,
    cantidad: data.inventario?.cantidad || 0
  };
}

function parseOptionalPrice(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

productsRouter.get('/', asyncHandler(async (_req, res) => {
  const products = await Producto.findAll({
    include: [
      { model: Categoria, as: 'categoriaInfo', attributes: ['nombre'] },
      { model: Subcategoria, as: 'subcategoriaInfo', attributes: ['nombre'] },
      { model: Proveedor, as: 'proveedorInfo', attributes: ['nombre'] }
    ],
    order: [['id', 'DESC']]
  });
  res.json(products.map(formatProduct));
}));

productsRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedor_id } = req.body;

  const nio = parseOptionalPrice(precio_base);
  const usd = parseOptionalPrice(precio_usd);
  if (nio === undefined || usd === undefined) {
    res.status(400).json({ message: 'Los precios deben ser numeros positivos.' });
    return;
  }
  if (nio === null && usd === null) {
    res.status(400).json({ message: 'Debes capturar al menos un precio (NIO o USD).' });
    return;
  }

  const product = await Producto.create({
    nombre,
    descripcion: descripcion || null,
    precio_base: nio,
    precio_usd: usd,
    categoria_id: categoria_id || null,
    subcategoria_id: subcategoria_id || null,
    proveedor_id: proveedor_id || null
  });
  sendCreated(res, formatProduct(product));
}));

productsRouter.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedor_id } = req.body;
  const product = await Producto.findByPk(req.params.id);

  if (!product) {
    res.status(404).json({ message: 'Producto no encontrado.' });
    return;
  }

  const nio = parseOptionalPrice(precio_base);
  const usd = parseOptionalPrice(precio_usd);
  if (nio === undefined || usd === undefined) {
    res.status(400).json({ message: 'Los precios deben ser numeros positivos.' });
    return;
  }
  if (nio === null && usd === null) {
    res.status(400).json({ message: 'Debes capturar al menos un precio (NIO o USD).' });
    return;
  }

  await product.update({
    nombre,
    descripcion: descripcion || null,
    precio_base: nio,
    precio_usd: usd,
    categoria_id: categoria_id || null,
    subcategoria_id: subcategoria_id || null,
    proveedor_id: proveedor_id || null
  });
  res.json(formatProduct(product));
}));

productsRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await Producto.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Producto no encontrado.' });
    return;
  }
  res.status(204).end();
}));

productsRouter.get('/variants', asyncHandler(async (_req, res) => {
  const variants = await ProductoVariante.findAll({
    include: [
      { model: Producto, as: 'productoInfo', attributes: ['nombre', 'precio_base', 'precio_usd'] },
      { model: Inventario, as: 'inventario', attributes: ['cantidad'] }
    ],
    order: [
      [{ model: Producto, as: 'productoInfo' }, 'nombre', 'ASC'],
      ['color', 'ASC'],
      ['talla', 'ASC']
    ]
  });
  res.json(variants.map(formatVariant));
}));

productsRouter.post('/:id/variants', adminOnly, asyncHandler(async (req, res) => {
  const { color, talla, cantidad } = req.body;

  const variant = await sequelize.transaction(async (transaction) => {
    const createdVariant = await ProductoVariante.create({
      producto_id: req.params.id,
      color: color || null,
      talla: talla || null
    }, { transaction });

    await Inventario.create({
      producto_variante_id: createdVariant.id,
      cantidad: cantidad || 0
    }, { transaction });

    return createdVariant;
  });

  sendCreated(res, {
    id: variant.id,
    producto_id: Number(req.params.id),
    color,
    talla,
    cantidad
  });
}));
