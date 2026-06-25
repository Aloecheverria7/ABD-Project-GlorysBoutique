/**
 * @file Vista del modulo de perdidas. Registra productos perdidos (deterioro, robo, merma, otro),
 * calcula el gasto al costo capturado, descuenta inventario y muestra el historial con el total de egreso.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { Modal } from '../components/Modal.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

const MOTIVOS = ['deterioro', 'robo', 'merma', 'otro'];
const emptyForm = { cantidad: '', costo_unitario: '', motivo: 'deterioro' };

/**
 * Vista de perdidas: busca una variante, registra la perdida (cantidad, costo y motivo) y lista el
 * historial con el gasto total. Cada registro descuenta inventario y queda en el Kardex.
 *
 * @param {Object} props
 * @param {Array<Object>} props.variants - Variantes de producto con su stock actual.
 * @param {Function} props.reload - Recarga los datos globales (inventario, dashboard) tras registrar.
 * @returns {JSX.Element}
 */
export function Perdidas({ variants, reload }) {
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [losses, setLosses] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  /**
   * Carga el historial de perdidas y el total de gasto desde el servidor.
   *
   * @returns {Promise<void>}
   */
  async function loadLosses() {
    try {
      const data = await api.get('/losses');
      setLosses(data.perdidas);
      setTotal(data.total_gasto);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadLosses();
  }, []);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) => `${v.producto || ''} ${v.color || ''} ${v.talla || ''}`.toLowerCase().includes(q));
  }, [variants, search]);

  /**
   * Abre el formulario de perdida para una variante, sugiriendo su costo si esta disponible.
   *
   * @param {Object} variant - Variante seleccionada.
   * @returns {void}
   */
  function openLoss(variant) {
    setTarget(variant);
    setForm(emptyForm);
    setError('');
  }

  /**
   * Registra la perdida capturada.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api.post('/losses', {
        producto_variante_id: target.id,
        cantidad: Number(form.cantidad),
        costo_unitario: Number(form.costo_unitario),
        motivo: form.motivo
      });
      setTarget(null);
      loadLosses();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const costoTotalPreview = (Number(form.cantidad) || 0) * (Number(form.costo_unitario) || 0);

  return (
    <section className="panel">
      <div className="panel-title">
        <TrendingDown size={20} />
        <h2>Perdidas</h2>
      </div>
      <p className="muted small">
        Registra productos perdidos por deterioro, robo o merma. El gasto se calcula al costo
        capturado, descuenta inventario y se refleja como egreso de tipo perdida.
      </p>

      <div className="report-summary row" style={{ flexWrap: 'wrap', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <span>Gasto total por perdidas: <strong className="is-debt">{fmt(total, 'NIO')}</strong></span>
        <span><strong>{losses.length}</strong> registro(s)</span>
      </div>

      <div className="toolbar">
        <span className="spacer" />
        <input placeholder="Buscar producto, color o talla..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Color</th><th>Talla</th><th>Stock</th><th></th></tr>
          </thead>
          <tbody>
            {filteredVariants.map((variant) => (
              <tr key={variant.id}>
                <td>{variant.producto}</td>
                <td>{variant.color || '-'}</td>
                <td>{variant.talla || '-'}</td>
                <td>{variant.cantidad}</td>
                <td className="row-actions">
                  <button type="button" className="ghost danger" onClick={() => openLoss(variant)}>Registrar perdida</button>
                </td>
              </tr>
            ))}
            {filteredVariants.length === 0 && <tr><td colSpan="5">No hay coincidencias.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel-title" style={{ marginTop: '1rem' }}>
        <TrendingDown size={18} />
        <h2>Historial de perdidas</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Costo unit.</th><th>Gasto</th><th>Motivo</th><th>Usuario</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {losses.map((p) => (
              <tr key={p.id}>
                <td>{p.producto} {[p.color, p.talla].filter(Boolean).join(' / ')}</td>
                <td>{p.cantidad}</td>
                <td>{fmt(p.costo_unitario, 'NIO')}</td>
                <td className="is-debt">{fmt(p.costo_total, 'NIO')}</td>
                <td>{p.motivo}</td>
                <td>{p.usuario || '-'}</td>
                <td>{new Date(p.fecha).toLocaleString()}</td>
              </tr>
            ))}
            {losses.length === 0 && <tr><td colSpan="7">Aun no hay perdidas registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <Modal
          title={`Registrar perdida — ${target.producto} ${[target.color, target.talla].filter(Boolean).join(' / ')}`}
          onClose={() => setTarget(null)}
        >
          <form className="grid-form" onSubmit={submit}>
            <Field label="Cantidad perdida">
              <input type="number" min="1" step="1" required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </Field>
            <Field label="Costo unitario (NIO)">
              <input type="number" min="0" step="0.01" required value={form.costo_unitario} onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })} />
            </Field>
            <Field label="Motivo">
              <select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <div className="pos-total">
              <span>Gasto por perdida</span>
              <strong>{fmt(costoTotalPreview, 'NIO')}</strong>
            </div>
            <small className="muted">Stock disponible: {target.cantidad} unidad(es).</small>
            <div className="row">
              <button type="submit">Registrar perdida</button>
              <button type="button" className="ghost" onClick={() => setTarget(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
