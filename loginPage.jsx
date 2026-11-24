import { useState, useEffect } from 'react';
import { LoginForm, RegisterForm, fetchCurrentUser } from './auth.jsx';

function goHome() {
  window.location.href = '/';
}

export default function LoginPage() {
  const [message, setMessage] = useState('');

  // Already signed in? No need to be here.
  useEffect(() => {
    fetchCurrentUser().then(user => {
      if (user) goHome();
    }).catch(() => {});
  }, []);

  return (
    <div className="login-box">
      <h2>Welcome to AccessCS</h2>
      <LoginForm onSuccess={goHome} onError={setMessage} />
      <RegisterForm onSuccess={goHome} onError={setMessage} />
      <p id="auth-message" aria-live="polite">{message}</p>
      <p><a href="/">&larr; Back to AccessCS</a></p>
    </div>
  );
}
