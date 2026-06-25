/** @file Vista de punto de venta (POS) para armar el carrito, seleccionar cliente y tipo de pago, cobrar e imprimir el recibo. */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Minus, Plus, Printer, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt, priceFor } from '../utils/format.js';
import { printReceipt } from '../utils/receipt.js';
import { DEFAULT_RATE } from '../constants.js';

/**
 * Desglosa un monto de vuelto en billetes y monedas usando un algoritmo voraz (greedy) sobre las
 * denominaciones disponibles, de mayor a menor. 'restante' es lo que no se pudo cubrir con las
 * denominaciones dadas (por ejemplo, centavos por debajo de la moneda mas pequena).
 *
 * @param {number} amount - Monto del vuelto a desglosar.
 * @param {Array<{ valor: number|string, tipo: string }>} denoms - Denominaciones disponibles.
 * @returns {{ lines: Array<{ valor: number, tipo: string, cantidad: number }>, restante: number }}
 */
function breakdownChange(amount, denoms) {
  let cents = Math.round((Number(amount) || 0) * 100);
  const sorted = [...denoms].sort((a, b) => Number(b.valor) - Number(a.valor));
  const lines = [];
  for (const d of sorted) {
    const v = Math.round(Number(d.valor) * 100);
    if (v <= 0 || cents < v) continue;
    // 'disponible' limita la cantidad segun la apertura de caja; si es null/undefined no hay limite.
    const max = d.disponible == null ? Infinity : Math.max(0, Math.trunc(d.disponible));
    const cantidad = Math.min(Math.floor(cents / v), max);
    if (cantidad <= 0) continue;
    lines.push({ valor: Number(d.valor), tipo: d.tipo, cantidad });
    cents -= cantidad * v;
  }
  return { lines, restante: Number((cents / 100).toFixed(2)) };
}

/**
 * Vista de punto de venta que permite buscar variantes de producto, agregarlas a un
 * carrito, elegir moneda (NIO o USD), seleccionar cliente ocasional o registrado,
 * definir el tipo de pago y finalizar la venta imprimiendo el recibo.
 *
 * @param {Object} props
 * @param {Array<Object>} props.variants - Variantes de producto disponibles con precio y stock.
 * @param {Array<Object>} props.customers - Clientes registrados para asociar a la venta.
 * @param {{ tiposPago: Array<{ id: number, nombre: string, es_credito: boolean }> }} props.lookups - Catalogos auxiliares, incluye los tipos de pago.
 * @param {{ tasa_cambio_usd: number }} props.config - Configuracion del sistema, aporta la tasa de cambio USD.
 * @param {{ username: string, rol: string }} props.user - Usuario en sesion (cajero que realiza la venta).
 * @param {Function} props.reload - Funcion que recarga los datos tras concretar la venta.
 * @returns {JSX.Element}
 */
export function POS({ variants, customers, lookups, config, caja, user, reload }) {
  const [search, setSearch] = useState('');
  // Navegacion del buscador visual: primero se elige una categoria (card) y luego se afina por
  // subcategoria, color y talla. categoryKey null = mostrando las cards de categoria.
  const [categoryKey, setCategoryKey] = useState(null);
  const [subcatFilter, setSubcatFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [tallaFilter, setTallaFilter] = useState('');
  const [cart, setCart] = useState([]);
  const [customerMode, setCustomerMode] = useState('walkin');
  const [clienteId, setClienteId] = useState('');
  const [walkinName, setWalkinName] = useState('');
  // Tipo de venta: primer paso del flujo de pago. 'credito' habilita el plan de cuotas + enganche.
  const [tipoVenta, setTipoVenta] = useState('contado');
  const [engancheMonto, setEngancheMonto] = useState('');
  const [engancheTipoPagoId, setEngancheTipoPagoId] = useState('');
  const [numCuotas, setNumCuotas] = useState('1');
  const [cuotasPlan, setCuotasPlan] = useState([]);
  // Pago de contado (admite pago mixto): monto en efectivo + un segundo metodo (tarjeta/transferencia).
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoOtroTipoId, setPagoOtroTipoId] = useState('');
  const [pagoOtroMonto, setPagoOtroMonto] = useState('');
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [moneda, setMoneda] = useState('NIO');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const rate = Number(config?.tasa_cambio_usd || DEFAULT_RATE);

  const variantById = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => map.set(v.id, v));
    return map;
  }, [variants]);

  // Solo se venden variantes en unidad; las pacas se "explotan" en unidades al comprarlas, no se
  // venden como tal en el POS.
  const sellableVariants = useMemo(
    () => variants.filter((v) => (v.unidad || 'unidad') !== 'paca'),
    [variants]
  );

  // Categorias disponibles (cards), generadas dinamicamente desde las variantes en existencia.
  const categories = useMemo(() => {
    const map = new Map();
    sellableVariants.forEach((v) => {
      const key = v.categoria_id != null ? String(v.categoria_id) : 'none';
      if (!map.has(key)) {
        map.set(key, { key, nombre: v.categoria || 'Sin categoria', count: 0 });
      }
      map.get(key).count += 1;
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [sellableVariants]);

  // Variantes de la categoria seleccionada (antes de aplicar subcategoria/color/talla/busqueda).
  const categoryVariants = useMemo(() => {
    if (categoryKey === null) return [];
    return sellableVariants.filter(
      (v) => (v.categoria_id != null ? String(v.categoria_id) : 'none') === categoryKey
    );
  }, [sellableVariants, categoryKey]);

  // Opciones de los filtros, derivadas de las variantes de la categoria activa.
  const subcatOptions = useMemo(() => {
    const map = new Map();
    categoryVariants.forEach((v) => {
      if (v.subcategoria_id != null && !map.has(v.subcategoria_id)) {
        map.set(v.subcategoria_id, v.subcategoria || `#${v.subcategoria_id}`);
      }
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [categoryVariants]);

  const colorOptions = useMemo(
    () => [...new Set(categoryVariants.map((v) => v.color).filter(Boolean))].sort(),
    [categoryVariants]
  );
  const tallaOptions = useMemo(
    () => [...new Set(categoryVariants.map((v) => v.talla).filter(Boolean))].sort(),
    [categoryVariants]
  );

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categoryVariants.filter((v) => {
      if (subcatFilter && String(v.subcategoria_id) !== subcatFilter) return false;
      if (colorFilter && v.color !== colorFilter) return false;
      if (tallaFilter && v.talla !== tallaFilter) return false;
      if (!q) return true;
      const blob = `${v.producto || ''} ${v.color || ''} ${v.talla || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [categoryVariants, search, subcatFilter, colorFilter, tallaFilter]);

  /**
   * Selecciona una categoria y reinicia los filtros derivados (subcategoria, color, talla, busqueda).
   *
   * @param {string} key - Clave de la categoria (id como string, o 'none' para sin categoria).
   * @returns {void}
   */
  function openCategory(key) {
    setCategoryKey(key);
    setSubcatFilter('');
    setColorFilter('');
    setTallaFilter('');
    setSearch('');
  }

  /**
   * Regresa a la vista de cards de categoria y limpia los filtros activos.
   *
   * @returns {void}
   */
  function closeCategory() {
    setCategoryKey(null);
    setSubcatFilter('');
    setColorFilter('');
    setTallaFilter('');
    setSearch('');
  }

  const cartView = useMemo(() => cart
    .map((item) => {
      const variant = variantById.get(item.producto_variante_id);
      if (!variant) return null;
      const { value: unit, converted } = priceFor(variant, moneda, rate);
      return { ...item, precio_unitario: unit, converted };
    })
    .filter(Boolean), [cart, variantById, moneda, rate]);

  const totalDisplay = useMemo(
    () => cartView.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.precio_unitario), 0),
    [cartView]
  );

  const creditTypes = useMemo(
    () => (lookups?.tiposPago || []).filter((t) => t.es_credito),
    [lookups]
  );
  const contadoTypes = useMemo(
    () => (lookups?.tiposPago || []).filter((t) => !t.es_credito),
    [lookups]
  );
  const isRegistered = customerMode === 'registered';

  // Monto que se financia a credito = total - enganche. Es la base del plan de cuotas.
  const financiado = useMemo(
    () => Math.max(0, totalDisplay - (Number(engancheMonto) || 0)),
    [totalDisplay, engancheMonto]
  );

  // Regenera el plan de cuotas (reparto en partes iguales) cuando cambia el numero de cuotas, el
  // financiado o el tipo de venta. El usuario puede ajustar los montos manualmente despues.
  useEffect(() => {
    if (tipoVenta !== 'credito') return;
    const n = Math.max(1, Math.trunc(Number(numCuotas) || 1));
    const cents = Math.round(financiado * 100);
    const base = Math.floor(cents / n);
    const remainder = cents - base * n;
    setCuotasPlan(Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100));
  }, [tipoVenta, numCuotas, financiado]);

  const cuotasSum = useMemo(
    () => cuotasPlan.reduce((sum, m) => sum + (Number(m) || 0), 0),
    [cuotasPlan]
  );

  // El credito requiere cliente registrado; al volver a cliente ocasional se fuerza la venta de contado.
  useEffect(() => {
    if (!isRegistered && tipoVenta === 'credito') setTipoVenta('contado');
  }, [isRegistered, tipoVenta]);

  // Tipo de pago en efectivo (dispara el calculo de vuelto) y los demas medios de contado.
  const efectivoType = useMemo(
    () => contadoTypes.find((t) => /efectivo/i.test(t.nombre)) || null,
    [contadoTypes]
  );
  const otherContadoTypes = useMemo(
    () => contadoTypes.filter((t) => !efectivoType || t.id !== efectivoType.id),
    [contadoTypes, efectivoType]
  );

  const pagoEfectivoNum = Number(pagoEfectivo) || 0;
  const pagoOtroNum = Number(pagoOtroMonto) || 0;
  const pagosSum = Number((pagoEfectivoNum + pagoOtroNum).toFixed(2));

  // Vuelto = efectivo recibido - monto que se paga en efectivo (solo si hay pago en efectivo).
  const vuelto = useMemo(() => {
    if (pagoEfectivoNum <= 0) return 0;
    return Math.max(0, Number(((Number(efectivoRecibido) || 0) - pagoEfectivoNum).toFixed(2)));
  }, [pagoEfectivoNum, efectivoRecibido]);

  // Denominaciones base para el vuelto: si hay apertura de caja registrada, se usan sus existencias
  // (cantidad disponible por denominacion); si no, se cae al catalogo de denominaciones (sin limite).
  const changeDenoms = useMemo(() => {
    const detalles = caja?.apertura?.detalles;
    if (detalles && detalles.length > 0) {
      return detalles
        .filter((d) => (d.moneda || 'NIO') === moneda && d.valor != null)
        .map((d) => ({ valor: d.valor, tipo: d.tipo, disponible: d.cantidad }));
    }
    return (lookups?.denominaciones || [])
      .filter((d) => (d.moneda || 'NIO') === moneda)
      .map((d) => ({ valor: d.valor, tipo: d.tipo }));
  }, [caja, lookups, moneda]);

  const changeBreakdown = useMemo(() => breakdownChange(vuelto, changeDenoms), [vuelto, changeDenoms]);

  /**
   * Agrega una variante al carrito. Si ya existe incrementa su cantidad respetando
   * el stock disponible; ignora las variantes sin existencias.
   *
   * @param {Object} variant - Variante de producto seleccionada.
   * @returns {void}
   */
  function addToCart(variant) {
    if (Number(variant.cantidad) <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.producto_variante_id === variant.id);
      if (existing) {
        if (existing.cantidad >= Number(variant.cantidad)) return current;
        return current.map((item) =>
          item.producto_variante_id === variant.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...current, {
        producto_variante_id: variant.id,
        producto: variant.producto,
        color: variant.color,
        talla: variant.talla,
        stock: Number(variant.cantidad),
        cantidad: 1
      }];
    });
  }

  /**
   * Modifica la cantidad de un articulo del carrito. Elimina la linea si la cantidad
   * llega a cero o menos y no permite superar el stock disponible.
   *
   * @param {number} variantId - Identificador de la variante a modificar.
   * @param {number} delta - Cambio a aplicar a la cantidad (positivo o negativo).
   * @returns {void}
   */
  function changeQty(variantId, delta) {
    setCart((current) => current
      .map((item) => {
        if (item.producto_variante_id !== variantId) return item;
        const next = item.cantidad + delta;
        if (next <= 0) return null;
        if (next > item.stock) return item;
        return { ...item, cantidad: next };
      })
      .filter(Boolean)
    );
  }

  /**
   * Quita por completo una variante del carrito.
   *
   * @param {number} variantId - Identificador de la variante a quitar.
   * @returns {void}
   */
  function removeFromCart(variantId) {
    setCart((current) => current.filter((item) => item.producto_variante_id !== variantId));
  }

  /**
   * Reinicia el formulario de venta dejando el carrito vacio y los campos en su
   * valor por defecto.
   *
   * @returns {void}
   */
  function resetForm() {
    setCart([]);
    setClienteId('');
    setWalkinName('');
    setTipoVenta('contado');
    setEngancheMonto('');
    setEngancheTipoPagoId('');
    setNumCuotas('1');
    setCuotasPlan([]);
    setPagoEfectivo('');
    setPagoOtroTipoId('');
    setPagoOtroMonto('');
    setEfectivoRecibido('');
    closeCategory();
    setCustomerMode('walkin');
    setMoneda('NIO');
  }

  /**
   * Valida el carrito y los datos del cliente, envia la venta al servidor, imprime
   * el recibo y reinicia el formulario. Las ventas a credito exigen un cliente
   * registrado.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function checkout(event) {
    event.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }
    if (customerMode === 'registered' && !clienteId) {
      setError('Selecciona un cliente registrado o cambia a cliente ocasional.');
      return;
    }

    // El tipo de pago efectivo depende del tipo de venta: contado usa el tipo elegido; credito usa
    // el tipo de pago de credito y exige un plan de cuotas valido.
    let effectiveTipoPagoId;
    let contadoPagos = null;
    if (tipoVenta === 'credito') {
      if (!isRegistered) {
        setError('Las ventas a credito requieren un cliente registrado.');
        return;
      }
      if (creditTypes.length === 0) {
        setError('No hay un tipo de pago de credito configurado.');
        return;
      }
      if (financiado <= 0) {
        setError('El monto a financiar debe ser mayor que cero. Reduce el enganche.');
        return;
      }
      if (Math.abs(cuotasSum - financiado) > 0.01) {
        setError('La suma de las cuotas debe igualar el monto a financiar.');
        return;
      }
      if ((Number(engancheMonto) || 0) > 0 && !engancheTipoPagoId) {
        setError('Selecciona el tipo de pago del enganche.');
        return;
      }
      effectiveTipoPagoId = creditTypes[0].id;
    } else {
      // Contado: pago mixto efectivo + otro medio. Las lineas deben sumar el total.
      if (pagosSum <= 0) {
        setError('Indica como se paga la venta.');
        return;
      }
      if (Math.abs(pagosSum - totalDisplay) > 0.01) {
        setError('Los montos de pago deben sumar el total a cobrar.');
        return;
      }
      if (pagoEfectivoNum > 0 && !efectivoType) {
        setError('No hay un tipo de pago "Efectivo" configurado.');
        return;
      }
      if (pagoOtroNum > 0 && !pagoOtroTipoId) {
        setError('Selecciona el tipo del segundo pago.');
        return;
      }
      if (pagoEfectivoNum > 0 && (Number(efectivoRecibido) || 0) < pagoEfectivoNum) {
        setError('El efectivo recibido no cubre el monto en efectivo.');
        return;
      }

      const pagosPayload = [];
      if (pagoEfectivoNum > 0) {
        pagosPayload.push({
          tipo_pago_id: efectivoType.id,
          monto: pagoEfectivoNum,
          efectivo_recibido: Number(efectivoRecibido) || pagoEfectivoNum,
          vuelto
        });
      }
      if (pagoOtroNum > 0) {
        pagosPayload.push({ tipo_pago_id: Number(pagoOtroTipoId), monto: pagoOtroNum });
      }
      contadoPagos = pagosPayload;
      effectiveTipoPagoId = pagosPayload[0].tipo_pago_id;
    }

    const customerForReceipt = customerMode === 'registered'
      ? customers.find((c) => String(c.id) === String(clienteId))?.nombre || null
      : (walkinName.trim() || null);

    const payload = {
      cliente_id: customerMode === 'registered' ? Number(clienteId) : null,
      cliente_nombre: customerMode === 'walkin' ? (walkinName.trim() || null) : null,
      tipo_pago_id: effectiveTipoPagoId,
      tipo_venta: tipoVenta,
      moneda,
      items: cartView.map((item) => ({
        producto_variante_id: item.producto_variante_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }))
    };

    if (tipoVenta === 'credito') {
      payload.num_cuotas = cuotasPlan.length;
      payload.cuotas = cuotasPlan.map((monto, i) => ({ numero: i + 1, monto: Number(monto) || 0 }));
      const eng = Number(engancheMonto) || 0;
      if (eng > 0) payload.enganche = { monto: eng, tipo_pago_id: Number(engancheTipoPagoId) };
    } else if (contadoPagos) {
      payload.pagos = contadoPagos;
    }

    setSubmitting(true);
    try {
      const result = await api.post('/sales', payload);
      const tipoPago = lookups?.tiposPago.find((t) => t.id === effectiveTipoPagoId)?.nombre || null;

      printReceipt({
        id: result.id,
        total: result.total ?? totalDisplay,
        moneda: result.moneda || moneda,
        tasa_cambio: result.tasa_cambio || rate,
        fecha: result.fecha || new Date().toISOString(),
        cajero: user.username,
        cliente: customerForReceipt,
        tipo_pago: tipoPago,
        items: cartView.map((item) => ({
          producto: item.producto,
          color: item.color,
          talla: item.talla,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }))
      });

      resetForm();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pos-grid">
      <div className="panel pos-products">
        <div className="panel-title">
          <ScanLine size={20} />
          <h2>{categoryKey === null ? 'Categorias' : 'Productos disponibles'}</h2>
        </div>
        <div className="pos-rate">
          Tasa: <strong>C${rate.toFixed(4)}</strong> = US$1
        </div>

        {categoryKey === null ? (
          <div className="pos-category-grid">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.key}
                className="pos-category-card"
                onClick={() => openCategory(cat.key)}
              >
                <strong>{cat.nombre}</strong>
                <small>{cat.count} variante(s)</small>
              </button>
            ))}
            {categories.length === 0 && (
              <p className="pos-empty">No hay productos registrados.</p>
            )}
          </div>
        ) : (
          <>
            <div className="row-between pos-category-bar">
              <button type="button" className="ghost" onClick={closeCategory}>
                <ChevronLeft size={14} />
                <span>Categorias</span>
              </button>
              <strong>{categories.find((c) => c.key === categoryKey)?.nombre || ''}</strong>
            </div>

            <div className="pos-filters">
              {subcatOptions.length > 0 && (
                <select value={subcatFilter} onChange={(e) => setSubcatFilter(e.target.value)}>
                  <option value="">Toda subcategoria</option>
                  {subcatOptions.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
              {colorOptions.length > 0 && (
                <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
                  <option value="">Todo color</option>
                  {colorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {tallaOptions.length > 0 && (
                <select value={tallaFilter} onChange={(e) => setTallaFilter(e.target.value)}>
                  <option value="">Toda talla</option>
                  {tallaOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            <input
              className="pos-search"
              placeholder="Buscar por nombre, color o talla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="pos-variant-list">
              {filteredVariants.map((variant) => {
                const outOfStock = Number(variant.cantidad) <= 0;
                const { value: priceDisplay, converted } = priceFor(variant, moneda, rate);
                const noPrice = variant.precio_base == null && variant.precio_usd == null;
                return (
                  <button
                    type="button"
                    key={variant.id}
                    className={`pos-variant${outOfStock ? ' pos-variant--off' : ''}`}
                    onClick={() => addToCart(variant)}
                    disabled={outOfStock || noPrice}
                    title={converted ? 'Precio convertido con la tasa actual' : ''}
                  >
                    <div className="pos-variant-main">
                      <strong>{variant.producto}</strong>
                      <span>{[variant.color, variant.talla].filter(Boolean).join(' / ') || '—'}</span>
                    </div>
                    <div className="pos-variant-meta">
                      <span>
                        {noPrice ? 'Sin precio' : fmt(priceDisplay, moneda)}
                        {converted && !noPrice && <em className="pos-converted">≈</em>}
                      </span>
                      <small>Stock: {variant.cantidad}</small>
                    </div>
                  </button>
                );
              })}
              {filteredVariants.length === 0 && (
                <p className="pos-empty">No hay productos que coincidan.</p>
              )}
            </div>
          </>
        )}
      </div>

      <form className="panel pos-cart" onSubmit={checkout}>
        <div className="panel-title">
          <ShoppingCart size={20} />
          <h2>Carrito</h2>
        </div>

        <div className="pos-toggle pos-currency">
          <button
            type="button"
            className={moneda === 'NIO' ? 'is-active' : ''}
            onClick={() => setMoneda('NIO')}
          >
            Cordobas (NIO)
          </button>
          <button
            type="button"
            className={moneda === 'USD' ? 'is-active' : ''}
            onClick={() => setMoneda('USD')}
          >
            Dolares (USD)
          </button>
        </div>

        <div className="pos-customer">
          <div className="pos-toggle">
            <button
              type="button"
              className={customerMode === 'walkin' ? 'is-active' : ''}
              onClick={() => setCustomerMode('walkin')}
            >
              Cliente ocasional
            </button>
            <button
              type="button"
              className={customerMode === 'registered' ? 'is-active' : ''}
              onClick={() => setCustomerMode('registered')}
            >
              Cliente registrado
            </button>
          </div>

          {customerMode === 'walkin' ? (
            <Field label="Nombre (opcional)">
              <input
                placeholder="Cliente ocasional"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Seleccionar</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div className="pos-cart-items">
          {cartView.length === 0 && <p className="pos-empty">Agrega productos desde la lista.</p>}
          {cartView.map((item) => (
            <div className="pos-cart-row" key={item.producto_variante_id}>
              <div className="pos-cart-info">
                <strong>{item.producto}</strong>
                <span>{[item.color, item.talla].filter(Boolean).join(' / ') || '—'}</span>
                <small>
                  {fmt(item.precio_unitario, moneda)} c/u
                  {item.converted && <em className="pos-converted"> · convertido</em>}
                </small>
              </div>
              <div className="pos-qty">
                <button type="button" onClick={() => changeQty(item.producto_variante_id, -1)} aria-label="Restar">
                  <Minus size={14} />
                </button>
                <span>{item.cantidad}</span>
                <button
                  type="button"
                  onClick={() => changeQty(item.producto_variante_id, 1)}
                  disabled={item.cantidad >= item.stock}
                  aria-label="Sumar"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="pos-cart-total">
                <strong>{fmt(item.cantidad * item.precio_unitario, moneda)}</strong>
                <button type="button" className="pos-remove" onClick={() => removeFromCart(item.producto_variante_id)} aria-label="Quitar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Paso 1 del flujo de pago: indicar si la venta es de contado o a credito. */}
        <div className="pos-toggle">
          <button
            type="button"
            className={tipoVenta === 'contado' ? 'is-active' : ''}
            onClick={() => setTipoVenta('contado')}
          >
            Contado
          </button>
          <button
            type="button"
            className={tipoVenta === 'credito' ? 'is-active' : ''}
            onClick={() => isRegistered && setTipoVenta('credito')}
            disabled={!isRegistered}
            title={!isRegistered ? 'El credito requiere un cliente registrado' : ''}
          >
            Credito
          </button>
        </div>
        {!isRegistered && (
          <p className="muted small">El credito solo esta disponible para clientes registrados.</p>
        )}

        {tipoVenta === 'contado' ? (
          <div className="pos-payment">
            <div className="row-between">
              <strong>Formas de pago</strong>
              <button
                type="button"
                className="ghost"
                onClick={() => { setPagoEfectivo(String(totalDisplay)); setPagoOtroMonto(''); }}
              >
                Todo en efectivo
              </button>
            </div>
            <div className="row">
              <Field label="Monto en efectivo">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagoEfectivo}
                  onChange={(e) => setPagoEfectivo(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Monto con otro medio">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagoOtroMonto}
                  onChange={(e) => setPagoOtroMonto(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            {pagoOtroNum > 0 && (
              <Field label="Tipo del otro pago">
                <select value={pagoOtroTipoId} onChange={(e) => setPagoOtroTipoId(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {otherContadoTypes.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </Field>
            )}
            <p className={`muted small${Math.abs(pagosSum - totalDisplay) > 0.01 ? ' is-debt' : ''}`}>
              Pagos: {fmt(pagosSum, moneda)} / Total: {fmt(totalDisplay, moneda)}
            </p>

            {pagoEfectivoNum > 0 && (
              <>
                <Field label="Efectivo recibido">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                {vuelto > 0 && (
                  <div className="pos-change">
                    <div className="row-between">
                      <strong>Vuelto</strong>
                      <strong>{fmt(vuelto, moneda)}</strong>
                    </div>
                    {changeBreakdown.lines.length > 0 ? (
                      <ul className="pos-change-list">
                        {changeBreakdown.lines.map((line) => (
                          <li key={`${line.tipo}-${line.valor}`}>
                            {line.cantidad} × {fmt(line.valor, moneda)} <small>({line.tipo})</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">Sin denominaciones para desglosar.</p>
                    )}
                    {changeBreakdown.restante > 0 && (
                      <p className="muted small is-debt">
                        No se pudo desglosar {fmt(changeBreakdown.restante, moneda)} con las denominaciones disponibles.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="pos-credit">
            <div className="row">
              <Field label="Enganche (opcional)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={engancheMonto}
                  onChange={(e) => setEngancheMonto(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              {(Number(engancheMonto) || 0) > 0 && (
                <Field label="Pago del enganche">
                  <select value={engancheTipoPagoId} onChange={(e) => setEngancheTipoPagoId(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {contadoTypes.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <Field label="Numero de cuotas">
              <input
                type="number"
                min="1"
                step="1"
                value={numCuotas}
                onChange={(e) => setNumCuotas(e.target.value)}
              />
            </Field>
            <div className="pos-credit-plan">
              <div className="row-between">
                <strong>Plan de pagos</strong>
                <small className="muted">A financiar: {fmt(financiado, moneda)}</small>
              </div>
              {cuotasPlan.map((monto, i) => (
                <div className="link-row" key={i}>
                  <span>Cuota {i + 1}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monto}
                    onChange={(e) => setCuotasPlan((cur) => cur.map((m, idx) => (idx === i ? e.target.value : m)))}
                  />
                </div>
              ))}
              <p className={`muted small${Math.abs(cuotasSum - financiado) > 0.01 ? ' is-debt' : ''}`}>
                Suma de cuotas: {fmt(cuotasSum, moneda)}
                {Math.abs(cuotasSum - financiado) > 0.01 ? ' — debe igualar lo financiado' : ''}
              </p>
            </div>
          </div>
        )}

        <div className="pos-total">
          <span>Total a cobrar</span>
          <strong>{fmt(totalDisplay, moneda)}</strong>
        </div>
        {totalDisplay > 0 && (
          <p className="muted small center">
            Equivalente: {moneda === 'USD'
              ? fmt(totalDisplay * rate, 'NIO')
              : fmt(totalDisplay / rate, 'USD')}
          </p>
        )}

        {error && <div className="alert">{error}</div>}

        <button type="submit" className="pos-checkout" disabled={submitting || cart.length === 0}>
          <Printer size={16} />
          <span>{submitting ? 'Procesando...' : 'Cobrar e imprimir recibo'}</span>
        </button>
      </form>
    </section>
  );
}
