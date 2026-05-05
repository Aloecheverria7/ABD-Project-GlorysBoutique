import { DEFAULT_RATE } from '../constants.js';
import { fmt } from './format.js';

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptHTML(sale) {
  const moneda = sale.moneda || 'NIO';
  const rate = Number(sale.tasa_cambio || DEFAULT_RATE);
  const totalDisplay = Number(sale.total);
  const altCurrency = moneda === 'USD' ? 'NIO' : 'USD';
  const totalAlt = moneda === 'USD' ? totalDisplay * rate : totalDisplay / rate;

  const itemsHTML = sale.items.map((item) => {
    const unit = Number(item.precio_unitario);
    const subtotal = Number(item.cantidad) * unit;
    const variantInfo = [item.color, item.talla].filter(Boolean).join(' / ');
    return `
      <tr>
        <td>
          ${escapeHTML(item.producto)}
          ${variantInfo ? `<div class="muted">${escapeHTML(variantInfo)}</div>` : ''}
        </td>
        <td class="num">${item.cantidad}</td>
        <td class="num">${fmt(unit, moneda)}</td>
        <td class="num">${fmt(subtotal, moneda)}</td>
      </tr>
    `;
  }).join('');

  const fecha = sale.fecha ? new Date(sale.fecha).toLocaleString() : new Date().toLocaleString();
  const equivalencia = `Equivalente: ${fmt(totalAlt, altCurrency)} (Tasa C$${rate.toFixed(4)} = US$1)`;
  const logoUrl = `${window.location.origin}/logo.png`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo #${sale.id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px;
    margin: 0;
    padding: 6px 8px;
    width: 80mm;
    color: #000;
  }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  .logo { display: block; margin: 0 auto 4px; max-height: 56px; max-width: 60mm; }
  .logo-fallback {
    border: 1px dashed #000;
    color: #000;
    display: block;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.1em;
    margin: 0 auto 4px;
    padding: 6px 12px;
    text-align: center;
    width: max-content;
  }
  .muted { color: #444; font-size: 10px; }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { font-size: 11px; padding: 1px 0; text-align: left; vertical-align: top; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  .total { font-size: 14px; font-weight: bold; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <img src="${escapeHTML(logoUrl)}" alt="Logo" class="logo" onerror="this.outerHTML='&lt;span class=&quot;logo-fallback&quot;&gt;LOGO&lt;/span&gt;'">
  <h1>Glory's Boutique</h1>
  <p class="center muted">Recibo de venta</p>
  <div class="line"></div>
  <div class="row"><span>Folio:</span><strong>#${sale.id}</strong></div>
  <div class="row"><span>Fecha:</span><span>${escapeHTML(fecha)}</span></div>
  <div class="row"><span>Cajero:</span><span>${escapeHTML(sale.cajero || '-')}</span></div>
  <div class="row"><span>Cliente:</span><span>${escapeHTML(sale.cliente || 'Cliente ocasional')}</span></div>
  <div class="row"><span>Moneda:</span><span>${escapeHTML(moneda)}</span></div>
  <div class="line"></div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="num">Cant</th>
        <th class="num">P.U.</th>
        <th class="num">Subt</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="line"></div>
  <div class="row total"><span>TOTAL</span><span>${fmt(totalDisplay, moneda)}</span></div>
  <div class="row"><span>Pago:</span><span>${escapeHTML(sale.tipo_pago || '-')}</span></div>
  <p class="muted center">${equivalencia}</p>
  <div class="line"></div>
  <p class="center">Gracias por su compra</p>
  <p class="center muted">${escapeHTML(new Date().toLocaleString())}</p>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
      setTimeout(() => window.close(), 300);
    });
  </script>
</body>
</html>`;
}

export function printReceipt(sale) {
  const win = window.open('', '_blank', 'width=360,height=640');
  if (!win) {
    alert('Habilita ventanas emergentes para imprimir el recibo.');
    return;
  }
  win.document.open();
  win.document.write(buildReceiptHTML(sale));
  win.document.close();
}
