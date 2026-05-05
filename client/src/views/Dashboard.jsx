import React from 'react';
import { Boxes, CreditCard, ShoppingBag, Users } from 'lucide-react';
import { Stat } from '../components/Stat.jsx';
import { fmt } from '../utils/format.js';
import { DEFAULT_RATE } from '../constants.js';

export function Dashboard({ data, user }) {
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
        {isAdmin && <Stat icon={ShoppingBag} label="Productos" value={data.products.length} />}
        <Stat icon={Users} label="Clientes" value={data.customers.length} />
        {isAdmin && <Stat icon={Boxes} label="Stock bajo" value={lowStock} />}
        <Stat icon={CreditCard} label="Ventas (NIO)" value={fmt(revenueNIO, 'NIO')} />
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
