import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { profileService } from '../services/profileService';
import { cleanUsername, validateUsernameFormat, validateFullName } from '../utils/profileValidation';
import './ProfileOnboardingScreen.css';

interface ProfileOnboardingScreenProps {
  onComplete?: () => void;
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'invalid' | 'taken';

export function ProfileOnboardingScreen({ onComplete }: ProfileOnboardingScreenProps) {
  const { user, completeOnboarding, signOut } = useAuth();

  const [fullName, setFullName] = useState(() => {
    const meta = user?.user_metadata;
    return meta?.full_name || meta?.name || '';
  });
  const [username, setUsername] = useState(() => {
    // Suggest username based on email or name
    const emailPrefix = user?.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 16) : '';
    return emailPrefix.toLowerCase();
  });

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Debounced availability validation
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    const cleaned = cleanUsername(trimmed);
    const format = validateUsernameFormat(cleaned);
    if (!format.valid) {
      setUsernameStatus('invalid');
      setUsernameError(format.error || 'Invalid username format');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');
    const timer = setTimeout(async () => {
      const res = await profileService.checkUsernameAvailability(cleaned, user?.id);
      if (res.available) {
        setUsernameStatus('available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameError(res.error || 'Username is already taken');
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [username, user?.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) {
      setErrorMessage(nameCheck.error || 'Please enter your full name.');
      return;
    }

    const cleaned = cleanUsername(username);
    const userCheck = validateUsernameFormat(cleaned);
    if (!userCheck.valid) {
      setErrorMessage(userCheck.error || 'Invalid username format.');
      return;
    }

    setSubmitting(true);
    const avail = await profileService.checkUsernameAvailability(cleaned, user?.id);
    if (!avail.available) {
      setSubmitting(false);
      setErrorMessage(avail.error || 'This username is already taken. Please choose another.');
      return;
    }

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
    const res = await completeOnboarding(cleaned, fullName.trim(), avatarUrl);
    setSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      onComplete?.();
    }
  };

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <img src="/visiospace-mark.svg" alt="" className="onboarding-logo" />
        <p className="onboarding-kicker">Welcome to VisioSpace</p>
        <h1 className="onboarding-title">Complete your profile</h1>
        <p className="onboarding-subtitle">
          Choose your unique VisioSpace handle and display name for sharing, collaborating, and workspace boards.
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <label>
            Full name
            <input
              type="text"
              placeholder="e.g. Ada Lovelace"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
            />
          </label>

          <label>
            <div className="onboarding-label-row">
              <span>Choose a unique username</span>
              {usernameStatus === 'checking' && (
                <span className="onboarding-status checking">Checking…</span>
              )}
              {usernameStatus === 'available' && (
                <span className="onboarding-status available">✓ Available</span>
              )}
              {usernameStatus === 'taken' && (
                <span className="onboarding-status taken">✕ Taken</span>
              )}
              {usernameStatus === 'invalid' && (
                <span className="onboarding-status invalid">✕ Invalid</span>
              )}
            </div>
            <div className="onboarding-username-field">
              <span className="onboarding-username-at">@</span>
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={`onboarding-username-input ${
                  usernameStatus === 'taken' || usernameStatus === 'invalid'
                    ? 'input-error'
                    : usernameStatus === 'available'
                    ? 'input-success'
                    : ''
                }`}
              />
            </div>
            {usernameError && <span className="onboarding-field-error">{usernameError}</span>}
            <span className="onboarding-hint">
              3–20 characters. Letters, numbers, and underscores only.
            </span>
          </label>

          {errorMessage && (
            <p className="onboarding-error-message">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="onboarding-submit-btn"
            disabled={submitting || usernameStatus === 'taken' || usernameStatus === 'invalid'}
          >
            {submitting ? 'Setting up workspace…' : 'Continue to VisioSpace'}
          </button>

          <div className="onboarding-footer">
            <span className="onboarding-account-info">
              Signed in as {user?.email}
            </span>
            <button
              type="button"
              className="onboarding-switch-btn"
              onClick={() => signOut()}
            >
              Sign out / Use different account
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
