import React, { useState } from 'react';
import { Plus, Trash2, Truck, Pencil, X } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = { nombre: '', telefono: '', direccion: '' };
const emptyLink = { producto_id: '', costo: '', moneda_costo: 'NIO' };

export function Suppliers({ suppliers, products, reload }) {
  const [form, setForm] = useState(emptyForm);
  const [productLinks, setProductLinks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function startEdit(supplier) {
    setEditingId(supplier.id);
    setForm({
      nombre: supplier.nombre || '',
      telefono: supplier.telefono || '',
      direccion: supplier.direccion || ''
    });
    setProductLinks((supplier.productos || []).map((p) => ({
      producto_id: String(p.id),
      costo: p.costo != null ? String(p.costo) : '',
      moneda_costo: p.moneda_costo || 'NIO'
    })));
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setProductLinks([]);
    setError('');
  }

  function addLink() {
    setProductLinks((current) => [...current, { ...emptyLink }]);
  }
  function updateLink(index, patch) {
    setProductLinks((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }
  function removeLink(index) {
    setProductLinks((current) => current.filter((_, idx) => idx !== index));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const payload = {
      nombre: form.nombre,
      telefono: form.telefono,
      direccion: form.direccion,
      productos: productLinks
        .filter((row) => row.producto_id)
        .map((row) => ({
          producto_id: Number(row.producto_id),
          costo: row.costo === '' ? null : Number(row.costo),
          moneda_costo: row.moneda_costo === 'USD' ? 'USD' : 'NIO'
        }))
    };

    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      cancelEdit();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSupplier(id) {
    if (!confirm('Eliminar este proveedor? Sus productos quedaran sin vinculo.')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      if (editingId === id) cancelEdit();
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Truck size={20} />
        <h2>Proveedores</h2>
      </div>
      <p className="muted small">Registra proveedores y los productos que entregan, con costo opcional por proveedor.</p>

      <form className="grid-form" onSubmit={submit}>
        <Field label="Nombre">
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <Field label="Telefono">
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        </Field>
        <Field label="Direccion">
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </Field>

        <div className="grid-form-full">
          <div className="row-between">
            <strong>Productos asignados</strong>
            <button type="button" className="ghost" onClick={addLink}>
              <Plus size={14} />
              <span>Agregar producto</span>
            </button>
          </div>
          {productLinks.length === 0 && (
            <p className="muted small">Aun no hay productos para este proveedor.</p>
          )}
          {productLinks.map((row, index) => (
            <div className="link-row" key={index}>
              <select
                value={row.producto_id}
                onChange={(e) => updateLink(index, { producto_id: e.target.value })}
              >
                <option value="">Seleccionar producto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo"
                value={row.costo}
                onChange={(e) => updateLink(index, { costo: e.target.value })}
              />
              <select
                value={row.moneda_costo}
                onChange={(e) => updateLink(index, { moneda_costo: e.target.value })}
              >
                <option value="NIO">NIO</option>
                <option value="USD">USD</option>
              </select>
              <button type="button" className="icon-button" onClick={() => removeLink(index)} aria-label="Quitar">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}
        <div className="row">
          <button type="submit">{editingId ? 'Actualizar proveedor' : 'Guardar proveedor'}</button>
          {editingId && (
            <button type="button" className="ghost" onClick={cancelEdit}>
              <X size={14} />
              <span>Cancelar</span>
            </button>
          )}
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Productos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>
                  <strong>{supplier.nombre}</strong>
                  {supplier.direccion && <div className="muted small">{supplier.direccion}</div>}
                </td>
                <td>{supplier.telefono || '-'}</td>
                <td>
                  {(supplier.productos || []).length === 0 && <span className="muted small">Sin productos</span>}
                  {(supplier.productos || []).map((p) => (
                    <div key={p.id} className="chip">
                      <strong>{p.nombre}</strong>
                      {p.costo != null && (
                        <small> · {fmt(p.costo, p.moneda_costo || 'NIO')}</small>
                      )}
                    </div>
                  ))}
                </td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(supplier)}>
                    <Pencil size={14} />
                    <span>Editar</span>
                  </button>
                  <button type="button" className="ghost danger" onClick={() => removeSupplier(supplier.id)}>
                    <Trash2 size={14} />
                    <span>Eliminar</span>
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan="4">Aun no hay proveedores registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
