import React, { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

export function Purchases({ variants, suppliers, config, reload }) {
  const [proveedorId, setProveedorId] = useState('');
  const [moneda, setMoneda] = useState('NIO');
  const [notas, setNotas] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const rate = Number(config?.tasa_cambio_usd || DEFAULT_RATE);

  const supplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(proveedorId)) || null,
    [suppliers, proveedorId]
  );

  const supplierProductIds = useMemo(() => {
    if (!supplier) return null;
    return new Set((supplier.productos || []).map((p) => p.id));
  }, [supplier]);

  const supplierCostByProduct = useMemo(() => {
    if (!supplier) return new Map();
    const map = new Map();
    (supplier.productos || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [supplier]);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants.filter((v) => {
      if (supplierProductIds && !supplierProductIds.has(v.producto_id)) return false;
      if (!q) return true;
      const blob = `${v.producto || ''} ${v.color || ''} ${v.talla || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [variants, search, supplierProductIds]);

  function defaultCostFor(variant) {
    const link = supplierCostByProduct.get(variant.producto_id);
    if (!link || link.costo == null) return 0;
    if (link.moneda_costo === moneda) return Number(link.costo);
    if (link.moneda_costo === 'USD' && moneda === 'NIO') return Number(link.costo) * rate;
    if (link.moneda_costo === 'NIO' && moneda === 'USD') return Number(link.costo) / rate;
    return Number(link.costo);
  }

  function addToCart(variant) {
    setCart((current) => {
      const existing = current.find((item) => item.producto_variante_id === variant.id);
      if (existing) {
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
        cantidad: 1,
        costo_unitario: defaultCostFor(variant)
      }];
    });
  }

  function changeQty(variantId, delta) {
    setCart((current) => current
      .map((item) => {
        if (item.producto_variante_id !== variantId) return item;
        const next = item.cantidad + delta;
        if (next <= 0) return null;
        return { ...item, cantidad: next };
      })
      .filter(Boolean)
    );
  }

  function setUnitCost(variantId, value) {
    setCart((current) => current.map((item) =>
      item.producto_variante_id === variantId
        ? { ...item, costo_unitario: value === '' ? 0 : Number(value) }
        : item
    ));
  }

  function removeFromCart(variantId) {
    setCart((current) => current.filter((item) => item.producto_variante_id !== variantId));
  }

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.costo_unitario || 0), 0),
    [cart]
  );

  function resetForm() {
    setCart([]);
    setNotas('');
    setSearch('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!proveedorId) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (cart.length === 0) {
      setError('Agrega al menos un producto.');
      return;
    }

    const payload = {
      proveedor_id: Number(proveedorId),
      moneda,
      notas,
      items: cart.map((item) => ({
        producto_variante_id: item.producto_variante_id,
        cantidad: item.cantidad,
        costo_unitario: Number(item.costo_unitario || 0)
      }))
    };

    setSubmitting(true);
    try {
      const result = await api.post('/purchases', payload);
      setMessage(`Compra #${result.id} registrada. Inventario actualizado.`);
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
          <ShoppingBag size={20} />
          <h2>Variantes disponibles</h2>
        </div>
        <p className="muted small">
          {supplier
            ? `Mostrando productos asignados a ${supplier.nombre}.`
            : 'Selecciona un proveedor para filtrar sus productos.'}
        </p>
        <input
          className="pos-search"
          placeholder="Buscar por nombre, color o talla..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="pos-variant-list">
          {filteredVariants.map((variant) => {
            const defaultCost = defaultCostFor(variant);
            return (
              <button
                type="button"
                key={variant.id}
                className="pos-variant"
                onClick={() => addToCart(variant)}
              >
                <div className="pos-variant-main">
                  <strong>{variant.producto}</strong>
                  <span>{[variant.color, variant.talla].filter(Boolean).join(' / ') || '—'}</span>
                </div>
                <div className="pos-variant-meta">
                  <span>{defaultCost > 0 ? `Costo ref: ${fmt(defaultCost, moneda)}` : 'Capturar costo'}</span>
                  <small>Stock actual: {variant.cantidad}</small>
                </div>
              </button>
            );
          })}
          {filteredVariants.length === 0 && (
            <p className="pos-empty">
              {supplier
                ? 'Este proveedor no tiene productos asignados. Vincula productos desde Proveedores.'
                : 'No hay variantes que coincidan.'}
            </p>
          )}
        </div>
      </div>

      <form className="panel pos-cart" onSubmit={submit}>
        <div className="panel-title">
          <ShoppingBag size={20} />
          <h2>Nueva compra</h2>
        </div>

        <Field label="Proveedor">
          <select required value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setCart([]); }}>
            <option value="">Seleccionar</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>

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

        <div className="pos-cart-items">
          {cart.length === 0 && <p className="pos-empty">Agrega variantes desde la lista.</p>}
          {cart.map((item) => (
            <div className="pos-cart-row" key={item.producto_variante_id}>
              <div className="pos-cart-info">
                <strong>{item.producto}</strong>
                <span>{[item.color, item.talla].filter(Boolean).join(' / ') || '—'}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costo_unitario}
                  onChange={(e) => setUnitCost(item.producto_variante_id, e.target.value)}
                  placeholder="Costo unitario"
                />
              </div>
              <div className="pos-qty">
                <button type="button" onClick={() => changeQty(item.producto_variante_id, -1)} aria-label="Restar">
                  <Minus size={14} />
                </button>
                <span>{item.cantidad}</span>
                <button type="button" onClick={() => changeQty(item.producto_variante_id, 1)} aria-label="Sumar">
                  <Plus size={14} />
                </button>
              </div>
              <div className="pos-cart-total">
                <strong>{fmt(item.cantidad * Number(item.costo_unitario || 0), moneda)}</strong>
                <button type="button" className="pos-remove" onClick={() => removeFromCart(item.producto_variante_id)} aria-label="Quitar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Field label="Notas (opcional)">
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Numero de factura, comentarios..." />
        </Field>

        <div className="pos-total">
          <span>Total compra</span>
          <strong>{fmt(total, moneda)}</strong>
        </div>
        {total > 0 && (
          <p className="muted small center">
            Equivalente: {moneda === 'USD' ? fmt(total * rate, 'NIO') : fmt(total / rate, 'USD')}
          </p>
        )}

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <button type="submit" className="pos-checkout" disabled={submitting || cart.length === 0}>
          {submitting ? 'Registrando...' : 'Registrar compra y sumar inventario'}
        </button>
      </form>
    </section>
  );
}
