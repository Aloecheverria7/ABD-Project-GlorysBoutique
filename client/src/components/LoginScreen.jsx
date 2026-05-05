import React, { useState } from 'react';
import { Logo } from './Logo.jsx';
import { Field } from './Field.jsx';

export function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        <p className="login-hint">
          Cuentas demo: <code>admin / 123</code> y <code>user1 / 123</code>
        </p>
      </form>
    </div>
  );
}
