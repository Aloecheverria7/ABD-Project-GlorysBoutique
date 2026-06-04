/** @file Rutas de productos: CRUD de productos, sus proveedores y variantes con inventario. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Categoria, Inventario, Producto, ProductoProveedor, ProductoVariante, Proveedor, Subcategoria } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Da formato a un producto resolviendo precios numericos, nombres de categoria/subcategoria y proveedores con costos.
 *
 * @param {object} product - Instancia Sequelize del producto con asociaciones categoriaInfo, subcategoriaInfo y proveedores.
 * @returns {object} Producto plano con precios numericos, nombres resueltos y arreglo de proveedores.
 */
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

/**
 * Da formato a una variante de producto resolviendo el nombre del producto, sus precios y la cantidad en inventario.
 *
 * @param {object} variant - Instancia Sequelize de la variante con asociaciones productoInfo e inventario.
 * @returns {object} Variante plana con producto, precios, color, talla y cantidad.
 */
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

/**
 * Convierte un precio opcional a numero, distinguiendo entre ausente e invalido.
 *
 * @param {string|number|null|undefined} value - Valor de precio a interpretar.
 * @returns {number|null|undefined} El numero parseado, null si el valor esta vacio o ausente, o undefined si es invalido o negativo.
 */
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

/**
 * GET /api/products - Lista los productos con categoria, subcategoria y proveedores, ordenados por id descendente.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de productos formateados.
 * @returns {Promise<void>}
 */
productsRouter.get('/', asyncHandler(async (_req, res) => {
  const products = await Producto.findAll({
    include: PRODUCT_INCLUDE,
    order: [['id', 'DESC']]
  });
  res.json(products.map(formatProduct));
}));

/**
 * POST /api/products - Crea un producto y, opcionalmente, sus proveedores asociados. Requiere rol admin.
 * Exige al menos un precio (NIO o USD) y los crea dentro de una transaccion junto con la tabla ProductoProveedor.
 *
 * @param {import('express').Request} req - req.body con { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedores }.
 * @param {import('express').Response} res - Responde 201 con el producto creado o 400 si los precios son invalidos o faltan ambos.
 * @returns {Promise<void>}
 */
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

/**
 * PUT /api/products/:id - Actualiza un producto y reemplaza sus proveedores. Requiere rol admin.
 * Si se envia el arreglo de proveedores, elimina los existentes y vuelve a crearlos dentro de una transaccion.
 *
 * @param {import('express').Request} req - req.params.id identifica al producto; req.body con { nombre, descripcion, precio_base, precio_usd, categoria_id, subcategoria_id, proveedores }.
 * @param {import('express').Response} res - Responde 200 con el producto actualizado, 400 si los precios son invalidos o 404 si no existe.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/products/:id - Elimina un producto. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.params.id identifica al producto a eliminar.
 * @param {import('express').Response} res - Responde 204 sin contenido o 404 si el producto no existe.
 * @returns {Promise<void>}
 */
productsRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await Producto.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Producto no encontrado.' });
    return;
  }
  res.status(204).end();
}));

/**
 * GET /api/products/variants - Lista todas las variantes con su producto e inventario, ordenadas por nombre, color y talla.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de variantes formateadas.
 * @returns {Promise<void>}
 */
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

/**
 * POST /api/products/:id/variants - Crea una variante de un producto e inicializa su inventario. Requiere rol admin.
 * Crea la variante y su registro de inventario dentro de una misma transaccion.
 *
 * @param {import('express').Request} req - req.params.id identifica al producto; req.body con { color, talla, cantidad }.
 * @param {import('express').Response} res - Responde 201 con la variante creada y su cantidad inicial.
 * @returns {Promise<void>}
 */
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
