/** @file Rutas de abonos de clientes: registro de pagos y calculo de saldos pendientes por credito. */
import { Op } from 'sequelize';
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Abono, Cliente, TipoPago, Usuario, Venta } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

/**
 * Convierte una instancia de Abono a un objeto plano para la respuesta JSON,
 * resolviendo los nombres de cliente, tipo de pago y usuario desde las relaciones incluidas.
 *
 * @param {import('sequelize').Model} abono - Instancia Sequelize de Abono con 'clienteInfo', 'tipoPagoInfo' y 'usuarioInfo'.
 * @returns {{ id: number, cliente_id: number, cliente: (string|null), tipo_pago_id: number, tipo_pago: (string|null), usuario_id: number, usuario: (string|null), monto: number, moneda: string, tasa_cambio: (number|null), notas: (string|null), fecha: Date }} Abono normalizado.
 */
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

/**
 * Calcula los saldos pendientes de un cliente por moneda (NIO y USD).
 * El saldo es la suma de las ventas hechas con tipos de pago marcados como credito menos
 * la suma de los abonos del cliente, calculado por separado para cada moneda.
 *
 * @param {number} clienteId - Identificador del cliente.
 * @returns {Promise<{ saldo_nio: number, saldo_usd: number, ventas_credito_nio: number, ventas_credito_usd: number, abonos_nio: number, abonos_usd: number }>} Saldos y totales por moneda.
 */
async function computeBalances(clienteId) {
  /**
   * Suma la columna 'monto' de un modelo agrupando por moneda.
   *
   * @param {import('sequelize').ModelStatic} model - Modelo Sequelize a consultar (ej. Abono).
   * @param {object} where - Condiciones de filtrado para la consulta.
   * @returns {Promise<Object<string, number>>} Mapa de moneda a total acumulado.
   */
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

  /**
   * Suma la columna 'total' del modelo Venta agrupando por moneda.
   *
   * @param {object} where - Condiciones de filtrado para la consulta de ventas.
   * @returns {Promise<Object<string, number>>} Mapa de moneda a total acumulado de ventas.
   */
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

  // Regla de negocio: solo las ventas pagadas con un tipo de pago marcado como credito
  // (es_credito = true) generan deuda. Las ventas de contado (efectivo, tarjeta, etc.) no cuentan.
  const creditTypes = await TipoPago.findAll({ where: { es_credito: true }, attributes: ['id'] });
  const creditIds = creditTypes.map((t) => t.id);

  const credit = creditIds.length > 0
    ? await sumVentasByMoneda({ cliente_id: clienteId, tipo_pago_id: { [Op.in]: creditIds } })
    : {};
  const paid = await sumByMoneda(Abono, { cliente_id: clienteId });

  // Regla de negocio: el saldo pendiente = total vendido a credito - total abonado, calculado
  // por separado para cada moneda (NIO y USD no se mezclan; no se convierte entre monedas).
  // Un saldo positivo significa que el cliente debe; cero o negativo significa que esta al dia.
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

/**
 * GET /api/payments - Lista los abonos ordenados por fecha descendente, opcionalmente filtrados por cliente.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.query.cliente_id (opcional) para filtrar por cliente.
 * @param {import('express').Response} res - Responde con un arreglo de abonos normalizados.
 * @returns {Promise<void>}
 */
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

/**
 * GET /api/payments/customer/:id - Devuelve los abonos y los saldos pendientes de un cliente.
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.params.id (id del cliente).
 * @param {import('express').Response} res - Responde con { cliente, balances, abonos }, o 404 si el cliente no existe.
 * @returns {Promise<void>}
 */
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

/**
 * POST /api/payments - Registra un abono de un cliente y devuelve sus saldos actualizados.
 * Valida que el cliente exista, que el monto sea un numero mayor que cero y que el tipo de pago
 * exista y no sea de credito. Si la moneda es USD, toma la tasa de cambio de la Configuracion (id 1).
 *
 * @param {import('express').Request} req - Peticion HTTP. Usa req.user.id (usuario autenticado) y req.body:
 *   { cliente_id, tipo_pago_id, monto, moneda, notas }.
 * @param {import('express').Response} res - Responde 201 con el abono normalizado mas { balances };
 *   400 si falta cliente, el monto es invalido, falta el tipo de pago, el tipo no es valido, es de credito o el cliente no existe.
 * @returns {Promise<void>}
 */
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
  // Regla de negocio: un abono es un pago que reduce la deuda, por lo que debe hacerse con un
  // medio de contado (efectivo, tarjeta...). Abonar "a credito" no tendria sentido: aumentaria
  // la deuda en vez de pagarla.
  if (tipoPago.es_credito) {
    res.status(400).json({ message: 'No puedes abonar con un tipo de pago de credito.' });
    return;
  }

  const cliente = await Cliente.findByPk(cliente_id);
  if (!cliente) {
    res.status(400).json({ message: 'Cliente no encontrado.' });
    return;
  }

  // Regla de negocio: el abono se registra en su propia moneda y, si es USD, se guarda la tasa
  // vigente como snapshot. El saldo se compara por moneda, asi que un abono en USD solo reduce la
  // deuda en USD (no se convierte para pagar deuda en NIO).
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
