import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Boxes, CreditCard, PackagePlus, ShoppingBag, Users } from 'lucide-react';
import { api } from './api.js';
import './styles.css';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function useBootstrap() {
  const [state, setState] = useState({
    products: [],
    variants: [],
    customers: [],
    inventory: [],
    sales: [],
    lookups: null,
    loading: true,
    error: ''
  });

  async function load() {
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));
      const [products, variants, customers, inventory, sales, lookups] = await Promise.all([
        api.get('/products'),
        api.get('/products/variants'),
        api.get('/customers'),
        api.get('/inventory'),
        api.get('/sales'),
        api.get('/catalog/lookups')
      ]);
      setState({ products, variants, customers, inventory, sales, lookups, loading: false, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { ...state, reload: load };
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

function Products({ products, lookups, reload }) {
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio_base: '',
    categoria_id: '',
    subcategoria_id: '',
    proveedor_id: ''
  });

  async function submit(event) {
    event.preventDefault();
    await api.post('/products', form);
    setForm({ nombre: '', descripcion: '', precio_base: '', categoria_id: '', subcategoria_id: '', proveedor_id: '' });
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <PackagePlus size={20} />
        <h2>Productos</h2>
      </div>
      <form className="grid-form" onSubmit={submit}>
        <Field label="Nombre">
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <Field label="Precio">
          <input required type="number" step="0.01" value={form.precio_base} onChange={(e) => setForm({ ...form, precio_base: e.target.value })} />
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
        <button type="submit">Guardar producto</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Categoria</th><th>Proveedor</th><th>Precio</th></tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.nombre}</td>
                <td>{product.categoria || '-'}</td>
                <td>{product.proveedor || '-'}</td>
                <td>{currency.format(product.precio_base)}</td>
              </tr>
            ))}
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

function Sales({ customers, variants, sales, lookups, reload }) {
  const [form, setForm] = useState({ cliente_id: '', usuario_id: '', tipo_pago_id: '', producto_variante_id: '', cantidad: 1 });
  const selectedVariant = variants.find((item) => String(item.id) === String(form.producto_variante_id));
  const saleTotal = useMemo(() => Number(form.cantidad || 0) * Number(selectedVariant?.precio_base || 0), [form.cantidad, selectedVariant]);

  async function submit(event) {
    event.preventDefault();
    await api.post('/sales', {
      cliente_id: form.cliente_id,
      usuario_id: form.usuario_id,
      tipo_pago_id: form.tipo_pago_id,
      items: [{
        producto_variante_id: form.producto_variante_id,
        cantidad: Number(form.cantidad),
        precio_unitario: Number(selectedVariant.precio_base)
      }]
    });
    setForm({ cliente_id: '', usuario_id: '', tipo_pago_id: '', producto_variante_id: '', cantidad: 1 });
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CreditCard size={20} />
        <h2>Ventas</h2>
      </div>
      <form className="grid-form" onSubmit={submit}>
        <Field label="Cliente">
          <select required value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre}</option>)}
          </select>
        </Field>
        <Field label="Usuario">
          <select required value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {lookups?.usuarios.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </select>
        </Field>
        <Field label="Pago">
          <select required value={form.tipo_pago_id} onChange={(e) => setForm({ ...form, tipo_pago_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {lookups?.tiposPago.map((payment) => <option key={payment.id} value={payment.id}>{payment.nombre}</option>)}
          </select>
        </Field>
        <Field label="Producto">
          <select required value={form.producto_variante_id} onChange={(e) => setForm({ ...form, producto_variante_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.producto} / {variant.color || 'Color'} / {variant.talla || 'Talla'} / stock {variant.cantidad}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cantidad">
          <input min="1" type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
        </Field>
        <div className="total-box">
          <span>Total</span>
          <strong>{currency.format(saleTotal)}</strong>
        </div>
        <button type="submit" disabled={!selectedVariant}>Registrar venta</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Cliente</th><th>Usuario</th><th>Pago</th><th>Total</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>#{sale.id}</td>
                <td>{sale.cliente || '-'}</td>
                <td>{sale.usuario || '-'}</td>
                <td>{sale.tipo_pago || '-'}</td>
                <td>{currency.format(sale.total)}</td>
                <td>{new Date(sale.fecha).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const data = useBootstrap();
  const lowStock = data.inventory.filter((item) => item.cantidad <= 5).length;
  const revenue = data.sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p>Glory's Boutique</p>
          <h1>Panel de gestion</h1>
        </div>
        <button type="button" onClick={data.reload}>Refrescar</button>
      </header>

      {data.error && <div className="alert">{data.error}</div>}
      {data.loading && <div className="loading">Cargando datos...</div>}

      <section className="stats-grid">
        <Stat icon={ShoppingBag} label="Productos" value={data.products.length} />
        <Stat icon={Users} label="Clientes" value={data.customers.length} />
        <Stat icon={Boxes} label="Stock bajo" value={lowStock} />
        <Stat icon={CreditCard} label="Ventas" value={currency.format(revenue)} />
      </section>

      <div className="content-grid">
        <Products products={data.products} lookups={data.lookups} reload={data.reload} />
        <Customers customers={data.customers} lookups={data.lookups} reload={data.reload} />
        <Inventory products={data.products} variants={data.variants} inventory={data.inventory} reload={data.reload} />
        <Sales customers={data.customers} variants={data.variants} sales={data.sales} lookups={data.lookups} reload={data.reload} />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
