import React, { useEffect, useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const emptyForm = { cliente_id: '', tipo_pago_id: '', monto: '', moneda: 'NIO', notas: '' };

export function Payments({ abonos, customers, paymentTypes, reload }) {
  const [form, setForm] = useState(emptyForm);
  const [filterCliente, setFilterCliente] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nonCreditTypes = useMemo(
    () => paymentTypes.filter((t) => !t.es_credito),
    [paymentTypes]
  );

  const customer = useMemo(
    () => customers.find((c) => String(c.id) === String(filterCliente)) || null,
    [customers, filterCliente]
  );

  const filteredAbonos = useMemo(() => {
    if (!filterCliente) return abonos;
    return abonos.filter((a) => String(a.cliente_id) === String(filterCliente));
  }, [abonos, filterCliente]);

  useEffect(() => {
    if (!filterCliente) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api.get(`/payments/customer/${filterCliente}`)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [filterCliente]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const payload = {
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      tipo_pago_id: form.tipo_pago_id ? Number(form.tipo_pago_id) : null,
      monto: form.monto,
      moneda: form.moneda,
      notas: form.notas
    };

    setSubmitting(true);
    try {
      const result = await api.post('/payments', payload);
      setMessage(`Abono #${result.id} registrado. Saldo NIO: ${fmt(result.balances?.saldo_nio || 0, 'NIO')} · USD: ${fmt(result.balances?.saldo_usd || 0, 'USD')}.`);
      setForm({ ...emptyForm, cliente_id: form.cliente_id });
      setFilterCliente(String(payload.cliente_id || ''));
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <HandCoins size={20} />
        <h2>Abonos a cuenta</h2>
      </div>
      <p className="muted small">
        Registra pagos parciales o totales de clientes con saldo pendiente. Los tipos de pago marcados
        como credito no estan disponibles aqui (solo se usan en ventas a fiado).
      </p>

      <form className="grid-form" onSubmit={submit}>
        <Field label="Cliente">
          <select
            required
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          >
            <option value="">Seleccionar cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {(c.saldo_nio > 0 || c.saldo_usd > 0)
                  ? ` · debe ${fmt(c.saldo_nio, 'NIO')} / ${fmt(c.saldo_usd, 'USD')}`
                  : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monto">
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
          />
        </Field>
        <Field label="Moneda">
          <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
            <option value="NIO">Cordobas (NIO)</option>
            <option value="USD">Dolares (USD)</option>
          </select>
        </Field>
        <Field label="Tipo de pago">
          <select
            required
            value={form.tipo_pago_id}
            onChange={(e) => setForm({ ...form, tipo_pago_id: e.target.value })}
          >
            <option value="">Seleccionar</option>
            {nonCreditTypes.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </Field>
        <Field label="Notas">
          <input
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Opcional (referencia, comentarios)"
          />
        </Field>

        {error && <div className="alert">{error}</div>}
        {message && <div className="loading">{message}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Registrando...' : 'Registrar abono'}
        </button>
      </form>

      <div className="row-between" style={{ marginTop: '1rem' }}>
        <div>
          <strong>Historial</strong>
          <p className="muted small">Filtra por cliente para ver su saldo y movimientos.</p>
        </div>
        <Field label="Filtrar por cliente">
          <select value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)}>
            <option value="">Todos</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
      </div>

      {customer && detail && (
        <div className="balance-cards">
          <div className="balance-card">
            <span>Saldo NIO</span>
            <strong className={detail.balances.saldo_nio > 0 ? 'is-debt' : ''}>
              {fmt(detail.balances.saldo_nio, 'NIO')}
            </strong>
            <small>
              Ventas fiadas: {fmt(detail.balances.ventas_credito_nio, 'NIO')} ·
              Abonos: {fmt(detail.balances.abonos_nio, 'NIO')}
            </small>
          </div>
          <div className="balance-card">
            <span>Saldo USD</span>
            <strong className={detail.balances.saldo_usd > 0 ? 'is-debt' : ''}>
              {fmt(detail.balances.saldo_usd, 'USD')}
            </strong>
            <small>
              Ventas fiadas: {fmt(detail.balances.ventas_credito_usd, 'USD')} ·
              Abonos: {fmt(detail.balances.abonos_usd, 'USD')}
            </small>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Moneda</th>
              <th>Monto</th>
              <th>Usuario</th>
              <th>Fecha</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {filteredAbonos.map((abono) => (
              <tr key={abono.id}>
                <td>#{abono.id}</td>
                <td>{abono.cliente || '-'}</td>
                <td>{abono.tipo_pago || '-'}</td>
                <td>{abono.moneda}</td>
                <td>{fmt(abono.monto, abono.moneda)}</td>
                <td>{abono.usuario || '-'}</td>
                <td>{new Date(abono.fecha).toLocaleString()}</td>
                <td className="muted small">{abono.notas || '-'}</td>
              </tr>
            ))}
            {filteredAbonos.length === 0 && <tr><td colSpan="8">No hay abonos para mostrar.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
