import React, { useState } from 'react';
import { Pencil, Tags, Trash2, X } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';

const emptyForm = { nombre: '', es_credito: false };

export function PaymentTypes({ paymentTypes, reload }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function startEdit(type) {
    setEditingId(type.id);
    setForm({ nombre: type.nombre, es_credito: !!type.es_credito });
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
        await api.put(`/payment-types/${editingId}`, form);
      } else {
        await api.post('/payment-types', form);
      }
      cancelEdit();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Eliminar este tipo de pago?')) return;
    try {
      await api.delete(`/payment-types/${id}`);
      if (editingId === id) cancelEdit();
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Tags size={20} />
        <h2>Tipos de pago</h2>
      </div>
      <p className="muted small">
        Define las formas de pago aceptadas. Si marcas un tipo como <strong>credito</strong>, las ventas
        que lo usen no se cobran al momento; el total se suma al saldo del cliente para abonar despues.
      </p>

      <form className="grid-form" onSubmit={submit}>
        <Field label="Nombre">
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Efectivo, Transferencia"
          />
        </Field>
        <Field label="Es credito (fiado)">
          <select
            value={form.es_credito ? '1' : '0'}
            onChange={(e) => setForm({ ...form, es_credito: e.target.value === '1' })}
          >
            <option value="0">No (cobro inmediato)</option>
            <option value="1">Si (genera saldo)</option>
          </select>
        </Field>

        {error && <div className="alert">{error}</div>}

        <div className="row">
          <button type="submit">{editingId ? 'Actualizar tipo' : 'Crear tipo'}</button>
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
              <th>Tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paymentTypes.map((type) => (
              <tr key={type.id}>
                <td><strong>{type.nombre}</strong></td>
                <td>
                  {type.es_credito ? (
                    <span className="chip chip-warn">Credito (fiado)</span>
                  ) : (
                    <span className="chip">Cobro inmediato</span>
                  )}
                </td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(type)}>
                    <Pencil size={14} />
                    <span>Editar</span>
                  </button>
                  <button type="button" className="ghost danger" onClick={() => remove(type.id)}>
                    <Trash2 size={14} />
                    <span>Eliminar</span>
                  </button>
                </td>
              </tr>
            ))}
            {paymentTypes.length === 0 && <tr><td colSpan="3">No hay tipos de pago registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
