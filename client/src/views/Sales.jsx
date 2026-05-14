import React, { useState } from 'react';
import { CreditCard, Eye, Printer } from 'lucide-react';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { printReceipt } from '../utils/receipt.js';
import { DEFAULT_RATE } from '../constants.js';

export function Sales({ sales, user }) {
  const [reprintingId, setReprintingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  async function openDetail(id) {
    setLoadingDetail(true);
    setError('');
    try {
      const sale = await api.get(`/sales/${id}`);
      setSelected(sale);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function reprint(saleId) {
    setReprintingId(saleId);
    try {
      const sale = await api.get(`/sales/${saleId}`);
      printReceipt({
        id: sale.id,
        total: sale.total,
        moneda: sale.moneda || 'NIO',
        tasa_cambio: sale.tasa_cambio || DEFAULT_RATE,
        fecha: sale.fecha,
        cajero: sale.usuario || user.username,
        cliente: sale.cliente,
        tipo_pago: sale.tipo_pago,
        items: (sale.details || []).map((d) => ({
          producto: d.producto,
          color: d.color,
          talla: d.talla,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario
        }))
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setReprintingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CreditCard size={20} />
        <h2>Historial de ventas</h2>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Cliente</th><th>Usuario</th><th>Pago</th><th>Moneda</th><th>Total</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const moneda = sale.moneda || 'NIO';
              return (
                <tr key={sale.id}>
                  <td>#{sale.id}</td>
                  <td>{sale.cliente || 'Cliente ocasional'}</td>
                  <td>{sale.usuario || '-'}</td>
                  <td>{sale.tipo_pago || '-'}</td>
                  <td>{moneda}</td>
                  <td>{fmt(sale.total, moneda)}</td>
                  <td>{new Date(sale.fecha).toLocaleString()}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => openDetail(sale.id)}
                      disabled={loadingDetail}
                    >
                      <Eye size={14} />
                      <span>Detalle</span>
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => reprint(sale.id)}
                      disabled={reprintingId === sale.id}
                    >
                      <Printer size={14} />
                      <span>{reprintingId === sale.id ? '...' : 'Imprimir'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {sales.length === 0 && <tr><td colSpan="8">Aun no hay ventas registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <div className="row-between">
            <h3>Venta #{selected.id} · {selected.cliente || 'Cliente ocasional'}</h3>
            <button type="button" className="ghost" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <p className="muted small">
            {new Date(selected.fecha).toLocaleString()} · {selected.usuario || 'usuario desconocido'}
            {selected.tipo_pago && <> · {selected.tipo_pago}</>}
            {selected.moneda === 'USD' && selected.tasa_cambio && <> · Tasa {fmt(selected.tasa_cambio, 'NIO')}</>}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th>Cantidad</th>
                  <th>Precio unit.</th>
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
                    <td>{fmt(item.precio_unitario, selected.moneda || 'NIO')}</td>
                    <td>{fmt(item.cantidad * item.precio_unitario, selected.moneda || 'NIO')}</td>
                  </tr>
                ))}
                {(selected.details || []).length === 0 && (
                  <tr><td colSpan="6">Sin detalle.</td></tr>
                )}
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
