/**
 * @file Vista de nueva compra. Replica el buscador del POS: primero se elige el tipo de producto
 * (card de categoria), luego se afina por color/talla y se elige un proveedor que suministre ese tipo.
 * Soporta compra por pacas (se explotan en unidades al sumar inventario) y usa un unico selector de
 * cantidad en numeros enteros.
 */
import React, { useMemo, useState } from 'react';
import { ChevronLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

/**
 * Vista de nueva compra con flujo tipo POS (categoria -> filtros -> proveedor -> carrito).
 *
 * @param {Object} props
 * @param {Array<Object>} props.variants - Variantes de producto disponibles para comprar.
 * @param {Array<Object>} props.suppliers - Proveedores con sus productos vinculados.
 * @param {{ tasa_cambio_usd?: number }} props.config - Configuracion del negocio (tasa de cambio USD).
 * @param {() => void} props.reload - Recarga los datos tras registrar la compra.
 * @returns {JSX.Element}
 */
export function Purchases({ variants, suppliers, config, reload }) {
  const [categoryKey, setCategoryKey] = useState(null);
  const [subcatFilter, setSubcatFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [tallaFilter, setTallaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [moneda, setMoneda] = useState('NIO');
  const [notas, setNotas] = useState('');
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const rate = Number(config?.tasa_cambio_usd || DEFAULT_RATE);

  // Mapa producto_id -> categoria_id, derivado de las variantes (que ya traen su categoria).
  const productCategoria = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => { if (!map.has(v.producto_id)) map.set(v.producto_id, v.categoria_id); });
    return map;
  }, [variants]);

  // Categorias disponibles (cards).
  const categories = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => {
      const key = v.categoria_id != null ? String(v.categoria_id) : 'none';
      if (!map.has(key)) map.set(key, { key, nombre: v.categoria || 'Sin categoria', count: 0 });
      map.get(key).count += 1;
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [variants]);

  // Proveedores que suministran productos de la categoria seleccionada.
  const suppliersForCategory = useMemo(() => {
    if (categoryKey === null) return suppliers;
    return suppliers.filter((s) => (s.productos || []).some((p) => {
      const c = productCategoria.get(p.id);
      return (c != null ? String(c) : 'none') === categoryKey;
    }));
  }, [suppliers, categoryKey, productCategoria]);

  const supplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(proveedorId)) || null,
    [suppliers, proveedorId]
  );
  const supplierProductIds = useMemo(
    () => (supplier ? new Set((supplier.productos || []).map((p) => p.id)) : null),
    [supplier]
  );
  const supplierCostByProduct = useMemo(() => {
    const map = new Map();
    (supplier?.productos || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [supplier]);

  // Variantes de la categoria activa (antes de filtros finos).
  const categoryVariants = useMemo(() => {
    if (categoryKey === null) return [];
    return variants.filter((v) => (v.categoria_id != null ? String(v.categoria_id) : 'none') === categoryKey);
  }, [variants, categoryKey]);

  const subcatOptions = useMemo(() => {
    const map = new Map();
    categoryVariants.forEach((v) => {
      if (v.subcategoria_id != null && !map.has(v.subcategoria_id)) map.set(v.subcategoria_id, v.subcategoria || `#${v.subcategoria_id}`);
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [categoryVariants]);
  const colorOptions = useMemo(() => [...new Set(categoryVariants.map((v) => v.color).filter(Boolean))].sort(), [categoryVariants]);
  const tallaOptions = useMemo(() => [...new Set(categoryVariants.map((v) => v.talla).filter(Boolean))].sort(), [categoryVariants]);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categoryVariants.filter((v) => {
      if (supplierProductIds && !supplierProductIds.has(v.producto_id)) return false;
      if (subcatFilter && String(v.subcategoria_id) !== subcatFilter) return false;
      if (colorFilter && v.color !== colorFilter) return false;
      if (tallaFilter && v.talla !== tallaFilter) return false;
      if (!q) return true;
      return `${v.producto || ''} ${v.color || ''} ${v.talla || ''}`.toLowerCase().includes(q);
    });
  }, [categoryVariants, supplierProductIds, subcatFilter, colorFilter, tallaFilter, search]);

  /**
   * Selecciona una categoria y reinicia filtros.
   *
   * @param {string} key - Clave de la categoria.
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
   * Regresa a la vista de cards de categoria.
   *
   * @returns {void}
   */
  function closeCategory() {
    setCategoryKey(null);
  }

  /**
   * Costo de referencia de la variante segun el proveedor, convertido a la moneda activa.
   *
   * @param {Object} variant - Variante de producto.
   * @returns {number} Costo de referencia.
   */
  function defaultCostFor(variant) {
    const link = supplierCostByProduct.get(variant.producto_id);
    if (!link || link.costo == null) return 0;
    if (link.moneda_costo === moneda) return Number(link.costo);
    if (link.moneda_costo === 'USD' && moneda === 'NIO') return Number(link.costo) * rate;
    if (link.moneda_costo === 'NIO' && moneda === 'USD') return Number(link.costo) / rate;
    return Number(link.costo);
  }

  /**
   * Agrega una variante al carrito de compra.
   *
   * @param {Object} variant - Variante a agregar.
   * @returns {void}
   */
  function addToCart(variant) {
    setCart((current) => {
      if (current.some((item) => item.producto_variante_id === variant.id)) return current;
      return [...current, {
        producto_variante_id: variant.id,
        producto: variant.producto,
        color: variant.color,
        talla: variant.talla,
        unidad: 'unidad',
        piezas_por_paca: '',
        cantidad: 1,
        costo_unitario: defaultCostFor(variant)
      }];
    });
  }

  /**
   * Cambia la cantidad de una linea en numeros enteros (un unico selector de cantidad).
   *
   * @param {number} variantId - Variante en el carrito.
   * @param {number} delta - Variacion entera (+1 / -1).
   * @returns {void}
   */
  function changeQty(variantId, delta) {
    setCart((current) => current
      .map((item) => {
        if (item.producto_variante_id !== variantId) return item;
        const next = Math.trunc(item.cantidad) + delta;
        if (next <= 0) return null;
        return { ...item, cantidad: next };
      })
      .filter(Boolean));
  }

  /**
   * Actualiza un campo arbitrario de una linea del carrito.
   *
   * @param {number} variantId - Variante en el carrito.
   * @param {Object} patch - Campos a fusionar.
   * @returns {void}
   */
  function updateLine(variantId, patch) {
    setCart((current) => current.map((item) => (item.producto_variante_id === variantId ? { ...item, ...patch } : item)));
  }

  /**
   * Quita una linea del carrito.
   *
   * @param {number} variantId - Variante a quitar.
   * @returns {void}
   */
  function removeFromCart(variantId) {
    setCart((current) => current.filter((item) => item.producto_variante_id !== variantId));
  }

  // El costo capturado es por unidad de compra (por paca si es paca). El total suma cantidad x costo.
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.costo_unitario || 0), 0),
    [cart]
  );

  /**
   * Restablece el carrito y campos auxiliares tras registrar una compra.
   *
   * @returns {void}
   */
  function resetForm() {
    setCart([]);
    setNotas('');
    setSearch('');
  }

  /**
   * Valida y envia la compra. Las pacas se explotan en unidades: se envia cantidad en unidades y el
   * costo unitario por pieza, de modo que el total e inventario queden en unidades vendibles.
   *
   * @param {Event} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
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

    const items = cart.map((item) => {
      const esPaca = item.unidad === 'paca';
      const piezas = esPaca ? Math.max(1, Math.trunc(Number(item.piezas_por_paca) || 1)) : 1;
      const unidades = Math.trunc(item.cantidad) * piezas;
      const costoPorUnidad = esPaca ? Number(item.costo_unitario || 0) / piezas : Number(item.costo_unitario || 0);
      return {
        producto_variante_id: item.producto_variante_id,
        cantidad: unidades,
        costo_unitario: Number(costoPorUnidad.toFixed(2))
      };
    });

    const payload = { proveedor_id: Number(proveedorId), moneda, notas, items };

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
          <h2>{categoryKey === null ? 'Tipos de producto' : 'Variantes disponibles'}</h2>
        </div>

        {categoryKey === null ? (
          <div className="pos-category-grid">
            {categories.map((cat) => (
              <button type="button" key={cat.key} className="pos-category-card" onClick={() => openCategory(cat.key)}>
                <strong>{cat.nombre}</strong>
                <small>{cat.count} variante(s)</small>
              </button>
            ))}
            {categories.length === 0 && <p className="pos-empty">No hay productos registrados.</p>}
          </div>
        ) : (
          <>
            <div className="row-between pos-category-bar">
              <button type="button" className="ghost" onClick={closeCategory}>
                <ChevronLeft size={14} />
                <span>Tipos</span>
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
            {!supplier && <p className="muted small">Selecciona un proveedor para ver sus costos de referencia.</p>}

            <div className="pos-variant-list">
              {filteredVariants.map((variant) => {
                const defaultCost = defaultCostFor(variant);
                return (
                  <button type="button" key={variant.id} className="pos-variant" onClick={() => addToCart(variant)}>
                    <div className="pos-variant-main">
                      <strong>{variant.producto}</strong>
                      <span>{[variant.color, variant.talla].filter(Boolean).join(' / ') || '—'}</span>
                    </div>
                    <div className="pos-variant-meta">
                      <span>{defaultCost > 0 ? `Costo ref: ${fmt(defaultCost, moneda)}` : 'Capturar costo'}</span>
                      <small>Stock: {variant.cantidad}</small>
                    </div>
                  </button>
                );
              })}
              {filteredVariants.length === 0 && <p className="pos-empty">No hay variantes que coincidan.</p>}
            </div>
          </>
        )}
      </div>

      <form className="panel pos-cart" onSubmit={submit}>
        <div className="panel-title">
          <ShoppingBag size={20} />
          <h2>Nueva compra</h2>
        </div>

        <Field label="Proveedor">
          <select required value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setCart([]); }}>
            <option value="">Seleccionar</option>
            {suppliersForCategory.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>
        {categoryKey !== null && suppliersForCategory.length === 0 && (
          <p className="muted small">Ningun proveedor suministra esta categoria. Vincula productos en Proveedores.</p>
        )}

        <div className="pos-toggle pos-currency">
          <button type="button" className={moneda === 'NIO' ? 'is-active' : ''} onClick={() => setMoneda('NIO')}>Cordobas (NIO)</button>
          <button type="button" className={moneda === 'USD' ? 'is-active' : ''} onClick={() => setMoneda('USD')}>Dolares (USD)</button>
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 && <p className="pos-empty">Agrega variantes desde la lista.</p>}
          {cart.map((item) => {
            const esPaca = item.unidad === 'paca';
            return (
              <div className="pos-cart-row" key={item.producto_variante_id}>
                <div className="pos-cart-info">
                  <strong>{item.producto}</strong>
                  <span>{[item.color, item.talla].filter(Boolean).join(' / ') || '—'}</span>
                  <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                    <select value={item.unidad} onChange={(e) => updateLine(item.producto_variante_id, { unidad: e.target.value })}>
                      <option value="unidad">Unidad</option>
                      <option value="paca">Paca</option>
                    </select>
                    {esPaca && (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Piezas/paca"
                        value={item.piezas_por_paca}
                        onChange={(e) => updateLine(item.producto_variante_id, { piezas_por_paca: e.target.value })}
                        style={{ maxWidth: '110px' }}
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.costo_unitario}
                    onChange={(e) => updateLine(item.producto_variante_id, { costo_unitario: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder={esPaca ? 'Costo por paca' : 'Costo unitario'}
                  />
                </div>
                <div className="pos-qty">
                  <button type="button" onClick={() => changeQty(item.producto_variante_id, -1)} aria-label="Restar"><Minus size={14} /></button>
                  <span>{item.cantidad}</span>
                  <button type="button" onClick={() => changeQty(item.producto_variante_id, 1)} aria-label="Sumar"><Plus size={14} /></button>
                </div>
                <div className="pos-cart-total">
                  <strong>{fmt(item.cantidad * Number(item.costo_unitario || 0), moneda)}</strong>
                  <button type="button" className="pos-remove" onClick={() => removeFromCart(item.producto_variante_id)} aria-label="Quitar"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
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
