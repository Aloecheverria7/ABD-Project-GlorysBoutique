/** @file Componente raiz de la aplicacion. Decide entre pantalla de carga, login o workspace segun el estado de autenticacion. */
import React from 'react';
import { LoginScreen } from './components/LoginScreen.jsx';
import { Workspace } from './Workspace.jsx';
import { useAuth } from './hooks/useAuth.js';

/**
 * Componente raiz que controla el flujo de autenticacion de la aplicacion.
 * Muestra una pantalla de carga mientras se verifica la sesion, la pantalla de
 * login si no hay usuario, o el workspace principal si el usuario esta autenticado.
 *
 * @returns {JSX.Element}
 */
export function App() {
  const { user, checking, login, logout } = useAuth();

  if (checking) {
    return <div className="boot-screen">Cargando sesion...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return <Workspace user={user} onLogout={logout} />;
}
