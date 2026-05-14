import React, { useState } from 'react';
import { Pencil, Trash2, UserCog, X } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';

const emptyForm = { username: '', password: '', rol_id: '', activo: true };

export function UsersView({ users, lookups, currentUser, reload }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const roles = lookups?.roles || null;

  function startEdit(user) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: '',
      rol_id: String(user.rol_id || ''),
      activo: !!user.activo
    });
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const payload = {
      username: form.username,
      rol_id: form.rol_id ? Number(form.rol_id) : null,
      activo: form.activo
    };
    if (form.password) payload.password = form.password;

    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
        setMessage('Usuario actualizado.');
      } else {
        if (!form.password) {
          setError('La contrasena es obligatoria para nuevos usuarios.');
          return;
        }
        await api.post('/users', payload);
        setMessage('Usuario creado.');
      }
      cancelEdit();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function disableUser(user) {
    if (user.id === currentUser.id) {
      alert('No puedes desactivar tu propio usuario.');
      return;
    }
    if (!confirm(`Desactivar a ${user.username}?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <UserCog size={20} />
        <h2>Usuarios del sistema</h2>
      </div>
      <p className="muted small">Crea, edita o desactiva usuarios. Solo administradores tienen acceso a este modulo.</p>

      <form className="grid-form" onSubmit={submit}>
        <Field label="Usuario">
          <input
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label={editingId ? 'Contrasena (dejar vacio para no cambiar)' : 'Contrasena'}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Rol">
          <select required value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {(roles || [{ id: 1, nombre: 'admin' }, { id: 2, nombre: 'vendedor' }]).map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={form.activo ? '1' : '0'} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </Field>

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <div className="row">
          <button type="submit">{editingId ? 'Actualizar usuario' : 'Crear usuario'}</button>
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
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.username}</strong>
                  {user.id === currentUser.id && <small className="muted"> (tu)</small>}
                </td>
                <td>{user.rol || '-'}</td>
                <td>{user.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(user)}>
                    <Pencil size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => disableUser(user)}
                    disabled={user.id === currentUser.id}
                  >
                    <Trash2 size={14} />
                    <span>Desactivar</span>
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="4">No hay usuarios cargados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
