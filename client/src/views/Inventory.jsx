/**
 * @file Vista de inventario: buscar variantes, registrar movimientos de stock (ingreso/salida/ajuste)
 * con su motivo y Kardex, dar de alta variantes (incluyendo pacas) y consultar el historial de Kardex.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, History, Plus } from 'lucide-react';
import { Field } from '../components/Field.jsx';
import { Modal } from '../components/Modal.jsx';
import { api } from '../api.js';

const emptyVariant = { producto_id: '', color: '', talla: '', unidad: 'unidad', piezas_por_paca: '', cantidad: '' };
const emptyMov = { tipo: 'ingreso', cantidad: '', unidad: 'unidad', piezas_por_paca: '', motivo: '' };

/**
 * Vista de inventario. Permite buscar una variante antes de operar sobre ella: el formulario de
 * movimiento aparece tras pulsar "Movimiento" en la fila. Soporta pacas (se explotan en unidades),
 * el alta de variantes y la consulta del historial de Kardex.
 *
 * @param {Object} props
 * @param {Array<Object>} props.products - Productos disponibles para crear variantes.
 * @param {Array<Object>} props.variants - Variantes existentes (para saber si hay registros).
 * @param {Array<Object>} props.inventory - Lineas de inventario con cantidad por variante.
 * @param {Function} props.reload - Recarga los datos tras una operacion.
 * @returns {JSX.Element}
 */
export function Inventory({ products, variants, inventory, reload }) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [variantModal, setVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [movTarget, setMovTarget] = useState(null);
  const [movForm, setMovForm] = useState(emptyMov);
  const [kardex, setKardex] = useState([]);
  const [showKardex, setShowKardex] = useState(false);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((item) => `${item.producto || ''} ${item.color || ''} ${item.talla || ''}`.toLowerCase().includes(q));
  }, [inventory, search]);

  /**
   * Carga el historial de Kardex desde el servidor.
   *
   * @returns {Promise<void>}
   */
  async function loadKardex() {
    try {
      setKardex(await api.get('/inventory/kardex'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (showKardex) loadKardex();
  }, [showKardex]);

  /**
   * Crea una variante (con su unidad y piezas por paca) e inicializa su inventario.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario de variante.
   * @returns {Promise<void>}
   */
  async function addVariant(event) {
    event.preventDefault();
    setError('');
    try {
      await api.post(`/products/${variantForm.producto_id}/variants`, {
        color: variantForm.color || null,
        talla: variantForm.talla || null,
        unidad: variantForm.unidad,
        piezas_por_paca: variantForm.unidad === 'paca' ? Number(variantForm.piezas_por_paca) || 1 : 1,
        cantidad: variantForm.cantidad === '' ? 0 : Number(variantForm.cantidad)
      });
      setVariantForm(emptyVariant);
      setVariantModal(false);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  /**
   * Abre el formulario de movimiento para una linea de inventario.
   *
   * @param {Object} item - Linea de inventario seleccionada.
   * @returns {void}
   */
  function openMovimiento(item) {
    setMovTarget(item);
    setMovForm(emptyMov);
    setError('');
  }

  /**
   * Registra el movimiento de inventario (ingreso/salida/ajuste) capturado.
   *
   * @param {React.FormEvent} event - Evento de envio del formulario de movimiento.
   * @returns {Promise<void>}
   */
  async function submitMovimiento(event) {
    event.preventDefault();
    setError('');
    try {
      await api.post('/inventory/movimientos', {
        producto_variante_id: movTarget.producto_variante_id,
        tipo: movForm.tipo,
        cantidad: Number(movForm.cantidad),
        unidad: movForm.unidad,
        piezas_por_paca: movForm.unidad === 'paca' ? Number(movForm.piezas_por_paca) || 1 : 1,
        motivo: movForm.motivo || null
      });
      setMovTarget(null);
      if (showKardex) loadKardex();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Boxes size={20} />
        <h2>Inventario</h2>
      </div>
      <p className="muted small">
        Busca un producto y pulsa <strong>Movimiento</strong> para registrar un ingreso, salida o
        ajuste. Cada movimiento queda registrado en el Kardex. Las pacas se explotan en unidades.
      </p>

      <div className="toolbar">
        <button type="button" onClick={() => { setVariantForm(emptyVariant); setError(''); setVariantModal(true); }}>
          <Plus size={14} />
          <span>Agregar variante</span>
        </button>
        <button type="button" className="ghost" onClick={() => setShowKardex((v) => !v)}>
          <History size={14} />
          <span>{showKardex ? 'Ocultar Kardex' : 'Ver Kardex'}</span>
        </button>
        <span className="spacer" />
        <input placeholder="Buscar producto, color o talla..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th>Color</th><th>Talla</th><th>Cantidad</th><th></th></tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.producto_variante_id}>
                <td>{item.producto}</td>
                <td>{item.color || '-'}</td>
                <td>{item.talla || '-'}</td>
                <td>{item.cantidad}</td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => openMovimiento(item)}>
                    Movimiento
                  </button>
                </td>
              </tr>
            ))}
            {filteredInventory.length === 0 && (
              <tr><td colSpan="5">{variants.length === 0 ? 'No hay variantes todavia.' : 'No hay coincidencias.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showKardex && (
        <>
          <div className="panel-title" style={{ marginTop: '1rem' }}>
            <History size={18} />
            <h2>Historial de Kardex</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Usuario</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {kardex.map((mov) => (
                  <tr key={mov.id}>
                    <td>{mov.producto} {[mov.color, mov.talla].filter(Boolean).join(' / ')}</td>
                    <td>{mov.tipo}</td>
                    <td>{mov.cantidad}</td>
                    <td>{mov.motivo || '-'}</td>
                    <td>{mov.usuario || '-'}</td>
                    <td>{new Date(mov.fecha).toLocaleString()}</td>
                  </tr>
                ))}
                {kardex.length === 0 && <tr><td colSpan="6">Sin movimientos de Kardex.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {variantModal && (
        <Modal title="Agregar variante" onClose={() => setVariantModal(false)}>
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
            <Field label="Unidad">
              <select value={variantForm.unidad} onChange={(e) => setVariantForm({ ...variantForm, unidad: e.target.value })}>
                <option value="unidad">Unidad</option>
                <option value="paca">Paca</option>
              </select>
            </Field>
            {variantForm.unidad === 'paca' && (
              <Field label="Piezas por paca">
                <input type="number" min="1" step="1" value={variantForm.piezas_por_paca} onChange={(e) => setVariantForm({ ...variantForm, piezas_por_paca: e.target.value })} />
              </Field>
            )}
            <Field label="Stock inicial (unidades)">
              <input type="number" min="0" step="1" value={variantForm.cantidad} onChange={(e) => setVariantForm({ ...variantForm, cantidad: e.target.value })} />
            </Field>
            <div className="row">
              <button type="submit">Guardar variante</button>
              <button type="button" className="ghost" onClick={() => setVariantModal(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {movTarget && (
        <Modal
          title={`Movimiento — ${movTarget.producto} ${[movTarget.color, movTarget.talla].filter(Boolean).join(' / ')}`}
          onClose={() => setMovTarget(null)}
        >
          <form className="grid-form" onSubmit={submitMovimiento}>
            <Field label="Tipo de movimiento">
              <select value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}>
                <option value="ingreso">Ingreso (suma)</option>
                <option value="salida">Salida (resta)</option>
                <option value="ajuste">Ajuste (fija cantidad)</option>
              </select>
            </Field>
            <Field label="Unidad de captura">
              <select value={movForm.unidad} onChange={(e) => setMovForm({ ...movForm, unidad: e.target.value })}>
                <option value="unidad">Unidades</option>
                <option value="paca">Pacas</option>
              </select>
            </Field>
            {movForm.unidad === 'paca' && (
              <Field label="Piezas por paca">
                <input type="number" min="1" step="1" value={movForm.piezas_por_paca} onChange={(e) => setMovForm({ ...movForm, piezas_por_paca: e.target.value })} />
              </Field>
            )}
            <Field label={movForm.unidad === 'paca' ? 'Cantidad de pacas' : 'Cantidad'}>
              <input type="number" min="0" step="1" required value={movForm.cantidad} onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })} />
            </Field>
            <Field label="Motivo">
              <input value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} placeholder="Ej. compra, conteo, correccion" />
            </Field>
            <div className="row">
              <button type="submit">Registrar movimiento</button>
              <button type="button" className="ghost" onClick={() => setMovTarget(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
