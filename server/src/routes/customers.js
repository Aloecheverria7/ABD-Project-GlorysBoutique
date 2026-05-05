import { Router } from 'express';
import { Cliente, TipoCliente } from '../models/index.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const customersRouter = Router();

customersRouter.use(requireAuth);

function formatCustomer(customer) {
  const data = customer.get({ plain: true });
  return {
    ...data,
    tipo_cliente: data.tipoCliente?.nombre || null,
    tipoCliente: undefined
  };
}

customersRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await Cliente.findAll({
    include: [{ model: TipoCliente, as: 'tipoCliente', attributes: ['nombre'] }],
    order: [['created_at', 'DESC'], ['id', 'DESC']]
  });
  res.json(rows.map(formatCustomer));
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
