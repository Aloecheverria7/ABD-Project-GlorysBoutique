/** @file Rutas del modulo de credito: roster de clientes con deuda activa, su plan de cuotas y saldos. */
import { Router } from 'express';
import { Abono, Cliente, Cuota, Deuda, Venta } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler } from '../utils/http.js';

export const creditRouter = Router();

creditRouter.use(requireAuth);

/**
 * GET /api/credit - Lista los clientes con credito activo. Para cada cliente devuelve sus deudas
 * (con el plan de cuotas adjunto), el monto total, lo abonado, la cantidad de abonos y lo restante,
 * agregados por moneda. Solo se incluyen las deudas con saldo pendiente (restante > 0).
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con un arreglo de clientes con credito activo.
 * @returns {Promise<void>}
 */
creditRouter.get('/', asyncHandler(async (_req, res) => {
  const deudas = await Deuda.findAll({
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['id', 'nombre', 'cedula', 'telefono'] },
      { model: Cuota, as: 'cuotas', attributes: ['numero', 'monto', 'estado', 'fecha_vencimiento'] },
      { model: Venta, as: 'ventaInfo', attributes: ['id', 'fecha'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });

  const ids = deudas.map((d) => d.id);
  // Abonos aplicados a estas deudas (incluye el enganche, que se asienta como abono con deuda_id).
  const abonoRows = ids.length
    ? await Abono.findAll({ where: { deuda_id: ids }, attributes: ['deuda_id', 'monto'], raw: true })
    : [];
  const abonoMap = new Map();
  for (const row of abonoRows) {
    const current = abonoMap.get(row.deuda_id) || { abonado: 0, count: 0 };
    current.abonado += Number(row.monto || 0);
    current.count += 1;
    abonoMap.set(row.deuda_id, current);
  }

  // Agrupa las deudas por cliente y acumula los totales por moneda.
  const byClient = new Map();
  for (const deuda of deudas) {
    const info = abonoMap.get(deuda.id) || { abonado: 0, count: 0 };
    const montoTotal = Number(deuda.monto_total);
    const restante = Number((montoTotal - info.abonado).toFixed(2));
    if (restante <= 0.01) continue; // deuda saldada: no entra al roster de credito activo

    const data = deuda.get({ plain: true });
    const clienteId = deuda.cliente_id;
    if (!byClient.has(clienteId)) {
      byClient.set(clienteId, {
        cliente_id: clienteId,
        cliente: data.clienteInfo?.nombre || null,
        cedula: data.clienteInfo?.cedula || null,
        telefono: data.clienteInfo?.telefono || null,
        deudas: [],
        totales: {}
      });
    }
    const entry = byClient.get(clienteId);

    const cuotas = (data.cuotas || [])
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((c) => ({
        numero: c.numero,
        monto: Number(c.monto),
        estado: c.estado,
        fecha_vencimiento: c.fecha_vencimiento
      }));

    entry.deudas.push({
      id: data.id,
      venta_id: data.venta_id,
      fecha: data.fecha,
      moneda: data.moneda || 'NIO',
      monto_total: montoTotal,
      abonado: Number(info.abonado.toFixed(2)),
      num_abonos: info.count,
      restante,
      num_cuotas: data.num_cuotas,
      estado: data.estado,
      cuotas
    });

    const moneda = data.moneda || 'NIO';
    const total = entry.totales[moneda] || { monto_total: 0, abonado: 0, restante: 0, num_abonos: 0 };
    total.monto_total += montoTotal;
    total.abonado += info.abonado;
    total.restante += restante;
    total.num_abonos += info.count;
    entry.totales[moneda] = total;
  }

  const roster = [...byClient.values()].map((entry) => ({
    ...entry,
    totales: Object.fromEntries(
      Object.entries(entry.totales).map(([moneda, t]) => [moneda, {
        monto_total: Number(t.monto_total.toFixed(2)),
        abonado: Number(t.abonado.toFixed(2)),
        restante: Number(t.restante.toFixed(2)),
        num_abonos: t.num_abonos
      }])
    )
  }));

  res.json(roster);
}));
