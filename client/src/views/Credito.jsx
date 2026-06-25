/**
 * @file Vista del modulo de credito. Muestra el roster de clientes con credito activo: monto total,
 * total abonado, cantidad de abonos, restante por pagar y el plan de cuotas adjunto a cada deuda.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CreditCard } from 'lucide-react';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

/**
 * Vista de creditos activos. Carga el roster desde /api/credit y permite filtrarlo por cliente
 * (nombre o cedula) y expandir cada cliente para ver sus deudas y el plan de cuotas.
 *
 * @returns {JSX.Element}
 */
export function Credito() {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    api.get('/credit')
      .then((data) => { if (!cancelled) { setRoster(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((c) => `${c.cliente || ''} ${c.cedula || ''}`.toLowerCase().includes(q));
  }, [roster, search]);

  /**
   * Alterna el detalle expandido de un cliente.
   *
   * @param {number} clienteId - Identificador del cliente.
   * @returns {void}
   */
  function toggle(clienteId) {
    setExpanded((current) => ({ ...current, [clienteId]: !current[clienteId] }));
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CreditCard size={20} />
        <h2>Creditos activos</h2>
      </div>
      <p className="muted small">
        Clientes con saldo de credito pendiente. Cada cliente muestra su monto total, lo abonado,
        la cantidad de abonos y lo restante, con el plan de cuotas adjunto a cada venta a credito.
      </p>

      <input
        className="pos-search"
        placeholder="Buscar por cliente o cedula..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="alert">{error}</div>}
      {loading && <div className="loading">Cargando creditos...</div>}

      {!loading && filtered.length === 0 && (
        <p className="pos-empty">No hay clientes con credito activo.</p>
      )}

      <div className="credit-list">
        {filtered.map((cliente) => {
          const monedas = Object.entries(cliente.totales);
          const open = !!expanded[cliente.cliente_id];
          return (
            <div className="credit-card" key={cliente.cliente_id}>
              <button type="button" className="credit-head" onClick={() => toggle(cliente.cliente_id)}>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="credit-head-main">
                  <strong>{cliente.cliente || 'Cliente'}</strong>
                  {cliente.cedula && <small className="muted"> · {cliente.cedula}</small>}
                </div>
                <div className="credit-head-totals">
                  {monedas.map(([moneda, t]) => (
                    <span key={moneda} className="is-debt">
                      Debe {fmt(t.restante, moneda)}
                    </span>
                  ))}
                </div>
              </button>

              {open && (
                <div className="credit-body">
                  {monedas.map(([moneda, t]) => (
                    <div className="credit-summary" key={moneda}>
                      <span>Total ({moneda}): <strong>{fmt(t.monto_total, moneda)}</strong></span>
                      <span>Abonado: <strong>{fmt(t.abonado, moneda)}</strong></span>
                      <span>Abonos: <strong>{t.num_abonos}</strong></span>
                      <span>Restante: <strong className="is-debt">{fmt(t.restante, moneda)}</strong></span>
                    </div>
                  ))}

                  {cliente.deudas.map((deuda) => (
                    <div className="credit-debt" key={deuda.id}>
                      <div className="row-between">
                        <strong>Venta #{deuda.venta_id}</strong>
                        <small className="muted">{new Date(deuda.fecha).toLocaleDateString()}</small>
                      </div>
                      <div className="credit-summary">
                        <span>Total: <strong>{fmt(deuda.monto_total, deuda.moneda)}</strong></span>
                        <span>Abonado: <strong>{fmt(deuda.abonado, deuda.moneda)}</strong></span>
                        <span>Restante: <strong className="is-debt">{fmt(deuda.restante, deuda.moneda)}</strong></span>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Cuota</th><th>Monto</th><th>Estado</th><th>Vence</th></tr>
                          </thead>
                          <tbody>
                            {deuda.cuotas.map((cuota) => (
                              <tr key={cuota.numero}>
                                <td>#{cuota.numero}</td>
                                <td>{fmt(cuota.monto, deuda.moneda)}</td>
                                <td>{cuota.estado}</td>
                                <td>{cuota.fecha_vencimiento || '-'}</td>
                              </tr>
                            ))}
                            {deuda.cuotas.length === 0 && (
                              <tr><td colSpan="4">Sin plan de cuotas.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
