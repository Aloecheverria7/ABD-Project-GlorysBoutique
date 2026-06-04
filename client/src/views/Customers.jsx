/** @file Vista de gestion de clientes: alta, edicion, eliminacion y listado con saldos por moneda. */
import React, { useState } from 'react';
import { Pencil, Trash2, Users, X } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = { nombre: '', telefono: '', cedula: '', tipo_cliente_id: '' };

/**
 * Vista de gestion de clientes que permite registrar, editar y eliminar clientes,
 * ademas de listarlos con sus saldos pendientes en NIO y USD. La eliminacion solo
 * esta disponible para usuarios con rol de administrador.
 *
 * @param {Object} props
 * @param {Array<Object>} props.customers - Lista de clientes a mostrar.
 * @param {{ tiposCliente: Array<{ id: number, nombre: string }> }} props.lookups - Catalogos auxiliares, incluye los tipos de cliente.
 * @param {Function} props.reload - Funcion que recarga los datos tras una operacion.
 * @param {{ username: string, rol: string }} props.user - Usuario en sesion; su rol habilita la opcion de eliminar.
 * @returns {JSX.Element}
 */
export function Customers({ customers, lookups, reload, user }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const isAdmin = user?.rol === 'admin';

  /**
   * Carga los datos de un cliente en el formulario para editarlo.
   *
   * @param {Object} customer - Cliente seleccionado para editar.
   * @returns {void}
   */
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

  /**
   * Cancela la edicion en curso y restablece el formulario a su estado inicial.
   *
   * @returns {void}
   */
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  /**
   * Envia el formulario para crear un cliente nuevo o actualizar el cliente en edicion,
   * y recarga los datos al finalizar.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
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

  /**
   * Solicita confirmacion y elimina un cliente; si estaba en edicion cancela el
   * formulario y recarga los datos.
   *
   * @param {number} id - Identificador del cliente a eliminar.
   * @returns {Promise<void>}
   */
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
          <input
            value={form.telefono}
            inputMode="numeric"
            maxLength={8}
            placeholder="8 digitos"
            onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 8) })}
          />
        </Field>
        <Field label="Cedula">
          <input
            value={form.cedula}
            maxLength={16}
            placeholder="001-150792-1004M"
            onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 16) })}
          />
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
