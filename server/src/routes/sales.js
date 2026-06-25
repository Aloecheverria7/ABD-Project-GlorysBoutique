/** @file Rutas de ventas: listado, detalle y registro de ventas con descuento de inventario. */
import { Router } from 'express';
import { sequelize } from '../db.js';
import { Abono, Cliente, Configuracion, Cuota, DetalleVenta, Deuda, Inventario, KardexMovimiento, Producto, ProductoVariante, TipoPago, Usuario, Venta, VentaPago } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, sendCreated } from '../utils/http.js';

export const salesRouter = Router();

salesRouter.use(requireAuth);

/**
 * Divide un monto en n cuotas lo mas parejas posible, repartiendo los centavos sobrantes en las
 * primeras cuotas para que la suma cuadre exactamente con el monto financiado.
 *
 * @param {number} amount - Monto total a financiar.
 * @param {number} n - Numero de cuotas (entero >= 1).
 * @returns {Array<{ numero: number, monto: number }>} Plan de cuotas con numero y monto.
 */
function splitInstallments(amount, n) {
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  const plan = [];
  for (let i = 0; i < n; i += 1) {
    const monto = (base + (i < remainder ? 1 : 0)) / 100;
    plan.push({ numero: i + 1, monto });
  }
  return plan;
}

/**
 * Da formato a una venta resolviendo los nombres de cliente, usuario y tipo de pago, y normalizando moneda y tasa.
 *
 * @param {object} sale - Instancia Sequelize de la venta con asociaciones clienteInfo, usuarioInfo y tipoPagoInfo.
 * @returns {object} Venta plana con los campos resueltos.
 */
function formatSale(sale) {
  const data = sale.get({ plain: true });
  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente_nombre: data.cliente_nombre,
    usuario_id: data.usuario_id,
    tipo_pago_id: data.tipo_pago_id,
    cliente: data.clienteInfo?.nombre || data.cliente_nombre || null,
    usuario: data.usuarioInfo?.username || null,
    tipo_pago: data.tipoPagoInfo?.nombre || null,
    tipo_venta: data.tipo_venta || 'contado',
    total: data.total,
    moneda: data.moneda || 'NIO',
    tasa_cambio: data.tasa_cambio != null ? Number(data.tasa_cambio) : null,
    fecha: data.fecha
  };
}

/**
 * Da formato a un detalle de venta resolviendo el nombre del producto, color y talla de la variante.
 *
 * @param {object} detail - Instancia Sequelize del detalle con la asociacion varianteInfo y su productoInfo.
 * @returns {object} Detalle plano con producto, color y talla resueltos.
 */
function formatDetail(detail) {
  const data = detail.get({ plain: true });
  return {
    id: data.id,
    venta_id: data.venta_id,
    producto_variante_id: data.producto_variante_id,
    cantidad: data.cantidad,
    precio_unitario: data.precio_unitario,
    producto: data.varianteInfo?.productoInfo?.nombre || null,
    color: data.varianteInfo?.color || null,
    talla: data.varianteInfo?.talla || null
  };
}

/**
 * GET /api/sales - Lista las ventas con cliente, usuario y tipo de pago, ordenadas por fecha descendente.
 *
 * @param {import('express').Request} _req - No utiliza datos de la peticion.
 * @param {import('express').Response} res - Responde 200 con el arreglo de ventas formateadas.
 * @returns {Promise<void>}
 */
salesRouter.get('/', asyncHandler(async (_req, res) => {
  const sales = await Venta.findAll({
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });
  res.json(sales.map(formatSale));
}));

/**
 * GET /api/sales/:id - Devuelve una venta con su lista de detalles de productos.
 *
 * @param {import('express').Request} req - req.params.id identifica la venta.
 * @param {import('express').Response} res - Responde 200 con la venta y su arreglo details, o 404 si la venta no existe.
 * @returns {Promise<void>}
 */
salesRouter.get('/:id', asyncHandler(async (req, res) => {
  const sale = await Venta.findByPk(req.params.id, {
    include: [
      { model: Cliente, as: 'clienteInfo', attributes: ['nombre'] },
      { model: Usuario, as: 'usuarioInfo', attributes: ['username'] },
      { model: TipoPago, as: 'tipoPagoInfo', attributes: ['nombre'] }
    ]
  });

  if (!sale) {
    res.status(404).json({ message: 'Venta no encontrada.' });
    return;
  }

  const details = await DetalleVenta.findAll({
    where: { venta_id: req.params.id },
    include: [{
      model: ProductoVariante,
      as: 'varianteInfo',
      attributes: ['color', 'talla'],
      include: [{ model: Producto, as: 'productoInfo', attributes: ['nombre'] }]
    }]
  });

  res.json({ ...formatSale(sale), details: details.map(formatDetail) });
}));

/**
 * POST /api/sales - Registra una venta, descuenta el inventario y guarda sus detalles.
 * Las ventas a credito requieren cliente; las ventas en USD requieren tasa de cambio configurada.
 * Toda la operacion (bloqueo y descuento de inventario, creacion de venta y detalles) se ejecuta en una transaccion.
 *
 * @param {import('express').Request} req - req.body con { cliente_id, cliente_nombre, tipo_pago_id, items, moneda }; req.user.id identifica al vendedor.
 * @param {import('express').Response} res - Responde 201 con el resumen de la venta o 400 si faltan items, falta cliente en credito, no hay tasa configurada, el cliente no existe o hay stock insuficiente.
 * @throws {Error} Error con .status 400 cuando el stock de alguna variante es insuficiente.
 * @returns {Promise<void>}
 */
salesRouter.post('/', asyncHandler(async (req, res) => {
  const { cliente_id, cliente_nombre, tipo_pago_id, items, moneda, num_cuotas, cuotas, enganche, pagos } = req.body;
  const usuario_id = req.user.id;
  // 'credito' genera un registro de deuda con plan de cuotas; cualquier otro valor es venta de contado.
  const tipoVenta = req.body.tipo_venta === 'credito' ? 'credito' : 'contado';

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'La venta necesita al menos un producto.' });
    return;
  }

  // Regla de negocio: una venta a credito genera deuda, por lo que debe quedar asociada a un
  // cliente registrado (los saldos pendientes se calculan por cliente). No se permite credito a
  // un cliente ocasional sin id.
  if (tipoVenta === 'credito' && !cliente_id) {
    res.status(400).json({ message: 'Las ventas a credito requieren un cliente registrado.' });
    return;
  }
  if (tipo_pago_id) {
    const tipoPago = await TipoPago.findByPk(tipo_pago_id);
    if (tipoPago?.es_credito && !cliente_id) {
      res.status(400).json({ message: 'Las ventas a credito requieren un cliente registrado.' });
      return;
    }
  }

  // Regla de negocio: la moneda base del negocio es NIO; cualquier valor distinto de 'USD' se
  // normaliza a NIO. Si la venta es en USD se guarda un snapshot de la tasa de cambio vigente
  // (tasa_cambio) para que el historico no cambie aunque luego se actualice la configuracion.
  const saleCurrency = moneda === 'USD' ? 'USD' : 'NIO';
  let tasaCambio = null;
  if (saleCurrency === 'USD') {
    const config = await Configuracion.findByPk(1);
    if (!config) {
      res.status(400).json({ message: 'Tasa de cambio no configurada.' });
      return;
    }
    tasaCambio = Number(config.tasa_cambio_usd);
  }

  // Regla de negocio: se guarda el nombre del cliente como snapshot en la venta (cliente_nombre).
  // Para un cliente registrado se copia su nombre actual; para uno ocasional se usa el texto libre.
  // Asi el recibo historico conserva el nombre aunque el cliente se renombre o elimine despues.
  let snapshotName = null;
  if (cliente_id) {
    const client = await Cliente.findByPk(cliente_id);
    if (!client) {
      res.status(400).json({ message: 'Cliente no encontrado.' });
      return;
    }
    snapshotName = client.nombre;
  } else if (typeof cliente_nombre === 'string' && cliente_nombre.trim()) {
    snapshotName = cliente_nombre.trim();
  }

  // El total se calcula en el servidor a partir de cantidad x precio_unitario de cada item;
  // no se confia en un total enviado por el cliente.
  const total = items.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.precio_unitario), 0);

  // Datos del plan de credito (deuda, enganche y cuotas). Se resuelven antes de la transaccion para
  // poder rechazar la venta con un 400 claro si el plan es inconsistente.
  let creditPlan = null;
  if (tipoVenta === 'credito') {
    const engancheMonto = Math.max(0, Number(enganche?.monto) || 0);
    if (engancheMonto > total) {
      res.status(400).json({ message: 'El enganche no puede ser mayor que el total de la venta.' });
      return;
    }

    // El enganche se cobra de contado, por lo que debe usar un tipo de pago que no sea de credito.
    let engancheTipoPagoId = null;
    if (engancheMonto > 0) {
      engancheTipoPagoId = Number(enganche?.tipo_pago_id) || null;
      const engancheTipo = engancheTipoPagoId ? await TipoPago.findByPk(engancheTipoPagoId) : null;
      if (!engancheTipo || engancheTipo.es_credito) {
        res.status(400).json({ message: 'El enganche necesita un tipo de pago de contado valido.' });
        return;
      }
    }

    // Monto a financiar = total - enganche. Es lo que se reparte en cuotas.
    const financiado = Number((total - engancheMonto).toFixed(2));
    const numCuotas = Math.max(1, Math.trunc(Number(num_cuotas) || (Array.isArray(cuotas) ? cuotas.length : 1)));

    // Si el cliente envia el plan de cuotas, debe sumar exactamente el monto financiado; de lo
    // contrario se reparte automaticamente en partes iguales.
    let plan;
    if (Array.isArray(cuotas) && cuotas.length > 0) {
      plan = cuotas.map((c, idx) => ({ numero: Number(c.numero) || idx + 1, monto: Number(c.monto) || 0 }));
      const suma = plan.reduce((acc, c) => acc + c.monto, 0);
      if (Math.abs(suma - financiado) > 0.01) {
        res.status(400).json({ message: 'La suma de las cuotas debe ser igual al monto financiado (total menos enganche).' });
        return;
      }
    } else {
      plan = splitInstallments(financiado, numCuotas);
    }

    if (financiado <= 0 && engancheMonto < total) {
      res.status(400).json({ message: 'El monto a financiar debe ser mayor que cero.' });
      return;
    }

    creditPlan = { engancheMonto, engancheTipoPagoId, numCuotas: plan.length, plan };
  }

  // Pagos de una venta de contado. Pueden ser mixtos (efectivo + tarjeta): cada linea indica su
  // tipo de pago y monto, y la suma debe cuadrar con el total. Para las lineas en efectivo se guarda
  // el efectivo recibido y el vuelto. Si no se envia ningun desglose, se asume un unico pago por el total.
  let paymentLines = null;
  if (tipoVenta === 'contado') {
    const provided = Array.isArray(pagos) ? pagos.filter((p) => Number(p?.monto) > 0) : [];
    if (provided.length > 0) {
      const sumaPagos = provided.reduce((acc, p) => acc + Number(p.monto), 0);
      if (Math.abs(sumaPagos - total) > 0.01) {
        res.status(400).json({ message: 'La suma de los pagos debe ser igual al total de la venta.' });
        return;
      }
      paymentLines = provided.map((p) => ({
        tipo_pago_id: Number(p.tipo_pago_id),
        monto: Number(p.monto),
        efectivo_recibido: p.efectivo_recibido != null ? Number(p.efectivo_recibido) : null,
        vuelto: p.vuelto != null ? Number(p.vuelto) : null
      }));
    } else if (tipo_pago_id) {
      paymentLines = [{ tipo_pago_id: Number(tipo_pago_id), monto: total, efectivo_recibido: null, vuelto: null }];
    }
  }

  // Regla de negocio: el descuento de inventario, la creacion de la venta y sus detalles ocurren
  // dentro de una unica transaccion. Si cualquier item falla (stock insuficiente), se revierte todo
  // y no queda una venta a medias.
  const sale = await sequelize.transaction(async (transaction) => {
    for (const item of items) {
      // lock: true aplica un bloqueo pesimista (SELECT ... FOR UPDATE) sobre la fila de inventario
      // para evitar sobreventa cuando dos ventas concurrentes tocan la misma variante.
      const inventory = await Inventario.findOne({
        where: { producto_variante_id: item.producto_variante_id },
        transaction,
        lock: true
      });

      // No se permite vender mas unidades de las que hay en existencia.
      if (!inventory || Number(inventory.cantidad) < Number(item.cantidad)) {
        const error = new Error('Stock insuficiente');
        error.status = 400;
        throw error;
      }

      await inventory.update({
        cantidad: Number(inventory.cantidad) - Number(item.cantidad)
      }, { transaction });
    }

    const createdSale = await Venta.create({
      cliente_id: cliente_id || null,
      cliente_nombre: snapshotName,
      usuario_id,
      tipo_pago_id,
      tipo_venta: tipoVenta,
      total,
      moneda: saleCurrency,
      tasa_cambio: tasaCambio
    }, { transaction });

    await DetalleVenta.bulkCreate(items.map((item) => ({
      venta_id: createdSale.id,
      producto_variante_id: item.producto_variante_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    })), { transaction, individualHooks: true });

    // Cada renglon vendido es una salida de inventario: queda asentado en el Kardex.
    await KardexMovimiento.bulkCreate(items.map((item) => ({
      producto_variante_id: item.producto_variante_id,
      tipo: 'salida',
      cantidad: item.cantidad,
      motivo: 'Venta',
      referencia_tipo: 'venta',
      referencia_id: createdSale.id,
      usuario_id
    })), { transaction });

    let createdDebt = null;
    if (creditPlan) {
      // La deuda registra el monto total de la venta; el enganche se asienta como un abono inicial,
      // de modo que el saldo pendiente (monto_total - abonos) arranca igual al monto financiado.
      createdDebt = await Deuda.create({
        venta_id: createdSale.id,
        cliente_id,
        monto_total: total,
        moneda: saleCurrency,
        tasa_cambio: tasaCambio,
        num_cuotas: creditPlan.numCuotas,
        estado: 'pendiente'
      }, { transaction });

      await Cuota.bulkCreate(creditPlan.plan.map((c) => ({
        deuda_id: createdDebt.id,
        numero: c.numero,
        monto: c.monto
      })), { transaction });

      if (creditPlan.engancheMonto > 0) {
        await Abono.create({
          cliente_id,
          deuda_id: createdDebt.id,
          tipo_pago_id: creditPlan.engancheTipoPagoId,
          usuario_id,
          monto: creditPlan.engancheMonto,
          moneda: saleCurrency,
          tasa_cambio: tasaCambio,
          notas: 'Enganche inicial'
        }, { transaction });
      }
    }

    if (paymentLines && paymentLines.length > 0) {
      await VentaPago.bulkCreate(paymentLines.map((p) => ({
        venta_id: createdSale.id,
        tipo_pago_id: p.tipo_pago_id,
        monto: p.monto,
        moneda: saleCurrency,
        efectivo_recibido: p.efectivo_recibido,
        vuelto: p.vuelto
      })), { transaction });
    }

    return { sale: createdSale, debt: createdDebt };
  });

  sendCreated(res, {
    id: sale.sale.id,
    total,
    cliente_nombre: snapshotName,
    tipo_venta: tipoVenta,
    moneda: saleCurrency,
    tasa_cambio: tasaCambio,
    deuda_id: sale.debt?.id || null,
    enganche: creditPlan?.engancheMonto || 0,
    cuotas: creditPlan?.plan || null,
    fecha: sale.sale.fecha
  });
}));
