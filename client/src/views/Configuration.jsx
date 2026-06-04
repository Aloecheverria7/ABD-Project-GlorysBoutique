/** @file Vista de configuracion del sistema: tasa de cambio USD y monto de caja base. */
import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

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

  useEffect(() => {
    setDraft(String(config.tasa_cambio_usd));
  }, [config.tasa_cambio_usd]);

  useEffect(() => {
    setCajaDraft(String(config.caja_base ?? 0));
  }, [config.caja_base]);

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
  );
}
