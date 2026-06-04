/** @file Componente Logo: muestra el logotipo y cae a un marcador si la imagen falla. */
import React, { useState } from 'react';

/**
 * Muestra el logotipo de la aplicacion. Si la imagen no carga, renderiza un
 * marcador de posicion con el texto LOGO.
 *
 * @param {Object} props
 * @param {number} [props.size=40] - Ancho y alto en pixeles del logotipo.
 * @param {'light'|'dark'} [props.variant='light'] - Variante de estilo del marcador de posicion.
 * @returns {JSX.Element}
 */
export function Logo({ size = 40, variant = 'light' }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`logo-placeholder logo-placeholder--${variant}`}
        style={{ width: size, height: size }}
        aria-label="Logo"
      >
        LOGO
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="Logo"
      className="logo-img"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
