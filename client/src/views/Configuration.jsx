/** @file Vista de configuracion del sistema: tasa de cambio USD y monto de caja base. */
import React, { useEffect, useState } from 'react';
import { Coins, Plus, Settings, Trash2 } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

const emptyDenom = { valor: '', tipo: 'billete', moneda: 'NIO' };

/**
 * Vista de configuracion del sistema que permite editar la tasa de cambio de cordobas
 * por dolar y el monto de caja base inicial del establecimiento, sincronizando el
 * formulario con la configuracion vigente.
 *
 * @param {Object} props
 * @param {{ tasa_cambio_usd: number, caja_base: number, updated_at: string }} props.config - Configuracion actual del sistema.
 * @param {Function} props.onUpdated - Callback invocado con la configuracion actualizada tras guardar.
 * @returns {JSX.Element}
 */
export function Configuration({ config, onUpdated }) {
  const [draft, setDraft] = useState(String(config.tasa_cambio_usd));
  const [cajaDraft, setCajaDraft] = useState(String(config.caja_base ?? 0));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [denoms, setDenoms] = useState([]);
  const [denomForm, setDenomForm] = useState(emptyDenom);
  const [denomError, setDenomError] = useState('');

  useEffect(() => {
    setDraft(String(config.tasa_cambio_usd));
  }, [config.tasa_cambio_usd]);

  useEffect(() => {
    setCajaDraft(String(config.caja_base ?? 0));
  }, [config.caja_base]);

  useEffect(() => {
    let cancelled = false;
    api.get('/config/denominaciones')
      .then((data) => { if (!cancelled) setDenoms(data); })
      .catch((err) => { if (!cancelled) setDenomError(err.message); });
    return () => { cancelled = true; };
  }, []);

  /**
   * Recarga el catalogo de denominaciones desde el servidor.
   *
   * @returns {Promise<void>}
   */
  async function reloadDenoms() {
    try {
      setDenoms(await api.get('/config/denominaciones'));
    } catch (err) {
      setDenomError(err.message);
    }
  }

  /**
   * Crea una nueva denominacion con los datos del formulario y recarga la lista.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario de denominacion.
   * @returns {Promise<void>}
   */
  async function addDenom(event) {
    event.preventDefault();
    setDenomError('');
    const valor = Number(denomForm.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      setDenomError('Ingresa un valor mayor que cero.');
      return;
    }
    try {
      await api.post('/config/denominaciones', { valor, tipo: denomForm.tipo, moneda: denomForm.moneda });
      setDenomForm(emptyDenom);
      reloadDenoms();
    } catch (err) {
      setDenomError(err.message);
    }
  }

  /**
   * Activa o desactiva una denominacion para el desglose del vuelto.
   *
   * @param {{ id: number, activo: boolean }} denom - Denominacion a alternar.
   * @returns {Promise<void>}
   */
  async function toggleDenom(denom) {
    try {
      await api.put(`/config/denominaciones/${denom.id}`, { activo: !denom.activo });
      reloadDenoms();
    } catch (err) {
      setDenomError(err.message);
    }
  }

  /**
   * Elimina una denominacion previa confirmacion y recarga la lista.
   *
   * @param {number} id - Identificador de la denominacion.
   * @returns {Promise<void>}
   */
  async function removeDenom(id) {
    if (!confirm('Eliminar esta denominacion?')) return;
    try {
      await api.delete(`/config/denominaciones/${id}`);
      reloadDenoms();
    } catch (err) {
      setDenomError(err.message);
    }
  }

  /**
   * Valida la tasa de cambio y el monto de caja base, los envia al servidor y notifica
   * la configuracion actualizada mostrando un mensaje de exito o error.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function submit(event) {
    event.preventDefault();
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa una tasa de cambio positiva.');
      return;
    }
    const cajaParsed = Number(cajaDraft);
    if (!Number.isFinite(cajaParsed) || cajaParsed < 0) {
      setError('El monto de caja base no es valido.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.put('/config', { tasa_cambio_usd: parsed, caja_base: cajaParsed });
      onUpdated(updated);
      setMessage('Configuracion actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <section className="panel">
      <div className="panel-title">
        <Settings size={20} />
        <h2>Configuracion del sistema</h2>
      </div>

      <form className="config-form" onSubmit={submit}>
        <Field label="Tasa de cambio (cordobas por 1 USD)">
          <input
            type="number"
            step="0.0001"
            min="0"
            required
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>

        <p className="muted">
          Equivalencia actual: <strong>{fmt(1, 'USD')} = {fmt(Number(draft || DEFAULT_RATE), 'NIO')}</strong>
          {config.updated_at && (
            <> &middot; ultima actualizacion: {new Date(config.updated_at).toLocaleString()}</>
          )}
        </p>

        <Field label="Caja base (efectivo inicial del establecimiento en NIO)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={cajaDraft}
            onChange={(e) => setCajaDraft(e.target.value)}
          />
        </Field>

        <p className="muted">
          Monto de partida de la caja chica. Las entradas y salidas se registran en el modulo Caja.
        </p>

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </form>
    </section>

    <section className="panel">
      <div className="panel-title">
        <Coins size={20} />
        <h2>Denominaciones de caja</h2>
      </div>
      <p className="muted small">
        Billetes y monedas disponibles. Se usan para registrar el efectivo en la apertura de caja y
        para desglosar el vuelto en el punto de venta. Desactiva las que no manejes.
      </p>

      <form className="grid-form" onSubmit={addDenom}>
        <Field label="Valor">
          <input
            type="number"
            step="0.01"
            min="0"
            value={denomForm.valor}
            onChange={(e) => setDenomForm({ ...denomForm, valor: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <select value={denomForm.tipo} onChange={(e) => setDenomForm({ ...denomForm, tipo: e.target.value })}>
            <option value="billete">Billete</option>
            <option value="moneda">Moneda</option>
          </select>
        </Field>
        <Field label="Moneda">
          <select value={denomForm.moneda} onChange={(e) => setDenomForm({ ...denomForm, moneda: e.target.value })}>
            <option value="NIO">NIO</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <button type="submit">
          <Plus size={14} />
          <span>Agregar denominacion</span>
        </button>
      </form>

      {denomError && <div className="alert">{denomError}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Valor</th><th>Tipo</th><th>Moneda</th><th>Activa</th><th></th></tr>
          </thead>
          <tbody>
            {denoms.map((denom) => (
              <tr key={denom.id}>
                <td>{fmt(denom.valor, denom.moneda)}</td>
                <td>{denom.tipo}</td>
                <td>{denom.moneda}</td>
                <td>
                  <label className="row" style={{ gap: '0.4rem' }}>
                    <input type="checkbox" checked={denom.activo} onChange={() => toggleDenom(denom)} />
                    {denom.activo ? 'Si' : 'No'}
                  </label>
                </td>
                <td className="row-actions">
                  <button type="button" className="ghost danger" onClick={() => removeDenom(denom.id)}>
                    <Trash2 size={14} />
                    <span>Eliminar</span>
                  </button>
                </td>
              </tr>
            ))}
            {denoms.length === 0 && <tr><td colSpan="5">No hay denominaciones registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}
