/** @file Rutas de inventario: existencias por variante, movimientos de stock con Kardex y soporte de pacas. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Inventario, KardexMovimiento, Producto, ProductoVariante, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);
const adminOnly = requireRole('admin');

/**
 * Da formato a un movimiento de Kardex resolviendo el producto, color, talla y usuario.
 *
 * @param {object} mov - Instancia Sequelize de KardexMovimiento con varianteInfo y usuarioInfo.
 * @returns {object} Movimiento de Kardex normalizado.
 */
function formatKardex(mov) {
  const data = mov.get({ plain: true });
  return {
    id: data.id,
    producto_variante_id: data.producto_variante_id,
    producto: data.varianteInfo?.productoInfo?.nombre || null,
    color: data.varianteInfo?.color || null,
    talla: data.varianteInfo?.talla || null,
    tipo: data.tipo,
    cantidad: data.cantidad,
    motivo: data.motivo,
    referencia_tipo: data.referencia_tipo,
    referencia_id: data.referencia_id,
    usuario: data.usuarioInfo?.username || null,
    fecha: data.fecha
  };
}

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

/**
 * GET /api/inventory/kardex - Lista los movimientos de Kardex (ingresos, salidas y ajustes),
 * opcionalmente filtrados por variante. Limitado a los 100 mas recientes.
 *
 * @param {import('express').Request} req - req.query.variante (opcional) filtra por variante.
 * @param {import('express').Response} res - Responde 200 con el arreglo de movimientos.
 * @returns {Promise<void>}
 */
inventoryRouter.get('/kardex', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.variante) where.producto_variante_id = Number(req.query.variante);
  const movimientos = await KardexMovimiento.findAll({
    where,
    include: [
      {
        model: ProductoVariante,
        as: 'varianteInfo',
        attributes: ['color', 'talla'],
        include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
      },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']],
    limit: 100
  });
  res.json(movimientos.map(formatKardex));
}));

/**
 * POST /api/inventory/movimientos - Registra un movimiento de inventario y su Kardex. Requiere rol admin.
 * tipo: 'ingreso' (suma), 'salida' (resta, valida stock) o 'ajuste' (fija la cantidad absoluta).
 * Soporta pacas: si unidad='paca', la cantidad capturada se multiplica por piezas_por_paca para
 * obtener las unidades vendibles afectadas. Todo ocurre en una transaccion.
 *
 * @param {import('express').Request} req - req.body con { producto_variante_id, tipo, cantidad, motivo, unidad, piezas_por_paca }.
 * @param {import('express').Response} res - Responde 201 con { producto_variante_id, cantidad } o 400 ante datos invalidos o stock insuficiente.
 * @throws {Error} Error con .status 400 cuando una salida supera el stock disponible.
 * @returns {Promise<void>}
 */
inventoryRouter.post('/movimientos', adminOnly, asyncHandler(async (req, res) => {
  const { producto_variante_id, tipo, motivo } = req.body;
  const cantidad = Math.trunc(Number(req.body.cantidad));
  const esPaca = req.body.unidad === 'paca';
  const piezas = esPaca ? Math.max(1, Math.trunc(Number(req.body.piezas_por_paca) || 1)) : 1;

  if (!producto_variante_id) {
    res.status(400).json({ message: 'Selecciona una variante de producto.' });
    return;
  }
  if (!['ingreso', 'salida', 'ajuste'].includes(tipo)) {
    res.status(400).json({ message: 'El tipo de movimiento no es valido.' });
    return;
  }
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    res.status(400).json({ message: 'La cantidad no es valida.' });
    return;
  }
  if ((tipo === 'ingreso' || tipo === 'salida') && cantidad <= 0) {
    res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' });
    return;
  }

  // Una paca se "explota" en piezas_por_paca unidades vendibles.
  const efectivas = cantidad * piezas;

  const result = await sequelize.transaction(async (transaction) => {
    const [inventory] = await Inventario.findOrCreate({
      where: { producto_variante_id },
      defaults: { cantidad: 0 },
      transaction,
      lock: true
    });

    let nueva;
    if (tipo === 'ingreso') {
      nueva = Number(inventory.cantidad) + efectivas;
    } else if (tipo === 'salida') {
      if (Number(inventory.cantidad) < efectivas) {
        const error = new Error('Stock insuficiente');
        error.status = 400;
        throw error;
      }
      nueva = Number(inventory.cantidad) - efectivas;
    } else {
      // Ajuste: fija la cantidad absoluta (en unidades efectivas).
      nueva = efectivas;
    }

    await inventory.update({ cantidad: nueva }, { transaction });

    await KardexMovimiento.create({
      producto_variante_id: Number(producto_variante_id),
      tipo,
      cantidad: efectivas,
      motivo: motivo ? String(motivo).slice(0, 255) : (esPaca ? `${cantidad} paca(s) x ${piezas} u.` : null),
      referencia_tipo: 'ajuste_manual',
      usuario_id: req.user.id
    }, { transaction });

    return nueva;
  });

  sendCreated(res, { producto_variante_id: Number(producto_variante_id), cantidad: result });
}));
