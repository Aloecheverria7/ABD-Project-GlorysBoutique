import React, { useMemo, useState } from 'react';
import { Minus, Plus, Printer, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt, priceFor } from '../utils/format.js';
import { printReceipt } from '../utils/receipt.js';
import { DEFAULT_RATE } from '../constants.js';

export function POS({ variants, customers, lookups, config, user, reload }) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customerMode, setCustomerMode] = useState('walkin');
  const [clienteId, setClienteId] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [tipoPagoId, setTipoPagoId] = useState('');
  const [moneda, setMoneda] = useState('NIO');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const rate = Number(config?.tasa_cambio_usd || DEFAULT_RATE);

  const variantById = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => map.set(v.id, v));
    return map;
  }, [variants]);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) => {
      const blob = `${v.producto || ''} ${v.color || ''} ${v.talla || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [variants, search]);

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

  function removeFromCart(variantId) {
    setCart((current) => current.filter((item) => item.producto_variante_id !== variantId));
  }

  function resetForm() {
    setCart([]);
    setClienteId('');
    setWalkinName('');
    setTipoPagoId('');
    setSearch('');
    setCustomerMode('walkin');
    setMoneda('NIO');
  }

  async function checkout(event) {
    event.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }
    if (!tipoPagoId) {
      setError('Selecciona el tipo de pago.');
      return;
    }
    if (customerMode === 'registered' && !clienteId) {
      setError('Selecciona un cliente registrado o cambia a cliente ocasional.');
      return;
    }

    const selectedPago = (lookups?.tiposPago || []).find((t) => String(t.id) === String(tipoPagoId));
    if (selectedPago?.es_credito && customerMode !== 'registered') {
      setError('Las ventas a credito requieren un cliente registrado.');
      return;
    }

    const customerForReceipt = customerMode === 'registered'
      ? customers.find((c) => String(c.id) === String(clienteId))?.nombre || null
      : (walkinName.trim() || null);

    const payload = {
      cliente_id: customerMode === 'registered' ? Number(clienteId) : null,
      cliente_nombre: customerMode === 'walkin' ? (walkinName.trim() || null) : null,
      tipo_pago_id: Number(tipoPagoId),
      moneda,
      items: cartView.map((item) => ({
        producto_variante_id: item.producto_variante_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }))
    };

    setSubmitting(true);
    try {
      const result = await api.post('/sales', payload);
      const tipoPago = lookups?.tiposPago.find((t) => String(t.id) === String(tipoPagoId))?.nombre || null;

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
          <h2>Productos disponibles</h2>
        </div>
        <div className="pos-rate">
          Tasa: <strong>C${rate.toFixed(4)}</strong> = US$1
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

        <Field label="Tipo de pago">
          <select required value={tipoPagoId} onChange={(e) => setTipoPagoId(e.target.value)}>
            <option value="">Seleccionar</option>
            {lookups?.tiposPago.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={t.es_credito && customerMode !== 'registered'}
              >
                {t.nombre}{t.es_credito ? ' (fiado)' : ''}
              </option>
            ))}
          </select>
        </Field>

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
