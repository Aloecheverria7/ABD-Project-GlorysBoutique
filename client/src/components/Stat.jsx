import React from 'react';

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
