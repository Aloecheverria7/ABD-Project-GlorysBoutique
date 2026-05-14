import React, { useState } from 'react';
import { CreditCard, Eye } from 'lucide-react';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';

export function PurchaseHistory({ purchases }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openDetail(id) {
    setLoading(true);
    setError('');
    try {
      const detail = await api.get(`/purchases/${id}`);
      setSelected(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CreditCard size={20} />
        <h2>Historial de compras</h2>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Proveedor</th>
              <th>Usuario</th>
              <th>Moneda</th>
              <th>Total</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => {
              const moneda = purchase.moneda || 'NIO';
              return (
                <tr key={purchase.id}>
                  <td>#{purchase.id}</td>
                  <td>{purchase.proveedor || '-'}</td>
                  <td>{purchase.usuario || '-'}</td>
                  <td>{moneda}</td>
                  <td>{fmt(purchase.total, moneda)}</td>
                  <td>{new Date(purchase.fecha).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => openDetail(purchase.id)}
                      disabled={loading}
                    >
                      <Eye size={14} />
                      <span>Detalle</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {purchases.length === 0 && <tr><td colSpan="7">Aun no hay compras registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <div className="row-between">
            <h3>Compra #{selected.id} · {selected.proveedor}</h3>
            <button type="button" className="ghost" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <p className="muted small">
            {new Date(selected.fecha).toLocaleString()} · {selected.usuario || 'usuario desconocido'}
            {selected.notas && <> · {selected.notas}</>}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th>Cantidad</th>
                  <th>Costo unit.</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(selected.details || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.producto || '-'}</td>
                    <td>{item.color || '-'}</td>
                    <td>{item.talla || '-'}</td>
                    <td>{item.cantidad}</td>
                    <td>{fmt(item.costo_unitario, selected.moneda || 'NIO')}</td>
                    <td>{fmt(item.cantidad * item.costo_unitario, selected.moneda || 'NIO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pos-total">
            <span>Total</span>
            <strong>{fmt(selected.total, selected.moneda || 'NIO')}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
