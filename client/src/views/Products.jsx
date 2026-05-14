import React, { useState } from 'react';
import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = {
  nombre: '',
  descripcion: '',
  precio_base: '',
  precio_usd: '',
  categoria_id: '',
  subcategoria_id: ''
};

const emptyLink = { proveedor_id: '', costo: '', moneda_costo: 'NIO' };

export function Products({ products, suppliers = [], lookups, reload }) {
  const [form, setForm] = useState(emptyForm);
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [error, setError] = useState('');

  function addSupplierRow() {
    setSupplierLinks((current) => [...current, { ...emptyLink }]);
  }

  function updateSupplierRow(index, patch) {
    setSupplierLinks((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeSupplierRow(index) {
    setSupplierLinks((current) => current.filter((_, idx) => idx !== index));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.precio_base && !form.precio_usd) {
      setError('Captura al menos un precio (NIO o USD).');
      return;
    }
    const cleaned = supplierLinks
      .filter((row) => row.proveedor_id)
      .map((row) => ({
        proveedor_id: Number(row.proveedor_id),
        costo: row.costo === '' ? null : Number(row.costo),
        moneda_costo: row.moneda_costo === 'USD' ? 'USD' : 'NIO'
      }));

    try {
      await api.post('/products', {
        ...form,
        precio_base: form.precio_base === '' ? null : form.precio_base,
        precio_usd: form.precio_usd === '' ? null : form.precio_usd,
        proveedores: cleaned
      });
      setForm(emptyForm);
      setSupplierLinks([]);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const supplierOptions = suppliers.length > 0 ? suppliers : (lookups?.proveedores || []);

  return (
    <section className="panel">
      <div className="panel-title">
        <PackagePlus size={20} />
        <h2>Productos</h2>
      </div>
      <p className="muted small">Cada producto puede tener su precio fijo en cordobas, en dolares o ambos, y uno o varios proveedores.</p>
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
        <Field label="Descripcion">
          <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </Field>

        <div className="grid-form-full">
          <div className="row-between">
            <strong>Proveedores</strong>
            <button type="button" className="ghost" onClick={addSupplierRow}>
              <Plus size={14} />
              <span>Agregar proveedor</span>
            </button>
          </div>
          {supplierLinks.length === 0 && (
            <p className="muted small">Aun no agregaste proveedores para este producto.</p>
          )}
          {supplierLinks.map((row, index) => (
            <div className="link-row" key={index}>
              <select
                value={row.proveedor_id}
                onChange={(e) => updateSupplierRow(index, { proveedor_id: e.target.value })}
              >
                <option value="">Seleccionar proveedor</option>
                {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo"
                value={row.costo}
                onChange={(e) => updateSupplierRow(index, { costo: e.target.value })}
              />
              <select
                value={row.moneda_costo}
                onChange={(e) => updateSupplierRow(index, { moneda_costo: e.target.value })}
              >
                <option value="NIO">NIO</option>
                <option value="USD">USD</option>
              </select>
              <button type="button" className="icon-button" onClick={() => removeSupplierRow(index)} aria-label="Quitar">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}
        <button type="submit">Guardar producto</button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoria</th>
              <th>Proveedores</th>
              <th>Precio NIO</th>
              <th>Precio USD</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.nombre}</td>
                <td>{product.categoria || '-'}</td>
                <td>
                  {(product.proveedores || []).length === 0 && '-'}
                  {(product.proveedores || []).map((p) => (
                    <div key={p.id} className="chip">
                      <strong>{p.nombre}</strong>
                      {p.costo != null && (
                        <small> · {fmt(p.costo, p.moneda_costo || 'NIO')}</small>
                      )}
                    </div>
                  ))}
                </td>
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
