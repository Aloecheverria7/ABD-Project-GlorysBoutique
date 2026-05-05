import { Router } from 'express';
import { Categoria, Proveedor, Subcategoria, TipoCliente, TipoPago, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

catalogRouter.get('/lookups', asyncHandler(async (_req, res) => {
  const [categorias, subcategorias, proveedores, tiposCliente, tiposPago, usuarios] = await Promise.all([
    Categoria.findAll({ order: [['nombre', 'ASC']] }),
    Subcategoria.findAll({ order: [['nombre', 'ASC']] }),
    Proveedor.findAll({ order: [['nombre', 'ASC']] }),
    TipoCliente.findAll({ order: [['nombre', 'ASC']] }),
    TipoPago.findAll({ order: [['nombre', 'ASC']] }),
    Usuario.findAll({
      attributes: ['id', 'username', 'rol_id', 'activo'],
      order: [['username', 'ASC']]
    })
  ]);

  res.json({ categorias, subcategorias, proveedores, tiposCliente, tiposPago, usuarios });
}));

catalogRouter.get('/proveedores', asyncHandler(async (_req, res) => {
  res.json(await Proveedor.findAll({ order: [['nombre', 'ASC']] }));
}));

catalogRouter.post('/proveedores', requireRole('admin'), asyncHandler(async (req, res) => {
  const { nombre, telefono, direccion } = req.body;
  const proveedor = await Proveedor.create({
    nombre,
    telefono: telefono || null,
    direccion: direccion || null
  });
  sendCreated(res, proveedor);
}));

catalogRouter.get('/categorias', asyncHandler(async (_req, res) => {
  res.json(await Categoria.findAll({ order: [['nombre', 'ASC']] }));
}));

catalogRouter.post('/categorias', requireRole('admin'), asyncHandler(async (req, res) => {
  const categoria = await Categoria.create({ nombre: req.body.nombre });
  sendCreated(res, categoria);
}));
