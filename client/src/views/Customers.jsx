import React, { useState } from 'react';
import { Pencil, Trash2, Users, X } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = { nombre: '', telefono: '', cedula: '', tipo_cliente_id: '' };

export function Customers({ customers, lookups, reload, user }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const isAdmin = user?.rol === 'admin';

  function startEdit(customer) {
    setEditingId(customer.id);
    setForm({
      nombre: customer.nombre || '',
      telefono: customer.telefono || '',
      cedula: customer.cedula || '',
      tipo_cliente_id: customer.tipo_cliente_id ? String(customer.tipo_cliente_id) : ''
    });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
      } else {
        await api.post('/customers', form);
      }
      cancelEdit();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeCustomer(id) {
    if (!confirm('Eliminar este cliente?')) return;
    try {
      await api.delete(`/customers/${id}`);
      if (editingId === id) cancelEdit();
      reload();
    } catch (err) {
      alert(err.message);
    }
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
        {error && <div className="alert">{error}</div>}
        <div className="row">
          <button type="submit">{editingId ? 'Actualizar cliente' : 'Guardar cliente'}</button>
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
              <th>Nombre</th>
              <th>Telefono</th>
              <th>Cedula</th>
              <th>Tipo</th>
              <th>Saldo NIO</th>
              <th>Saldo USD</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.nombre}</td>
                <td>{customer.telefono || '-'}</td>
                <td>{customer.cedula || '-'}</td>
                <td>{customer.tipo_cliente || '-'}</td>
                <td className={customer.saldo_nio > 0 ? 'is-debt' : ''}>
                  {fmt(customer.saldo_nio || 0, 'NIO')}
                </td>
                <td className={customer.saldo_usd > 0 ? 'is-debt' : ''}>
                  {fmt(customer.saldo_usd || 0, 'USD')}
                </td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(customer)}>
                    <Pencil size={14} />
                    <span>Editar</span>
                  </button>
                  {isAdmin && (
                    <button type="button" className="ghost danger" onClick={() => removeCustomer(customer.id)}>
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan="7">Aun no hay clientes registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
