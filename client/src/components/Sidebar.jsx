/** @file Componente Sidebar: barra lateral de navegacion con menu por rol y datos de sesion. */
import React from 'react';
import { LogOut } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { visibleMenu } from '../utils/menu.js';

/**
 * Barra lateral de navegacion que muestra el menu visible segun el rol del usuario,
 * resalta la vista activa y ofrece el cierre de sesion.
 *
 * @param {Object} props
 * @param {string} props.activeView - Identificador de la vista actualmente activa.
 * @param {(id: string) => void} props.onSelect - Callback invocado al seleccionar una opcion del menu.
 * @param {boolean} props.open - Indica si la barra lateral esta abierta (modo responsivo).
 * @param {() => void} props.onClose - Callback para cerrar la barra lateral.
 * @param {{username: string, rol: string}} props.user - Datos del usuario en sesion.
 * @param {() => void} props.onLogout - Callback para cerrar la sesion.
 * @returns {JSX.Element}
 */
export function Sidebar({ activeView, onSelect, open, onClose, user, onLogout }) {
  const groups = visibleMenu(user.rol);
  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar-brand">
        <Logo size={40} variant="light" />
        <div>
          <span>Glory's</span>
          <strong>Boutique</strong>
        </div>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <p className="sidebar-group-label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`sidebar-link${active ? ' sidebar-link--active' : ''}`}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span>{user.username}</span>
          <small>{user.rol}</small>
        </div>
        <button type="button" className="logout-button" onClick={onLogout}>
          <LogOut size={16} />
          <span>Salir</span>
        </button>
      </div>
    </aside>
  );
}
