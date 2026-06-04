/** @file Vista de inventario: alta de variantes de producto y ajuste de existencias. */
import React, { useState } from 'react';
import { Boxes } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { api } from '../api.js';

/**
 * Vista de inventario que permite crear variantes de producto (color, talla y stock
 * inicial) y ajustar la cantidad en existencia de cada variante registrada.
 *
 * @param {Object} props
 * @param {Array<Object>} props.products - Productos disponibles para crear variantes.
 * @param {Array<Object>} props.variants - Variantes existentes; usado para detectar si hay registros.
 * @param {Array<Object>} props.inventory - Lineas de inventario con cantidad por variante.
 * @param {Function} props.reload - Funcion que recarga los datos tras una operacion.
 * @returns {JSX.Element}
 */
export function Inventory({ products, variants, inventory, reload }) {
  const [variantForm, setVariantForm] = useState({ producto_id: '', color: '', talla: '', cantidad: '' });
  const [stockDrafts, setStockDrafts] = useState({});

  /**
   * Crea una nueva variante para el producto seleccionado, limpia el formulario y
   * recarga los datos.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function addVariant(event) {
    event.preventDefault();
    await api.post(`/products/${variantForm.producto_id}/variants`, variantForm);
    setVariantForm({ producto_id: '', color: '', talla: '', cantidad: '' });
    reload();
  }

  /**
   * Actualiza la cantidad en existencia de una variante con el valor capturado en el
   * borrador y recarga los datos.
   *
   * @param {number} variantId - Identificador de la variante a ajustar.
   * @returns {Promise<void>}
   */
  async function updateStock(variantId) {
    await api.put(`/inventory/${variantId}`, { cantidad: stockDrafts[variantId] });
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Boxes size={20} />
        <h2>Inventario</h2>
      </div>
      <form className="grid-form" onSubmit={addVariant}>
        <Field label="Producto">
          <select required value={variantForm.producto_id} onChange={(e) => setVariantForm({ ...variantForm, producto_id: e.target.value })}>
            <option value="">Seleccionar</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
          </select>
        </Field>
        <Field label="Color">
          <input value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} />
        </Field>
        <Field label="Talla">
          <input value={variantForm.talla} onChange={(e) => setVariantForm({ ...variantForm, talla: e.target.value })} />
        </Field>
        <Field label="Stock inicial">
          <input type="number" value={variantForm.cantidad} onChange={(e) => setVariantForm({ ...variantForm, cantidad: e.target.value })} />
        </Field>
        <button type="submit">Agregar variante</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Color</th><th>Talla</th><th>Cantidad</th><th>Ajuste</th></tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.producto_variante_id}>
                <td>{item.producto}</td>
                <td>{item.color || '-'}</td>
                <td>{item.talla || '-'}</td>
                <td>{item.cantidad}</td>
                <td className="inline-edit">
                  <input
                    type="number"
                    placeholder={String(item.cantidad)}
                    value={stockDrafts[item.producto_variante_id] ?? ''}
                    onChange={(e) => setStockDrafts({ ...stockDrafts, [item.producto_variante_id]: e.target.value })}
                  />
                  <button type="button" onClick={() => updateStock(item.producto_variante_id)}>Actualizar</button>
                </td>
              </tr>
            ))}
            {variants.length === 0 && <tr><td colSpan="5">No hay variantes todavia.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
