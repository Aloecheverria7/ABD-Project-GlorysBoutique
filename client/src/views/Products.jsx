import React, { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = {
  nombre: '',
  descripcion: '',
  precio_base: '',
  precio_usd: '',
  categoria_id: '',
  subcategoria_id: '',
  proveedor_id: ''
};

export function Products({ products, lookups, reload }) {
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
