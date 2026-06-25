/** @file Rutas de catalogos: listas de apoyo (lookups), proveedores y categorias. */
import { Router } from 'express';
import { Categoria, Denominacion, Proveedor, Role, Subcategoria, TipoCliente, TipoPago, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

/**
 * GET /api/catalog/lookups - Devuelve todas las listas de apoyo del sistema en una sola consulta.
 * Incluye categorias, subcategorias, proveedores, tipos de cliente, tipos de pago, usuarios y roles.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con { categorias, subcategorias, proveedores, tiposCliente, tiposPago, usuarios, roles }.
 * @returns {Promise<void>}
 */
catalogRouter.get('/lookups', asyncHandler(async (_req, res) => {
  const [categorias, subcategorias, proveedores, tiposCliente, tiposPago, usuarios, roles, denominaciones] = await Promise.all([
    Categoria.findAll({ order: [['nombre', 'ASC']] }),
    Subcategoria.findAll({ order: [['nombre', 'ASC']] }),
    Proveedor.findAll({ order: [['nombre', 'ASC']] }),
    TipoCliente.findAll({ order: [['nombre', 'ASC']] }),
    TipoPago.findAll({ attributes: ['id', 'nombre', 'es_credito'], order: [['nombre', 'ASC']] }),
    Usuario.findAll({
      attributes: ['id', 'username', 'rol_id', 'activo'],
      order: [['username', 'ASC']]
    }),
    Role.findAll({ order: [['nombre', 'ASC']] }),
    Denominacion.findAll({ where: { activo: true }, order: [['valor', 'DESC']] })
  ]);

  res.json({ categorias, subcategorias, proveedores, tiposCliente, tiposPago, usuarios, roles, denominaciones });
}));

/**
 * GET /api/catalog/proveedores - Lista los proveedores ordenados por nombre.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de proveedores.
 * @returns {Promise<void>}
 */
catalogRouter.get('/proveedores', asyncHandler(async (_req, res) => {
  res.json(await Proveedor.findAll({ order: [['nombre', 'ASC']] }));
}));

/**
 * POST /api/catalog/proveedores - Crea un proveedor nuevo. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.body con { nombre, telefono, direccion }; telefono y direccion son opcionales.
 * @param {import('express').Response} res - Responde 201 con el proveedor creado.
 * @returns {Promise<void>}
 */
catalogRouter.post('/proveedores', requireRole('admin'), asyncHandler(async (req, res) => {
  const { nombre, telefono, direccion } = req.body;
  const proveedor = await Proveedor.create({
    nombre,
    telefono: telefono || null,
    direccion: direccion || null
  });
  sendCreated(res, proveedor);
}));

/**
 * GET /api/catalog/categorias - Lista las categorias ordenadas por nombre.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de categorias.
 * @returns {Promise<void>}
 */
catalogRouter.get('/categorias', asyncHandler(async (_req, res) => {
  res.json(await Categoria.findAll({ order: [['nombre', 'ASC']] }));
}));

/**
 * POST /api/catalog/categorias - Crea una categoria nueva. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.body con { nombre }.
 * @param {import('express').Response} res - Responde 201 con la categoria creada.
 * @returns {Promise<void>}
 */
catalogRouter.post('/categorias', requireRole('admin'), asyncHandler(async (req, res) => {
  const categoria = await Categoria.create({ nombre: req.body.nombre });
  sendCreated(res, categoria);
}));
