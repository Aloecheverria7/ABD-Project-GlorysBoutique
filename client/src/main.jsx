import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  Users
} from 'lucide-react';
import { api, auth } from './api.js';
import './styles.css';

const DEFAULT_RATE = 36.62;

const formatters = {
  NIO: new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
};

function fmt(amount, currency = 'NIO') {
  const value = Number(amount || 0);
  return (formatters[currency] || formatters.NIO).format(value);
}

function convertFromNIO(amountNIO, currency, rate) {
  const value = Number(amountNIO || 0);
  if (currency === 'USD') return value / Number(rate || DEFAULT_RATE);
  return value;
}

function convertToNIO(amount, currency, rate) {
  const value = Number(amount || 0);
  if (currency === 'USD') return value * Number(rate || DEFAULT_RATE);
  return value;
}

const MENU = [
  {
    label: 'General',
    items: [
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'vendedor'] },
      { id: 'config', label: 'Configuracion', icon: Settings, roles: ['admin'] }
    ]
  },
  {
    label: 'Catalogo',
    items: [
      { id: 'products', label: 'Productos', icon: PackagePlus, roles: ['admin'] },
      { id: 'inventory', label: 'Inventario', icon: Boxes, roles: ['admin'] }
    ]
  },
  {
    label: 'Comercial',
    items: [
      { id: 'pos', label: 'Punto de venta', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
      { id: 'customers', label: 'Clientes', icon: Users, roles: ['admin', 'vendedor'] },
      { id: 'sales', label: 'Historial de ventas', icon: CreditCard, roles: ['admin', 'vendedor'] }
    ]
  }
];

const VIEW_TITLES = {
  dashboard: 'Inicio',
  config: 'Configuracion',
  products: 'Productos',
  inventory: 'Inventario',
  pos: 'Punto de venta',
  customers: 'Clientes',
  sales: 'Historial de ventas'
};

function visibleMenu(rol) {
  return MENU
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(rol))
    }))
    .filter((group) => group.items.length > 0);
}

function canAccess(viewId, rol) {
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.id === viewId) return item.roles.includes(rol);
    }
  }
  return false;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptHTML(sale) {
  const moneda = sale.moneda || 'NIO';
  const rate = Number(sale.tasa_cambio || DEFAULT_RATE);
  const totalDisplay = Number(sale.total);
  const altCurrency = moneda === 'USD' ? 'NIO' : 'USD';
  const totalAlt = moneda === 'USD' ? totalDisplay * rate : totalDisplay / rate;

  const itemsHTML = sale.items.map((item) => {
    const unit = Number(item.precio_unitario);
    const subtotal = Number(item.cantidad) * unit;
    const variantInfo = [item.color, item.talla].filter(Boolean).join(' / ');
    return `
      <tr>
        <td>
          ${escapeHTML(item.producto)}
          ${variantInfo ? `<div class="muted">${escapeHTML(variantInfo)}</div>` : ''}
        </td>
        <td class="num">${item.cantidad}</td>
        <td class="num">${fmt(unit, moneda)}</td>
        <td class="num">${fmt(subtotal, moneda)}</td>
      </tr>
    `;
  }).join('');

  const fecha = sale.fecha ? new Date(sale.fecha).toLocaleString() : new Date().toLocaleString();
  const equivalencia = `Equivalente: ${fmt(totalAlt, altCurrency)} (Tasa C$${rate.toFixed(4)} = US$1)`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo #${sale.id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px;
    margin: 0;
    padding: 6px 8px;
    width: 80mm;
    color: #000;
  }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  .muted { color: #444; font-size: 10px; }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { font-size: 11px; padding: 1px 0; text-align: left; vertical-align: top; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  .total { font-size: 14px; font-weight: bold; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>Glory's Boutique</h1>
  <p class="center muted">Recibo de venta</p>
  <div class="line"></div>
  <div class="row"><span>Folio:</span><strong>#${sale.id}</strong></div>
  <div class="row"><span>Fecha:</span><span>${escapeHTML(fecha)}</span></div>
  <div class="row"><span>Cajero:</span><span>${escapeHTML(sale.cajero || '-')}</span></div>
  <div class="row"><span>Cliente:</span><span>${escapeHTML(sale.cliente || 'Cliente ocasional')}</span></div>
  <div class="row"><span>Moneda:</span><span>${escapeHTML(moneda)}</span></div>
  <div class="line"></div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="num">Cant</th>
        <th class="num">P.U.</th>
        <th class="num">Subt</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="line"></div>
  <div class="row total"><span>TOTAL</span><span>${fmt(totalDisplay, moneda)}</span></div>
  <div class="row"><span>Pago:</span><span>${escapeHTML(sale.tipo_pago || '-')}</span></div>
  <p class="muted center">${equivalencia}</p>
  <div class="line"></div>
  <p class="center">Gracias por su compra</p>
  <p class="center muted">${escapeHTML(new Date().toLocaleString())}</p>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
      setTimeout(() => window.close(), 300);
    });
  </script>
</body>
</html>`;
}

function printReceipt(sale) {
  const win = window.open('', '_blank', 'width=360,height=640');
  if (!win) {
    alert('Habilita ventanas emergentes para imprimir el recibo.');
    return;
  }
  win.document.open();
  win.document.write(buildReceiptHTML(sale));
  win.document.close();
}

function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  async function bootstrap() {
    if (!auth.getToken()) {
      setChecking(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    bootstrap();
    return auth.onUnauthorized(() => setUser(null));
  }, []);

  async function login(username, password) {
    const { token, user } = await api.post('/auth/login', { username, password });
    auth.setToken(token);
    setUser(user);
  }

  function logout() {
    auth.clear();
    setUser(null);
  }

  return { user, checking, login, logout };
}

function useBootstrap(user) {
  const isAdmin = user?.rol === 'admin';
  const [state, setState] = useState({
    products: [],
    variants: [],
    customers: [],
    inventory: [],
    sales: [],
    lookups: null,
    config: { tasa_cambio_usd: DEFAULT_RATE, updated_at: null },
    loading: true,
    error: ''
  });

  async function load() {
    if (!user) return;
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));

      const [variants, customers, sales, lookups, config] = await Promise.all([
        api.get('/products/variants'),
        api.get('/customers'),
        api.get('/sales'),
        api.get('/catalog/lookups'),
        api.get('/config')
      ]);

      const [products, inventory] = isAdmin
        ? await Promise.all([api.get('/products'), api.get('/inventory')])
        : [[], []];

      setState({ products, variants, customers, inventory, sales, lookups, config, loading: false, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  function updateConfig(config) {
    setState((current) => ({ ...current, config }));
  }

  return { ...state, reload: load, updateConfig };
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <section className="stat">
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onLogin(form.username, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Store size={28} />
          <div>
            <span>Glory's Boutique</span>
            <strong>Iniciar sesion</strong>
          </div>
        </div>
        <Field label="Usuario">
          <input
            required
            autoFocus
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Contrasena">
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <div className="alert">{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Validando...' : 'Entrar'}
        </button>
        <p className="login-hint">
          Cuentas demo: <code>admin / 123</code> y <code>user1 / 123</code>
        </p>
      </form>
    </div>
  );
}

function Dashboard({ data, user }) {
  const lowStock = data.inventory.filter((item) => item.cantidad <= 5).length;
  const revenueNIO = data.sales.reduce((sum, sale) => {
    const total = Number(sale.total);
    if (sale.moneda === 'USD') return sum + total * Number(sale.tasa_cambio || DEFAULT_RATE);
    return sum + total;
  }, 0);
  const recentSales = [...data.sales].slice(0, 5);
  const isAdmin = user.rol === 'admin';

  return (
    <>
      <section className="stats-grid">
        {isAdmin && <Stat icon={ShoppingBag} label="Productos" value={data.products.length} />}
        <Stat icon={Users} label="Clientes" value={data.customers.length} />
        {isAdmin && <Stat icon={Boxes} label="Stock bajo" value={lowStock} />}
        <Stat icon={CreditCard} label="Ventas (NIO)" value={fmt(revenueNIO, 'NIO')} />
      </section>

      <section className="panel">
        <div className="panel-title">
          <CreditCard size={20} />
          <h2>Ventas recientes</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Pago</th><th>Moneda</th><th>Total</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => {
                const moneda = sale.moneda || 'NIO';
                return (
                  <tr key={sale.id}>
                    <td>#{sale.id}</td>
                    <td>{sale.cliente || 'Cliente ocasional'}</td>
                    <td>{sale.tipo_pago || '-'}</td>
                    <td>{moneda}</td>
                    <td>{fmt(sale.total, moneda)}</td>
                    <td>{new Date(sale.fecha).toLocaleString()}</td>
                  </tr>
                );
              })}
              {recentSales.length === 0 && <tr><td colSpan="6">Aun no hay ventas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Configuration({ config, onUpdated }) {
  const [draft, setDraft] = useState(String(config.tasa_cambio_usd));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(String(config.tasa_cambio_usd));
  }, [config.tasa_cambio_usd]);

  async function submit(event) {
    event.preventDefault();
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un numero positivo.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.put('/config', { tasa_cambio_usd: parsed });
      onUpdated(updated);
      setMessage('Tasa de cambio actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Settings size={20} />
        <h2>Configuracion del sistema</h2>
      </div>

      <form className="config-form" onSubmit={submit}>
        <Field label="Tasa de cambio (cordobas por 1 USD)">
          <input
            type="number"
            step="0.0001"
            min="0"
            required
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>

        <p className="muted">
          Equivalencia actual: <strong>{fmt(1, 'USD')} = {fmt(Number(draft || DEFAULT_RATE), 'NIO')}</strong>
          {config.updated_at && (
            <> &middot; ultima actualizacion: {new Date(config.updated_at).toLocaleString()}</>
          )}
        </p>

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar tasa'}
        </button>
      </form>
    </section>
  );
}

function Products({ products, lookups, reload }) {
  const emptyForm = {
    nombre: '',
    descripcion: '',
    precio_base: '',
    precio_usd: '',
    categoria_id: '',
    subcategoria_id: '',
    proveedor_id: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.precio_base && !form.precio_usd) {
      setError('Captura al menos un precio (NIO o USD).');
      return;
    }
    try {
      await api.post('/products', {
        ...form,
        precio_base: form.precio_base === '' ? null : form.precio_base,
        precio_usd: form.precio_usd === '' ? null : form.precio_usd
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <PackagePlus size={20} />
        <h2>Productos</h2>
      </div>
      <p className="muted small">Cada producto puede tener su precio fijo en cordobas, en dolares o ambos.</p>
      <form className="grid-form" onSubmit={submit}>
        <Field label="Nombre">
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <Field label="Precio (NIO)">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Opcional"
            value={form.precio_base}
            onChange={(e) => setForm({ ...form, precio_base: e.target.value })}
          />
        </Field>
        <Field label="Precio (USD)">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Opcional"
            value={form.precio_usd}
            onChange={(e) => setForm({ ...form, precio_usd: e.target.value })}
          />
        </Field>
        <Field label="Categoria">
          <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
            <option value="">Sin categoria</option>
            {lookups?.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Subcategoria">
          <select value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value })}>
            <option value="">Sin subcategoria</option>
            {lookups?.subcategorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Proveedor">
          <select value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}>
            <option value="">Sin proveedor</option>
            {lookups?.proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Descripcion">
          <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </Field>
        {error && <div className="alert">{error}</div>}
        <button type="submit">Guardar producto</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Categoria</th><th>Proveedor</th><th>Precio NIO</th><th>Precio USD</th></tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.nombre}</td>
                <td>{product.categoria || '-'}</td>
                <td>{product.proveedor || '-'}</td>
                <td>{product.precio_base != null ? fmt(product.precio_base, 'NIO') : '—'}</td>
                <td>{product.precio_usd != null ? fmt(product.precio_usd, 'USD') : '—'}</td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan="5">Aun no hay productos registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Customers({ customers, lookups, reload }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', cedula: '', tipo_cliente_id: '' });

  async function submit(event) {
    event.preventDefault();
    await api.post('/customers', form);
    setForm({ nombre: '', telefono: '', cedula: '', tipo_cliente_id: '' });
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Users size={20} />
        <h2>Clientes</h2>
      </div>
      <form className="grid-form" onSubmit={submit}>
        <Field label="Nombre">
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <Field label="Telefono">
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        </Field>
        <Field label="Cedula">
          <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <select value={form.tipo_cliente_id} onChange={(e) => setForm({ ...form, tipo_cliente_id: e.target.value })}>
            <option value="">Sin tipo</option>
            {lookups?.tiposCliente.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <button type="submit">Guardar cliente</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Telefono</th><th>Cedula</th><th>Tipo</th></tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.nombre}</td>
                <td>{customer.telefono || '-'}</td>
                <td>{customer.cedula || '-'}</td>
                <td>{customer.tipo_cliente || '-'}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan="4">Aun no hay clientes registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Inventory({ products, variants, inventory, reload }) {
  const [variantForm, setVariantForm] = useState({ producto_id: '', color: '', talla: '', cantidad: '' });
  const [stockDrafts, setStockDrafts] = useState({});

  async function addVariant(event) {
    event.preventDefault();
    await api.post(`/products/${variantForm.producto_id}/variants`, variantForm);
    setVariantForm({ producto_id: '', color: '', talla: '', cantidad: '' });
    reload();
  }

  async function updateStock(variantId) {
    await api.put(`/inventory/${variantId}`, { cantidad: stockDrafts[variantId] });
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Boxes size={20} />
        <h2>Inventario</h2>
      </div>
      <form className="grid-form" onSubmit={addVariant}>
        <Field label="Producto">
          <select required value={variantForm.producto_id} onChange={(e) => setVariantForm({ ...variantForm, producto_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
          </select>
        </Field>
        <Field label="Color">
          <input value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} />
        </Field>
        <Field label="Talla">
          <input value={variantForm.talla} onChange={(e) => setVariantForm({ ...variantForm, talla: e.target.value })} />
        </Field>
        <Field label="Stock inicial">
          <input type="number" value={variantForm.cantidad} onChange={(e) => setVariantForm({ ...variantForm, cantidad: e.target.value })} />
        </Field>
        <button type="submit">Agregar variante</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Color</th><th>Talla</th><th>Cantidad</th><th>Ajuste</th></tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.producto_variante_id}>
                <td>{item.producto}</td>
                <td>{item.color || '-'}</td>
                <td>{item.talla || '-'}</td>
                <td>{item.cantidad}</td>
                <td className="inline-edit">
                  <input
                    type="number"
                    placeholder={String(item.cantidad)}
                    value={stockDrafts[item.producto_variante_id] ?? ''}
                    onChange={(e) => setStockDrafts({ ...stockDrafts, [item.producto_variante_id]: e.target.value })}
                  />
                  <button type="button" onClick={() => updateStock(item.producto_variante_id)}>Actualizar</button>
                </td>
              </tr>
            ))}
            {variants.length === 0 && <tr><td colSpan="5">No hay variantes todavia.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function priceFor(variant, moneda, rate) {
  const nio = variant?.precio_base != null ? Number(variant.precio_base) : null;
  const usd = variant?.precio_usd != null ? Number(variant.precio_usd) : null;
  if (moneda === 'USD') {
    if (usd != null) return { value: usd, converted: false };
    if (nio != null) return { value: nio / rate, converted: true };
    return { value: 0, converted: false };
  }
  if (nio != null) return { value: nio, converted: false };
  if (usd != null) return { value: usd * rate, converted: true };
  return { value: 0, converted: false };
}

function POS({ variants, customers, lookups, config, user, reload }) {
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
            {lookups?.tiposPago.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
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

function Sales({ sales, user }) {
  const [reprintingId, setReprintingId] = useState(null);

  async function reprint(saleId) {
    setReprintingId(saleId);
    try {
      const sale = await api.get(`/sales/${saleId}`);
      printReceipt({
        id: sale.id,
        total: sale.total,
        moneda: sale.moneda || 'NIO',
        tasa_cambio: sale.tasa_cambio || DEFAULT_RATE,
        fecha: sale.fecha,
        cajero: sale.usuario || user.username,
        cliente: sale.cliente,
        tipo_pago: sale.tipo_pago,
        items: (sale.details || []).map((d) => ({
          producto: d.producto,
          color: d.color,
          talla: d.talla,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario
        }))
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setReprintingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CreditCard size={20} />
        <h2>Historial de ventas</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Cliente</th><th>Usuario</th><th>Pago</th><th>Moneda</th><th>Total</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const moneda = sale.moneda || 'NIO';
              return (
                <tr key={sale.id}>
                  <td>#{sale.id}</td>
                  <td>{sale.cliente || 'Cliente ocasional'}</td>
                  <td>{sale.usuario || '-'}</td>
                  <td>{sale.tipo_pago || '-'}</td>
                  <td>{moneda}</td>
                  <td>{fmt(sale.total, moneda)}</td>
                  <td>{new Date(sale.fecha).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => reprint(sale.id)}
                      disabled={reprintingId === sale.id}
                    >
                      <Printer size={14} />
                      <span>{reprintingId === sale.id ? '...' : 'Imprimir'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {sales.length === 0 && <tr><td colSpan="8">Aun no hay ventas registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Sidebar({ activeView, onSelect, open, onClose, user, onLogout }) {
  const groups = visibleMenu(user.rol);
  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar-brand">
        <Store size={22} />
        <div>
          <span>Glory's</span>
          <strong>Boutique</strong>
        </div>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <p className="sidebar-group-label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`sidebar-link${active ? ' sidebar-link--active' : ''}`}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span>{user.username}</span>
          <small>{user.rol}</small>
        </div>
        <button type="button" className="logout-button" onClick={onLogout}>
          <LogOut size={16} />
          <span>Salir</span>
        </button>
      </div>
    </aside>
  );
}

function Workspace({ user, onLogout }) {
  const data = useBootstrap(user);
  const allowedDefault = canAccess('dashboard', user.rol) ? 'dashboard' : visibleMenu(user.rol)[0]?.items[0]?.id;
  const [activeView, setActiveView] = useState(allowedDefault);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!canAccess(activeView, user.rol)) {
      setActiveView(allowedDefault);
    }
  }, [user.rol]);

  function renderView() {
    if (!canAccess(activeView, user.rol)) {
      return <div className="alert">No tienes acceso a este modulo.</div>;
    }
    switch (activeView) {
      case 'products':
        return <Products products={data.products} lookups={data.lookups} reload={data.reload} />;
      case 'customers':
        return <Customers customers={data.customers} lookups={data.lookups} reload={data.reload} />;
      case 'inventory':
        return <Inventory products={data.products} variants={data.variants} inventory={data.inventory} reload={data.reload} />;
      case 'pos':
        return <POS variants={data.variants} customers={data.customers} lookups={data.lookups} config={data.config} user={user} reload={data.reload} />;
      case 'sales':
        return <Sales sales={data.sales} user={user} />;
      case 'config':
        return <Configuration config={data.config} onUpdated={data.updateConfig} />;
      case 'dashboard':
      default:
        return <Dashboard data={data} user={user} />;
    }
  }

  return (
    <div className="layout">
      <Sidebar
        activeView={activeView}
        onSelect={setActiveView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p>Glory's Boutique</p>
              <h1>{VIEW_TITLES[activeView] || 'Panel'}</h1>
            </div>
          </div>
          <button type="button" className="refresh-button" onClick={data.reload}>
            <RefreshCw size={16} />
            <span>Refrescar</span>
          </button>
        </header>

        {data.error && <div className="alert">{data.error}</div>}
        {data.loading && <div className="loading">Cargando datos...</div>}

        <div className="view">{renderView()}</div>
      </main>
    </div>
  );
}

function App() {
  const { user, checking, login, logout } = useAuth();

  if (checking) {
    return <div className="boot-screen">Cargando sesion...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return <Workspace user={user} onLogout={logout} />;
}

createRoot(document.getElementById('root')).render(<App />);
