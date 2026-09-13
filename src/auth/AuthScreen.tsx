import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import './AuthScreen.css';

interface AuthScreenProps {
  onContinueGuest?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function AuthScreen({ onContinueGuest, onClose, isModal = false }: AuthScreenProps = {}) {
  const { configured, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'forgot-password'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error'>('info');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    if (mode === 'forgot-password') {
      const res = await resetPassword(email);
      setSubmitting(false);
      if (res.error) {
        setMessage(res.error);
        setMessageType('error');
      } else {
        setMessage('Password reset instructions sent to your email.');
        setMessageType('info');
      }
      return;
    }

    const result = mode === 'sign-in'
      ? await signIn(email, password)
      : await signUp(email, password);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      setMessageType('error');
    } else {
      setMessageType('info');
      setMessage(mode === 'sign-up' && 'confirmationRequired' in result && result.confirmationRequired
        ? 'Check your email to confirm your account.'
        : 'Account ready.');
      if (mode === 'sign-in' || (mode === 'sign-up' && (!('confirmationRequired' in result) || !result.confirmationRequired))) {
        onClose?.();
      }
    }
  }

  async function handleGoogleSignIn() {
    setMessage('');
    setSubmitting(true);
    const res = await signInWithGoogle();
    setSubmitting(false);
    if (res.error) {
      setMessage(res.error);
      setMessageType('error');
    }
  }

  const cardContent = (
    <section className={`auth-card ${isModal ? 'auth-modal-card' : ''} auth-card-${mode}`} onClick={e => isModal && e.stopPropagation()}>
      {isModal && onClose && (
        <button
          type="button"
          className="auth-close-btn"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          ×
        </button>
      )}
      <img src="/visiospace-mark.svg" alt="" className="auth-logo" />
      <p className="auth-kicker">VisioSpace · V2</p>
      <h1>
        {mode === 'sign-in' && 'Welcome back.'}
        {mode === 'sign-up' && 'Start making sense.'}
        {mode === 'forgot-password' && 'Reset password.'}
      </h1>
      <p className="auth-subtitle">
        {mode === 'sign-in' && 'Pick up where your team left off.'}
        {mode === 'sign-up' && 'Create a workspace for ideas, evidence, and decisions.'}
        {mode === 'forgot-password' && 'Enter your email to receive reset instructions.'}
      </p>

      {!configured && <p className="auth-warning">Supabase is not configured yet. Add the anon key to `.env` to enable login.</p>}

      {mode !== 'forgot-password' && (
        <>
          <button
            type="button"
            className="auth-google-btn"
            disabled={submitting || !configured}
            onClick={handleGoogleSignIn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.7 0 3 .6 4 1.5l3-3C17.2 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
              <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>or with email</span>
          </div>
        </>
      )}

      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        {mode !== 'forgot-password' && (
          <label>
            <div className="auth-label-row">
              <span>Password</span>
              {mode === 'sign-in' && (
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => { setMode('forgot-password'); setMessage(''); }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
          </label>
        )}

        <button type="submit" disabled={submitting || !configured}>
          {submitting
            ? 'Working…'
            : mode === 'sign-in'
            ? 'Sign in'
            : mode === 'sign-up'
            ? 'Create account'
            : 'Send reset link'}
        </button>
      </form>

      {onContinueGuest && mode !== 'forgot-password' && (
        <button className="auth-guest-btn" type="button" onClick={onContinueGuest}>
          Continue as Guest
        </button>
      )}

      {message && (
        <p className={`auth-message ${messageType === 'error' ? 'error' : ''}`}>
          {message}
        </p>
      )}

      {mode === 'forgot-password' ? (
        <button
          className="auth-switch"
          type="button"
          onClick={() => { setMode('sign-in'); setMessage(''); }}
        >
          ← Back to sign in
        </button>
      ) : (
        <>
          <p className="auth-footer-copy">
            {mode === 'sign-in' ? 'New to VisioSpace?' : 'Already have a workspace?'}
          </p>
          <button
            className="auth-switch"
            type="button"
            onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }}
          >
            {mode === 'sign-in' ? 'Create your account' : 'Sign in instead'}
          </button>
        </>
      )}
    </section>
  );

  if (isModal) {
    return (
      <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        {cardContent}
      </div>
    );
  }

  return (
    <main className="auth-screen">
      {cardContent}
    </main>
  );
}
