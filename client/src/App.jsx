import React from 'react';
import { LoginScreen } from './components/LoginScreen.jsx';
import { Workspace } from './Workspace.jsx';
import { useAuth } from './hooks/useAuth.js';

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
