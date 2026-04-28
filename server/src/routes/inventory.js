import { Router } from 'express';
import { Inventario, Producto, ProductoVariante } from '../models/index.js';
import { asyncHandler } from '../utils/http.js';

export const inventoryRouter = Router();

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

inventoryRouter.put('/:variantId', asyncHandler(async (req, res) => {
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
