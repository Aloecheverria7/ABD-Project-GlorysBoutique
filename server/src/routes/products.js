import { Router } from 'express';
import { sequelize } from '../db.js';
import { Categoria, Inventario, Producto, ProductoProveedor, ProductoVariante, Proveedor, Subcategoria } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);
const adminOnly = requireRole('admin');

function formatProduct(product) {
  const data = product.get({ plain: true });
  const proveedores = (data.proveedores || []).map((prov) => ({
    id: prov.id,
    nombre: prov.nombre,
    costo: prov.ProductoProveedor?.costo != null ? Number(prov.ProductoProveedor.costo) : null,
    moneda_costo: prov.ProductoProveedor?.moneda_costo || 'NIO'
  }));
  return {
    id: data.id,
    nombre: data.nombre,
    descripcion: data.descripcion,
    precio_base: data.precio_base != null ? Number(data.precio_base) : null,
    precio_usd: data.precio_usd != null ? Number(data.precio_usd) : null,
    categoria_id: data.categoria_id,
    subcategoria_id: data.subcategoria_id,
    categoria: data.categoriaInfo?.nombre || null,
    subcategoria: data.subcategoriaInfo?.nombre || null,
    proveedores
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

const PRODUCT_INCLUDE = [
  { model: Categoria, as: 'categoriaInfo', attributes: ['nombre'] },
  { model: Subcategoria, as: 'subcategoriaInfo', attributes: ['nombre'] },
  {
    model: Proveedor,
    as: 'proveedores',
    attributes: ['id', 'nombre'],
    through: { attributes: ['costo', 'moneda_costo'] }
  }
];

productsRouter.get('/', asyncHandler(async (_req, res) => {
  const products = await Producto.findAll({
    include: PRODUCT_INCLUDE,
    order: [['id', 'DESC']]
  });
  res.json(products.map(formatProduct));
}));

productsRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedores } = req.body;

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

  const product = await sequelize.transaction(async (transaction) => {
    const created = await Producto.create({
      nombre,
      descripcion: descripcion || null,
      precio_base: nio,
      precio_usd: usd,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null
    }, { transaction });

    if (Array.isArray(proveedores) && proveedores.length > 0) {
      await ProductoProveedor.bulkCreate(proveedores.map((p) => ({
        producto_id: created.id,
        proveedor_id: Number(p.proveedor_id || p.id),
        costo: p.costo === '' || p.costo == null ? null : Number(p.costo),
        moneda_costo: p.moneda_costo === 'USD' ? 'USD' : 'NIO'
      })), { transaction });
    }

    return created;
  });

  const refreshed = await Producto.findByPk(product.id, { include: PRODUCT_INCLUDE });
  sendCreated(res, formatProduct(refreshed));
}));

productsRouter.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedores } = req.body;
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

  await sequelize.transaction(async (transaction) => {
    await product.update({
      nombre,
      descripcion: descripcion || null,
      precio_base: nio,
      precio_usd: usd,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null
    }, { transaction });

    if (Array.isArray(proveedores)) {
      await ProductoProveedor.destroy({ where: { producto_id: product.id }, transaction });
      if (proveedores.length > 0) {
        await ProductoProveedor.bulkCreate(proveedores.map((p) => ({
          producto_id: product.id,
          proveedor_id: Number(p.proveedor_id || p.id),
          costo: p.costo === '' || p.costo == null ? null : Number(p.costo),
          moneda_costo: p.moneda_costo === 'USD' ? 'USD' : 'NIO'
        })), { transaction });
      }
    }
  });

  const refreshed = await Producto.findByPk(product.id, { include: PRODUCT_INCLUDE });
  res.json(formatProduct(refreshed));
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
