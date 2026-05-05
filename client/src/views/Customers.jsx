import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';

export function Customers({ customers, lookups, reload }) {
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
