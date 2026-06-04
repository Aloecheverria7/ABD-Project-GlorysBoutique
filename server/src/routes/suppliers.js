/** @file Rutas de proveedores: alta, edicion, borrado y vinculacion de productos con su costo. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Producto, ProductoProveedor, Proveedor } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Convierte una instancia de Proveedor (con sus productos asociados) a un objeto plano
 * listo para enviar en la respuesta JSON. Incluye el costo y la moneda de cada producto
 * tomados de la tabla intermedia ProductoProveedor.
 *
 * @param {import('sequelize').Model} supplier - Instancia Sequelize de Proveedor con la relacion 'productos' incluida.
 * @returns {{ id: number, nombre: string, telefono: (string|null), direccion: (string|null), productos: Array<{ id: number, nombre: string, costo: (number|null), moneda_costo: string }>, total_productos: number }} Proveedor normalizado.
 */
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

/**
 * GET /api/suppliers - Lista todos los proveedores ordenados por nombre, con sus productos asociados.
 *
 * @param {import('express').Request} _req - Peticion HTTP (no usa parametros).
 * @param {import('express').Response} res - Responde con un arreglo de proveedores normalizados.
 * @returns {Promise<void>}
 */
suppliersRouter.get('/', asyncHandler(async (_req, res) => {
  const suppliers = await Proveedor.findAll({
    include: SUPPLIER_INCLUDE,
    order: [['nombre', 'ASC']]
  });
  res.json(suppliers.map(formatSupplier));
}));

/**
 * GET /api/suppliers/:id - Devuelve un proveedor por su identificador con sus productos asociados.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del proveedor).
 * @param {import('express').Response} res - Responde con el proveedor normalizado, o 404 si no existe.
 * @returns {Promise<void>}
 */
suppliersRouter.get('/:id', asyncHandler(async (req, res) => {
  const supplier = await Proveedor.findByPk(req.params.id, { include: SUPPLIER_INCLUDE });
  if (!supplier) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }
  res.json(formatSupplier(supplier));
}));

/**
 * POST /api/suppliers - Crea un proveedor y, opcionalmente, vincula productos con su costo.
 * Solo accesible para el rol admin. La creacion del proveedor y sus vinculos se hace dentro de
 * una transaccion. Responde 201 con el proveedor recien creado.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.body: { nombre, telefono, direccion, productos }.
 *   nombre es obligatorio; productos es un arreglo opcional de { producto_id|id, costo, moneda_costo }.
 * @param {import('express').Response} res - Responde 201 con el proveedor normalizado, o 400 si falta el nombre.
 * @returns {Promise<void>}
 */
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

/**
 * PUT /api/suppliers/:id - Actualiza un proveedor y reemplaza sus productos vinculados.
 * Solo accesible para el rol admin. Si req.body.productos es un arreglo, se borran todos los
 * vinculos previos y se recrean. La actualizacion se ejecuta dentro de una transaccion.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id y req.body:
 *   { nombre, telefono, direccion, productos }.
 * @param {import('express').Response} res - Responde con el proveedor actualizado, o 404 si no existe.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/suppliers/:id - Elimina un proveedor por su identificador.
 * Solo accesible para el rol admin.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del proveedor).
 * @param {import('express').Response} res - Responde 204 sin contenido si se elimino, o 404 si no existe.
 * @returns {Promise<void>}
 */
suppliersRouter.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const deleted = await Proveedor.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Proveedor no encontrado.' });
    return;
  }
  res.status(204).end();
}));

/**
 * POST /api/suppliers/:id/products - Vincula un producto a un proveedor o actualiza su costo y moneda.
 * Solo accesible para el rol admin. Si el vinculo ya existe y se envia costo o moneda_costo, se actualiza.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del proveedor) y
 *   req.body: { producto_id, costo, moneda_costo }. producto_id es obligatorio.
 * @param {import('express').Response} res - Responde 201 con el vinculo creado o actualizado;
 *   404 si el proveedor no existe; 400 si falta producto_id.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/suppliers/:id/products/:productId - Elimina el vinculo entre un proveedor y un producto.
 * Solo accesible para el rol admin.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del proveedor) y
 *   req.params.productId (id del producto).
 * @param {import('express').Response} res - Responde 204 sin contenido si se elimino, o 404 si el vinculo no existe.
 * @returns {Promise<void>}
 */
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
