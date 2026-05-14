import { Op } from 'sequelize';
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Abono, Cliente, TipoPago, Usuario, Venta } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

function formatAbono(abono) {
  const data = abono.get({ plain: true });
  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente: data.clienteInfo?.nombre || null,
    tipo_pago_id: data.tipo_pago_id,
    tipo_pago: data.tipoPagoInfo?.nombre || null,
    usuario_id: data.usuario_id,
    usuario: data.usuarioInfo?.username || null,
    monto: data.monto != null ? Number(data.monto) : 0,
    moneda: data.moneda || 'NIO',
    tasa_cambio: data.tasa_cambio != null ? Number(data.tasa_cambio) : null,
    notas: data.notas,
    fecha: data.fecha
  };
}

async function computeBalances(clienteId) {
  const sumByMoneda = async (model, where) => {
    const rows = await model.findAll({
      attributes: ['moneda', [sequelize.fn('SUM', sequelize.col('monto')), 'total']],
      where,
      group: ['moneda'],
      raw: true
    });
    return rows.reduce((acc, row) => {
      acc[row.moneda || 'NIO'] = Number(row.total || 0);
      return acc;
    }, {});
  };

  const sumVentasByMoneda = async (where) => {
    const rows = await Venta.findAll({
      attributes: ['moneda', [sequelize.fn('SUM', sequelize.col('total')), 'total']],
      where,
      group: ['moneda'],
      raw: true
    });
    return rows.reduce((acc, row) => {
      acc[row.moneda || 'NIO'] = Number(row.total || 0);
      return acc;
    }, {});
  };

  const creditTypes = await TipoPago.findAll({ where: { es_credito: true }, attributes: ['id'] });
  const creditIds = creditTypes.map((t) => t.id);

  const credit = creditIds.length > 0
    ? await sumVentasByMoneda({ cliente_id: clienteId, tipo_pago_id: { [Op.in]: creditIds } })
    : {};
  const paid = await sumByMoneda(Abono, { cliente_id: clienteId });

  const saldoNIO = (credit.NIO || 0) - (paid.NIO || 0);
  const saldoUSD = (credit.USD || 0) - (paid.USD || 0);

  return {
    saldo_nio: Number(saldoNIO.toFixed(2)),
    saldo_usd: Number(saldoUSD.toFixed(2)),
    ventas_credito_nio: credit.NIO || 0,
    ventas_credito_usd: credit.USD || 0,
    abonos_nio: paid.NIO || 0,
    abonos_usd: paid.USD || 0
  };
}

paymentsRouter.get('/', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.cliente_id) where.cliente_id = Number(req.query.cliente_id);
  const abonos = await Abono.findAll({
    where,
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  res.json(abonos.map(formatAbono));
}));

paymentsRouter.get('/customer/:id', asyncHandler(async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) {
    res.status(404).json({ message: 'Cliente no encontrado.' });
    return;
  }

  const [abonos, balances] = await Promise.all([
    Abono.findAll({
      where: { cliente_id: cliente.id },
      include: [
        { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] },
        { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
      ],
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    }),
    computeBalances(cliente.id)
  ]);

  res.json({
    cliente: { id: cliente.id, nombre: cliente.nombre },
    balances,
    abonos: abonos.map(formatAbono)
  });
}));

paymentsRouter.post('/', asyncHandler(async (req, res) => {
  const { cliente_id, tipo_pago_id, monto, moneda, notas } = req.body;

  if (!cliente_id) {
    res.status(400).json({ message: 'Selecciona un cliente registrado.' });
    return;
  }
  const montoNumber = Number(monto);
  if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
    res.status(400).json({ message: 'El monto debe ser un numero mayor que cero.' });
    return;
  }
  if (!tipo_pago_id) {
    res.status(400).json({ message: 'Selecciona un tipo de pago.' });
    return;
  }

  const tipoPago = await TipoPago.findByPk(tipo_pago_id);
  if (!tipoPago) {
    res.status(400).json({ message: 'Tipo de pago no valido.' });
    return;
  }
  if (tipoPago.es_credito) {
    res.status(400).json({ message: 'No puedes abonar con un tipo de pago de credito.' });
    return;
  }

  const cliente = await Cliente.findByPk(cliente_id);
  if (!cliente) {
    res.status(400).json({ message: 'Cliente no encontrado.' });
    return;
  }

  const monedaFinal = moneda === 'USD' ? 'USD' : 'NIO';
  let tasaCambio = null;
  if (monedaFinal === 'USD') {
    const config = await sequelize.models.Configuracion.findByPk(1);
    tasaCambio = config ? Number(config.tasa_cambio_usd) : null;
  }

  const created = await Abono.create({
    cliente_id: cliente.id,
    tipo_pago_id: tipoPago.id,
    usuario_id: req.user.id,
    monto: montoNumber,
    moneda: monedaFinal,
    tasa_cambio: tasaCambio,
    notas: notas ? String(notas).slice(0, 255) : null
  });

  const refreshed = await Abono.findByPk(created.id, {
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] }
    ]
  });

  const balances = await computeBalances(cliente.id);
  sendCreated(res, { ...formatAbono(refreshed), balances });
}));
