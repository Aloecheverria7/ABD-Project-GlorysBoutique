import React, { useState } from 'react';
import { CreditCard, Printer } from 'lucide-react';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { printReceipt } from '../utils/receipt.js';
import { DEFAULT_RATE } from '../constants.js';

export function Sales({ sales, user }) {
  const [reprintingId, setReprintingId] = useState(null);

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
                  <td>
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
    </section>
  );
}
