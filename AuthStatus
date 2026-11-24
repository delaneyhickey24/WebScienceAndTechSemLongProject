import { useState, useEffect } from 'react';
import { fetchCurrentUser, postJson } from './auth.jsx';

export default function AuthStatus() {
  // undefined = still checking, null = logged out, object = logged in
  const [user, setUser] = useState(undefined);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(error => {
        setUser(null);
        setMessage(error.message);
      });
  }, []);

  // Tell the rest of the (non-React) page when auth state changes.
  useEffect(() => {
    if (user === undefined) return;
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
  }, [user]);

  async function handleLogout() {
    try {
      await postJson('/api/logout', {});
      setUser(null);
      setMessage('You are logged out.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (user === undefined) return null;

  return (
    <>
      {user ? (
        <>
          <p id="auth-message" aria-live="polite">Signed in as {user.username}.</p>
          <button type="button" id="logout-button" onClick={handleLogout}>Log out</button>
        </>
      ) : (
        <>
          <p>Sign in or create an account to submit projects, opportunities and discussions.</p>
          <a href="/login.html"><button type="button">Sign in / Create account</button></a>
          <p id="auth-message" aria-live="polite">{message}</p>
        </>
      )}
    </>
  );
}
