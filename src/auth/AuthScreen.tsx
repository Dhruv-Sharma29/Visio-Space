import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import './AuthScreen.css';

interface AuthScreenProps {
  onContinueGuest?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function AuthScreen({ onContinueGuest, onClose, isModal = false }: AuthScreenProps = {}) {
  const { configured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const result = mode === 'sign-in'
      ? await signIn(email, password)
      : await signUp(email, password);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage(mode === 'sign-up' && 'confirmationRequired' in result && result.confirmationRequired ? 'Check your email to confirm your account.' : 'Account ready.');
      if (mode === 'sign-in' || (mode === 'sign-up' && (!('confirmationRequired' in result) || !result.confirmationRequired))) {
        onClose?.();
      }
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
      <h1>{mode === 'sign-in' ? 'Welcome back.' : 'Start making sense.'}</h1>
      <p className="auth-subtitle">{mode === 'sign-in' ? 'Pick up where your team left off.' : 'Create a workspace for ideas, evidence, and decisions.'}</p>
      {!configured && <p className="auth-warning">Supabase is not configured yet. Add the anon key to `.env` to enable login.</p>}
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>
        <button type="submit" disabled={submitting || !configured}>{submitting ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
      </form>
      {onContinueGuest && (
        <button className="auth-guest-btn" type="button" onClick={onContinueGuest}>
          Continue as Guest
        </button>
      )}
      {message && <p className="auth-message">{message}</p>}
      <p className="auth-footer-copy">{mode === 'sign-in' ? 'New to VisioSpace?' : 'Already have a workspace?'}</p>
      <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }}>
        {mode === 'sign-in' ? 'Create your account' : 'Sign in instead'}
      </button>
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
