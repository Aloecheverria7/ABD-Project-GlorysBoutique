/** @file Rutas de inventario: listado de existencias por variante y ajuste de cantidades. */
import { Router } from 'express';
import { Inventario, Producto, ProductoVariante } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler } from '../utils/http.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

/**
 * Da formato a un registro de inventario resolviendo el nombre del producto, color y talla de la variante.
 *
 * @param {object} item - Instancia Sequelize del inventario con la asociacion variante y su productoInfo.
 * @returns {object} Inventario plano con producto, color, talla y cantidad.
 */
function formatInventory(item) {
  const data = item.get({ plain: true });
  return {
    id: data.id,
    producto_variante_id: data.producto_variante_id,
    producto: data.variante?.productoInfo?.nombre || null,
    color: data.variante?.color || null,
    talla: data.variante?.talla || null,
    cantidad: data.cantidad
  };
}

/**
 * GET /api/inventory - Lista el inventario con producto, color y talla, ordenado por nombre, color y talla.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de existencias formateadas.
 * @returns {Promise<void>}
 */
inventoryRouter.get('/', asyncHandler(async (_req, res) => {
  const inventory = await Inventario.findAll({
    include: [{
      model: ProductoVariante,
      as: 'variante',
      attributes: ['id', 'color', 'talla'],
      include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
    }],
    order: [
      [{ model: ProductoVariante, as: 'variante' }, { model: Producto, as: 'productoInfo' }, 'nombre', 'ASC'],
      [{ model: ProductoVariante, as: 'variante' }, 'color', 'ASC'],
      [{ model: ProductoVariante, as: 'variante' }, 'talla', 'ASC']
    ]
  });

  res.json(inventory.map(formatInventory));
}));

/**
 * PUT /api/inventory/:variantId - Ajusta la cantidad en inventario de una variante. Requiere rol admin.
 * Crea el registro de inventario si la variante aun no tiene uno y solo actualiza cuando la cantidad cambia.
 *
 * @param {import('express').Request} req - req.params.variantId identifica la variante; req.body con { cantidad }.
 * @param {import('express').Response} res - Responde 200 con { id, producto_variante_id, cantidad }.
 * @returns {Promise<void>}
 */
inventoryRouter.put('/:variantId', requireRole('admin'), asyncHandler(async (req, res) => {
  const cantidad = Number(req.body.cantidad || 0);
  const [item] = await Inventario.findOrCreate({
    where: { producto_variante_id: req.params.variantId },
    defaults: { cantidad }
  });

  if (item.cantidad !== cantidad) {
    await item.update({ cantidad });
  }

  res.json({
    id: item.id,
    producto_variante_id: Number(req.params.variantId),
    cantidad
  });
}));
