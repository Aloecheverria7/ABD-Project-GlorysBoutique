/**
 * @file Vista de caja chica. Registra entradas y salidas de efectivo, muestra la
 * base, el saldo actual y el historial de movimientos.
 */
import React, { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Trash2, Wallet } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = { tipo: 'entrada', monto: '', motivo: '' };

/**
 * Vista de caja chica: registra entradas y salidas de efectivo y muestra el saldo.
 *
 * @param {Object} props
 * @param {{ base?: number, saldo?: number, movimientos?: Array<Object> }} props.caja - Estado de caja con base, saldo y movimientos.
 * @param {() => void} props.reload - Recarga los datos del panel.
 * @param {{ rol: string }} props.user - Usuario en sesion; solo admin puede eliminar movimientos.
 * @returns {JSX.Element}
 */
export function Caja({ caja, reload, user }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.rol === 'admin';

  const base = Number(caja?.base || 0);
  const saldo = Number(caja?.saldo || 0);
  const movimientos = caja?.movimientos || [];

  /**
   * Valida y registra un movimiento de caja (entrada o salida); exige un monto
   * mayor que cero y al exito limpia el formulario y recarga los datos.
   *
   * @param {Event} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function submit(event) {
    event.preventDefault();
    setError('');
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa un monto mayor que cero.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/caja/movimientos', {
        tipo: form.tipo,
        monto,
        motivo: form.motivo.trim() || null
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Elimina un movimiento de caja previa confirmacion y recarga los datos.
   *
   * @param {number} id - Identificador del movimiento a eliminar.
   * @returns {Promise<void>}
   */
  async function removeMovimiento(id) {
    if (!confirm('Eliminar este movimiento?')) return;
    try {
      await api.delete(`/caja/movimientos/${id}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Wallet size={20} />
        <h2>Caja chica</h2>
      </div>

      <div className="report-summary row" style={{ flexWrap: 'wrap', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <span>Base inicial: <strong>{fmt(base, 'NIO')}</strong></span>
        <span>Saldo actual: <strong className={saldo < 0 ? 'is-debt' : ''}>{fmt(saldo, 'NIO')}</strong></span>
        <span><strong>{movimientos.length}</strong> movimiento(s)</span>
      </div>

      <form className="grid-form" onSubmit={submit}>
        <Field label="Tipo">
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </Field>
        <Field label="Monto (NIO)">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
          />
        </Field>
        <Field label="Motivo">
          <input
            value={form.motivo}
            placeholder="Ej. compra de bolsas, retiro de efectivo"
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          />
        </Field>
        {error && <div className="alert">{error}</div>}
        <div className="row">
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar movimiento'}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tipo</th><th>Monto</th><th>Motivo</th><th>Usuario</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {movimientos.map((mov) => (
              <tr key={mov.id}>
                <td>
                  {mov.tipo === 'salida' ? (
                    <span className="row" style={{ gap: '0.35rem' }}><ArrowUpCircle size={14} /> Salida</span>
                  ) : (
                    <span className="row" style={{ gap: '0.35rem' }}><ArrowDownCircle size={14} /> Entrada</span>
                  )}
                </td>
                <td className={mov.tipo === 'salida' ? 'is-debt' : ''}>
                  {mov.tipo === 'salida' ? '-' : '+'}{fmt(mov.monto, 'NIO')}
                </td>
                <td>{mov.motivo || '-'}</td>
                <td>{mov.usuario || '-'}</td>
                <td>{new Date(mov.fecha).toLocaleString()}</td>
                <td className="row-actions">
                  {isAdmin && (
                    <button type="button" className="ghost danger" onClick={() => removeMovimiento(mov.id)}>
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {movimientos.length === 0 && <tr><td colSpan="6">Aun no hay movimientos de caja.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
