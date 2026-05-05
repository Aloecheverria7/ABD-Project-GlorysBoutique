import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

export function Configuration({ config, onUpdated }) {
  const [draft, setDraft] = useState(String(config.tasa_cambio_usd));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(String(config.tasa_cambio_usd));
  }, [config.tasa_cambio_usd]);

  async function submit(event) {
    event.preventDefault();
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un numero positivo.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.put('/config', { tasa_cambio_usd: parsed });
      onUpdated(updated);
      setMessage('Tasa de cambio actualizada.');
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

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar tasa'}
        </button>
      </form>
    </section>
  );
}
