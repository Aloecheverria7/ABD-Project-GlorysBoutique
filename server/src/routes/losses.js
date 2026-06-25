/** @file Rutas del modulo de perdidas: registro de mermas/roturas/robos con descuento de inventario y Kardex. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Inventario, KardexMovimiento, Perdida, Producto, ProductoVariante, Usuario } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const lossesRouter = Router();

lossesRouter.use(requireAuth);
const adminOnly = requireRole('admin');

const MOTIVOS = ['deterioro', 'robo', 'merma', 'otro'];

/**
 * Da formato a una perdida resolviendo el producto, color, talla y usuario.
 *
 * @param {object} perdida - Instancia Sequelize de Perdida con varianteInfo y usuarioInfo.
 * @returns {object} Perdida normalizada.
 */
function formatPerdida(perdida) {
  const data = perdida.get({ plain: true });
  return {
    id: data.id,
    producto_variante_id: data.producto_variante_id,
    producto: data.varianteInfo?.productoInfo?.nombre || null,
    color: data.varianteInfo?.color || null,
    talla: data.varianteInfo?.talla || null,
    cantidad: data.cantidad,
    costo_unitario: Number(data.costo_unitario),
    costo_total: Number(data.costo_total),
    motivo: data.motivo,
    usuario: data.usuarioInfo?.username || null,
    fecha: data.fecha
  };
}

/**
 * GET /api/losses - Lista las perdidas registradas (mas recientes primero) y el total del gasto por perdida.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con { perdidas, total_gasto }.
 * @returns {Promise<void>}
 */
lossesRouter.get('/', asyncHandler(async (_req, res) => {
  const perdidas = await Perdida.findAll({
    include: [
      {
        model: ProductoVariante,
        as: 'varianteInfo',
        attributes: ['color', 'talla'],
        include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
      },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  const lista = perdidas.map(formatPerdida);
  const totalGasto = Number(lista.reduce((sum, p) => sum + p.costo_total, 0).toFixed(2));
  res.json({ perdidas: lista, total_gasto: totalGasto });
}));

/**
 * POST /api/losses - Registra una perdida de producto. Requiere rol admin.
 * Descuenta el inventario (validando stock), calcula el gasto (cantidad x costo unitario) y asienta
 * la salida en el Kardex. Todo dentro de una transaccion.
 *
 * @param {import('express').Request} req - req.body con { producto_variante_id, cantidad, costo_unitario, motivo }.
 * @param {import('express').Response} res - Responde 201 con la perdida creada o 400 ante datos invalidos o stock insuficiente.
 * @throws {Error} Error con .status 400 cuando la cantidad supera el stock disponible.
 * @returns {Promise<void>}
 */
lossesRouter.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { producto_variante_id } = req.body;
  const cantidad = Math.trunc(Number(req.body.cantidad));
  const costoUnitario = Number(req.body.costo_unitario);
  const motivo = MOTIVOS.includes(req.body.motivo) ? req.body.motivo : 'otro';

  if (!producto_variante_id) {
    res.status(400).json({ message: 'Selecciona una variante de producto.' });
    return;
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' });
    return;
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    res.status(400).json({ message: 'El costo unitario no es valido.' });
    return;
  }

  const costoTotal = Number((cantidad * costoUnitario).toFixed(2));

  const created = await sequelize.transaction(async (transaction) => {
    const inventory = await Inventario.findOne({
      where: { producto_variante_id },
      transaction,
      lock: true
    });
    if (!inventory || Number(inventory.cantidad) < cantidad) {
      const error = new Error('Stock insuficiente para registrar la perdida.');
      error.status = 400;
      throw error;
    }
    await inventory.update({ cantidad: Number(inventory.cantidad) - cantidad }, { transaction });

    const perdida = await Perdida.create({
      producto_variante_id: Number(producto_variante_id),
      cantidad,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      motivo,
      usuario_id: req.user.id
    }, { transaction });

    await KardexMovimiento.create({
      producto_variante_id: Number(producto_variante_id),
      tipo: 'salida',
      cantidad,
      motivo: `Perdida: ${motivo}`,
      costo_unitario: costoUnitario,
      referencia_tipo: 'perdida',
      referencia_id: perdida.id,
      usuario_id: req.user.id
    }, { transaction });

    return perdida;
  });

  const refreshed = await Perdida.findByPk(created.id, {
    include: [
      {
        model: ProductoVariante,
        as: 'varianteInfo',
        attributes: ['color', 'talla'],
        include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
      },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ]
  });
  sendCreated(res, formatPerdida(refreshed));
}));
