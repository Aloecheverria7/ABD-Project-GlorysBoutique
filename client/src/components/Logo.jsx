import React, { useState } from 'react';

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
