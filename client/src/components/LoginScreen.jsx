/** @file Componente LoginScreen: pantalla de inicio de sesion del sistema. */
import React, { useState } from 'react';
import { Logo } from './Logo.jsx';
import { Field } from './Field.jsx';

/**
 * Pantalla de inicio de sesion. Recoge usuario y contrasena y delega la autenticacion en onLogin.
 *
 * @param {Object} props
 * @param {(username: string, password: string) => Promise<void>} props.onLogin - Callback que autentica al usuario.
 * @returns {JSX.Element}
 */
export function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Maneja el envio del formulario: previene el comportamiento por defecto,
   * limpia errores, marca el estado de envio y delega la autenticacion en onLogin.
   *
   * @param {React.FormEvent<HTMLFormElement>} event - Evento de envio del formulario.
   * @returns {Promise<void>}
   */
  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onLogin(form.username, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo size={48} variant="dark" />
          <div>
            <span>Glory's Boutique</span>
            <strong>Iniciar sesion</strong>
          </div>
        </div>
        <Field label="Usuario">
          <input
            required
            autoFocus
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Contrasena">
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <div className="alert">{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Validando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
