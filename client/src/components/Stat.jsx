/** @file Componente Stat: tarjeta que muestra una metrica con icono, etiqueta y valor. */
import React from 'react';

/**
 * Tarjeta de estadistica que muestra un icono junto a una etiqueta y su valor.
 *
 * @param {Object} props
 * @param {React.ComponentType<{size?: number}>} props.icon - Componente de icono a renderizar.
 * @param {string} props.label - Texto descriptivo de la metrica.
 * @param {string|number} props.value - Valor de la metrica a mostrar.
 * @returns {JSX.Element}
 */
export function Stat({ icon: Icon, label, value }) {
  return (
    <section className="stat">
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </section>
  );
}
