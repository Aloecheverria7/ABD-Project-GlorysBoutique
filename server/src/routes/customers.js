import { Op } from 'sequelize';
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Abono, Cliente, TipoCliente, TipoPago, Venta } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const customersRouter = Router();

customersRouter.use(requireAuth);

function formatCustomer(customer, balances) {
  const data = customer.get({ plain: true });
  return {
    ...data,
    tipo_cliente: data.tipoCliente?.nombre || null,
    tipoCliente: undefined,
    saldo_nio: balances?.[data.id]?.NIO || 0,
    saldo_usd: balances?.[data.id]?.USD || 0
  };
}

async function balancesByCustomer() {
  const creditTypes = await TipoPago.findAll({ where: { es_credito: true }, attributes: ['id'] });
  const creditIds = creditTypes.map((t) => t.id);

  const ventas = creditIds.length > 0
    ? await Venta.findAll({
        attributes: [
          'cliente_id',
          'moneda',
          [sequelize.fn('SUM', sequelize.col('total')), 'total']
        ],
        where: { tipo_pago_id: { [Op.in]: creditIds }, cliente_id: { [Op.not]: null } },
        group: ['cliente_id', 'moneda'],
        raw: true
      })
    : [];

  const abonos = await Abono.findAll({
    attributes: [
      'cliente_id',
      'moneda',
      [sequelize.fn('SUM', sequelize.col('monto')), 'total']
    ],
    group: ['cliente_id', 'moneda'],
    raw: true
  });

  const map = {};
  ventas.forEach((row) => {
    map[row.cliente_id] = map[row.cliente_id] || { NIO: 0, USD: 0 };
    map[row.cliente_id][row.moneda || 'NIO'] += Number(row.total || 0);
  });
  abonos.forEach((row) => {
    map[row.cliente_id] = map[row.cliente_id] || { NIO: 0, USD: 0 };
    map[row.cliente_id][row.moneda || 'NIO'] -= Number(row.total || 0);
  });

  Object.keys(map).forEach((id) => {
    map[id].NIO = Number(map[id].NIO.toFixed(2));
    map[id].USD = Number(map[id].USD.toFixed(2));
  });

  return map;
}

customersRouter.get('/', asyncHandler(async (_req, res) => {
  const [rows, balances] = await Promise.all([
    Cliente.findAll({
      include: [{ model: TipoCliente, as: 'tipoCliente', attributes: ['nombre'] }],
      order: [['created_at', 'DESC'], ['id', 'DESC']]
    }),
    balancesByCustomer()
  ]);
  res.json(rows.map((customer) => formatCustomer(customer, balances)));
}));

customersRouter.post('/', asyncHandler(async (req, res) => {
  const { nombre, telefono, cedula, tipo_cliente_id } = req.body;
  const customer = await Cliente.create({
    nombre,
    telefono: telefono || null,
    cedula: cedula || null,
    tipo_cliente_id: tipo_cliente_id || null
  });
  sendCreated(res, customer);
}));

customersRouter.put('/:id', asyncHandler(async (req, res) => {
  const { nombre, telefono, cedula, tipo_cliente_id } = req.body;
  const customer = await Cliente.findByPk(req.params.id);

  if (!customer) {
    res.status(404).json({ message: 'Cliente no encontrado.' });
    return;
  }

  await customer.update({
    nombre,
    telefono: telefono || null,
    cedula: cedula || null,
    tipo_cliente_id: tipo_cliente_id || null
  });
  res.json(customer);
}));

customersRouter.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const deleted = await Cliente.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Cliente no encontrado.' });
    return;
  }
  res.status(204).end();
}));
