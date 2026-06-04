/** @file Vista de historial de ventas con filtro por rango de fechas, totales por moneda, detalle y reimpresion de recibos. */
import React, { useState } from 'react';
import { CreditCard, Eye, Printer } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';
import { fmt } from '../utils/format.js';
import { printReceipt } from '../utils/receipt.js';
import { DEFAULT_RATE } from '../constants.js';

/**
 * Convierte una fecha a una cadena local en formato AAAA-MM-DD ajustando el desfase
 * de zona horaria. Devuelve cadena vacia si el valor no es una fecha valida.
 *
 * @param {string|number|Date} value - Valor de fecha a convertir.
 * @returns {string} Fecha local en formato AAAA-MM-DD o cadena vacia.
 */
function toLocalDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Devuelve la fecha de hoy en formato local AAAA-MM-DD.
 *
 * @returns {string} Fecha de hoy en formato AAAA-MM-DD.
 */
function todayLocal() {
  return toLocalDate(new Date());
}

/**
 * Vista de historial de ventas que permite filtrar por rango de fechas, muestra
 * totales acumulados por moneda, abre el detalle de una venta y reimprime el recibo.
 *
 * @param {Object} props
 * @param {Array<Object>} props.sales - Lista de ventas registradas a mostrar.
 * @param {{ username: string, rol: string }} props.user - Usuario en sesion, usado como cajero de respaldo al reimprimir.
 * @returns {JSX.Element}
 */
export function Sales({ sales, user }) {
  const [reprintingId, setReprintingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const filteredSales = sales.filter((sale) => {
    const fecha = toLocalDate(sale.fecha);
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
    return true;
  });

  const totales = filteredSales.reduce(
    (acc, sale) => {
      const moneda = sale.moneda || 'NIO';
      acc[moneda] = (acc[moneda] || 0) + Number(sale.total || 0);
      return acc;
    },
    {}
  );

  /**
   * Ajusta el filtro de fechas para mostrar unicamente las ventas del dia de hoy.
   *
   * @returns {void}
   */
  function setHoy() {
    const hoy = todayLocal();
    setDesde(hoy);
    setHasta(hoy);
  }

  /**
   * Limpia el filtro de fechas mostrando todas las ventas.
   *
   * @returns {void}
   */
  function limpiarFiltro() {
    setDesde('');
    setHasta('');
  }

  /**
   * Solicita al servidor el detalle de una venta y lo carga para mostrarlo en el panel.
   *
   * @param {number} id - Identificador de la venta a consultar.
   * @returns {Promise<void>}
   */
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

  /**
   * Obtiene del servidor los datos de una venta y reimprime su recibo.
   *
   * @param {number} saleId - Identificador de la venta a reimprimir.
   * @returns {Promise<void>}
   */
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

      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
        <Field label="Desde">
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <button type="button" className="ghost" onClick={setHoy}>Hoy</button>
        {(desde || hasta) && (
          <button type="button" className="ghost" onClick={limpiarFiltro}>Limpiar</button>
        )}
      </div>

      <div className="report-summary row" style={{ flexWrap: 'wrap', gap: '1.5rem', margin: '0.75rem 0' }}>
        <span><strong>{filteredSales.length}</strong> venta(s)</span>
        <span>Total NIO: <strong>{fmt(totales.NIO || 0, 'NIO')}</strong></span>
        {totales.USD ? <span>Total USD: <strong>{fmt(totales.USD, 'USD')}</strong></span> : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Cliente</th><th>Usuario</th><th>Pago</th><th>Moneda</th><th>Total</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => {
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
            {filteredSales.length === 0 && (
              <tr><td colSpan="8">
                {sales.length === 0 ? 'Aun no hay ventas registradas.' : 'No hay ventas en el rango seleccionado.'}
              </td></tr>
            )}
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
