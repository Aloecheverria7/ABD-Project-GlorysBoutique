/** @file Rutas de clientes: listado con saldos, creacion, actualizacion y eliminacion. */
import { Op } from 'sequelize';
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Abono, Cliente, TipoCliente, TipoPago, Venta } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const customersRouter = Router();

customersRouter.use(requireAuth);

/**
 * Valida los datos de contacto de un cliente segun el formato nicaraguense.
 *
 * @param {{ telefono?: string, cedula?: string }} contacto - Telefono y cedula a validar; ambos opcionales.
 * @returns {string|null} Mensaje de error si la validacion falla, o null si los datos son validos.
 */
// Telefono: solo digitos, maximo 8 (formato nicaraguense).
// Cedula: digitos, guiones y una letra final, maximo 16 caracteres (14 + 2 guiones).
function validateContacto({ telefono, cedula }) {
  if (telefono) {
    if (!/^\d{1,8}$/.test(String(telefono))) {
      return 'El telefono debe tener hasta 8 digitos y solo numeros.';
    }
  }
  if (cedula) {
    const value = String(cedula);
    if (value.length > 16 || !/^[0-9-]{1,15}[0-9A-Za-z]$/.test(value)) {
      return 'La cedula admite hasta 16 caracteres (numeros y guiones).';
    }
  }
  return null;
}

/**
 * Da formato a un cliente exponiendo el nombre del tipo de cliente y sus saldos por moneda.
 *
 * @param {object} customer - Instancia Sequelize del cliente con la asociacion tipoCliente.
 * @param {Object.<number, { NIO: number, USD: number }>} [balances] - Mapa de saldos por id de cliente y moneda.
 * @returns {object} Cliente con tipo_cliente, saldo_nio y saldo_usd resueltos.
 */
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

/**
 * Calcula el saldo pendiente de cada cliente por moneda.
 * Suma los totales de las ventas a credito y resta los abonos registrados, agrupando por cliente y moneda.
 *
 * @returns {Promise<Object.<number, { NIO: number, USD: number }>>} Mapa de saldos por id de cliente, redondeados a dos decimales.
 */
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

  // Regla de negocio: el saldo de cada cliente por moneda = ventas a credito (suma) menos abonos
  // (resta). Es la misma formula que computeBalances() en payments.js, pero aqui se resuelve para
  // todos los clientes de una vez (para la tabla de clientes) en lugar de cliente por cliente.
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

/**
 * GET /api/customers - Lista los clientes con su tipo y saldos por moneda.
 * Ordena por fecha de creacion descendente y calcula los saldos en paralelo.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de clientes formateados.
 * @returns {Promise<void>}
 */
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

/**
 * POST /api/customers - Crea un cliente nuevo.
 * Valida telefono (hasta 8 digitos) y cedula (hasta 16 caracteres) antes de insertar.
 *
 * @param {import('express').Request} req - req.body con { nombre, telefono, cedula, tipo_cliente_id }.
 * @param {import('express').Response} res - Responde 201 con el cliente creado o 400 si la validacion de contacto falla.
 * @returns {Promise<void>}
 */
customersRouter.post('/', asyncHandler(async (req, res) => {
  const { nombre, telefono, cedula, tipo_cliente_id } = req.body;
  const contactoError = validateContacto({ telefono, cedula });
  if (contactoError) {
    res.status(400).json({ message: contactoError });
    return;
  }
  const customer = await Cliente.create({
    nombre,
    telefono: telefono || null,
    cedula: cedula || null,
    tipo_cliente_id: tipo_cliente_id || null
  });
  sendCreated(res, customer);
}));

/**
 * PUT /api/customers/:id - Actualiza un cliente existente.
 * Valida telefono y cedula antes de aplicar los cambios.
 *
 * @param {import('express').Request} req - req.params.id identifica al cliente; req.body con { nombre, telefono, cedula, tipo_cliente_id }.
 * @param {import('express').Response} res - Responde 200 con el cliente actualizado, 400 si la validacion falla o 404 si no existe.
 * @returns {Promise<void>}
 */
customersRouter.put('/:id', asyncHandler(async (req, res) => {
  const { nombre, telefono, cedula, tipo_cliente_id } = req.body;
  const contactoError = validateContacto({ telefono, cedula });
  if (contactoError) {
    res.status(400).json({ message: contactoError });
    return;
  }
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

/**
 * DELETE /api/customers/:id - Elimina un cliente. Requiere rol admin.
 *
 * @param {import('express').Request} req - req.params.id identifica al cliente a eliminar.
 * @param {import('express').Response} res - Responde 204 sin contenido o 404 si el cliente no existe.
 * @returns {Promise<void>}
 */
customersRouter.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const deleted = await Cliente.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    res.status(404).json({ message: 'Cliente no encontrado.' });
    return;
  }
  res.status(204).end();
}));
