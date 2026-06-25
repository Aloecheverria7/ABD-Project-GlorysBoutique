/** @file Componente Modal reutilizable: ventana emergente con titulo, boton de cierre y contenido. */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Ventana emergente (modal) centrada con fondo oscurecido. Se cierra al hacer clic en el fondo,
 * en el boton de cierre o al presionar Escape.
 *
 * @param {Object} props
 * @param {string} props.title - Titulo mostrado en la cabecera del modal.
 * @param {() => void} props.onClose - Callback para cerrar el modal.
 * @param {React.ReactNode} props.children - Contenido del modal.
 * @returns {JSX.Element}
 */
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    /**
     * Cierra el modal cuando se presiona la tecla Escape.
     *
     * @param {KeyboardEvent} event - Evento de teclado.
     * @returns {void}
     */
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
