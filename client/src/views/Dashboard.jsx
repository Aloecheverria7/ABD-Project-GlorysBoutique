/** @file Vista de panel principal (dashboard) con estadisticas generales y ventas recientes. */
import React from 'react';
import { Boxes, CreditCard, ShoppingBag, Users } from 'lucide-react';
import { Stat } from '../components/Stat.jsx';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

/**
 * Vista de panel principal que muestra tarjetas con metricas (productos, clientes,
 * stock bajo, ingresos en NIO) y una tabla con las ventas recientes. Algunas metricas
 * solo se muestran para usuarios con rol de administrador.
 *
 * @param {Object} props
 * @param {{ inventory: Array<Object>, sales: Array<Object>, products: Array<Object>, customers: Array<Object> }} props.data - Datos agregados del sistema usados para calcular las metricas y listar ventas.
 * @param {{ username: string, rol: string }} props.user - Usuario en sesion; su rol determina que metricas se muestran.
 * @param {(viewId: string) => void} props.onNavigate - Navega al modulo indicado al hacer clic en una tarjeta.
 * @returns {JSX.Element}
 */
export function Dashboard({ data, user, onNavigate }) {
  const lowStock = data.inventory.filter((item) => item.cantidad <= 5).length;
  const revenueNIO = data.sales.reduce((sum, sale) => {
    const total = Number(sale.total);
    if (sale.moneda === 'USD') return sum + total * Number(sale.tasa_cambio || DEFAULT_RATE);
    return sum + total;
  }, 0);
  const recentSales = [...data.sales].slice(0, 5);
  const isAdmin = user.rol === 'admin';

  return (
    <>
      <section className="stats-grid">
        {isAdmin && (
          <Stat icon={ShoppingBag} label="Productos" value={data.products.length} onClick={() => onNavigate('products')} />
        )}
        <Stat icon={Users} label="Clientes" value={data.customers.length} onClick={() => onNavigate('customers')} />
        {isAdmin && (
          <Stat icon={Boxes} label="Stock bajo" value={lowStock} onClick={() => onNavigate('inventory')} />
        )}
        <Stat icon={CreditCard} label="Ventas (NIO)" value={fmt(revenueNIO, 'NIO')} onClick={() => onNavigate('sales')} />
      </section>

      <section className="panel">
        <div className="panel-title">
          <CreditCard size={20} />
          <h2>Ventas recientes</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Pago</th><th>Moneda</th><th>Total</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => {
                const moneda = sale.moneda || 'NIO';
                return (
                  <tr key={sale.id}>
                    <td>#{sale.id}</td>
                    <td>{sale.cliente || 'Cliente ocasional'}</td>
                    <td>{sale.tipo_pago || '-'}</td>
                    <td>{moneda}</td>
                    <td>{fmt(sale.total, moneda)}</td>
                    <td>{new Date(sale.fecha).toLocaleString()}</td>
                  </tr>
                );
              })}
              {recentSales.length === 0 && <tr><td colSpan="6">Aun no hay ventas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
