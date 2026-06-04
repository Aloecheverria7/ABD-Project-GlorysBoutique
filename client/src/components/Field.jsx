/** @file Componente Field: envoltorio de campo de formulario con etiqueta. */
import React from 'react';

/**
 * Campo de formulario que asocia una etiqueta con el control que recibe como hijo.
 *
 * @param {Object} props
 * @param {string} props.label - Texto de la etiqueta del campo.
 * @param {React.ReactNode} props.children - Control de formulario asociado a la etiqueta.
 * @returns {JSX.Element}
 */
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
