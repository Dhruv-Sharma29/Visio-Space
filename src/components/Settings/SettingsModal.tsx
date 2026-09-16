import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { profileService } from '../../services/profileService';
import { cleanUsername, validateUsernameFormat, validateFullName } from '../../utils/profileValidation';
import { workspaceService, type Workspace } from '../../services/workspaceService';
import { useBoardStore } from '../../store/boardStore';
import { applyTheme, getStoredTheme, type ThemeId } from '../../utils/theme';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

export type SettingsTab = 'profile' | 'appearance' | 'workspace' | 'notifications' | 'security';

const PRESET_AVATARS = [
  '🎨', '💡', '🔍', '🚀', '🧠', '🌿', '☕', '🪐', '🦉', '✨'
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'profile',
}) => {
  const { user, profile, updateProfile, signOut, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  // Appearance State
  const [theme, setTheme] = useState<ThemeId>('dark-paper');

  const selectTheme = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    if (user) {
      updateProfile({ preferences: { ...profile?.preferences, theme: id, sound: soundEnabled } });
    }
  };
  const { soundEnabled, setSoundEnabled } = useBoardStore();

  // Workspace State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState('');
  const [defaultCardColor, setDefaultCardColor] = useState('#fff8ea');

  // Notifications State
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyInvites, setNotifyInvites] = useState(true);
  const [notifyUpdates, setNotifyUpdates] = useState(false);

  // Security State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  // Sync profile data on open
  useEffect(() => {
    if (!isOpen) return;
    setTheme(profile?.preferences?.theme || getStoredTheme());
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setAvatarUrl(profile.avatar_url || '');
      setDefaultWorkspaceId(profile.preferences?.defaultWorkspaceId || '');
      setNotifyMentions(profile.preferences?.notifyMentions ?? true);
      setNotifyInvites(profile.preferences?.notifyInvites ?? true);
      setNotifyUpdates(profile.preferences?.notifyUpdates ?? false);
      setProfileError('');
      setProfileSaved(false);
    }
  }, [isOpen, profile]);

  // Load workspaces for workspace tab
  useEffect(() => {
    if (isOpen && user?.id) {
      workspaceService.getMyWorkspaces(user.id).then(setWorkspaces);
    }
  }, [isOpen, user?.id]);

  // Debounced username check during editing in Settings
  useEffect(() => {
    if (!isOpen || activeTab !== 'profile') return;
    const trimmed = cleanUsername(username);
    if (!trimmed || trimmed === profile?.username) {
      setUsernameStatus('idle');
      return;
    }

    const format = validateUsernameFormat(trimmed);
    if (!format.valid) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const res = await profileService.checkUsernameAvailability(trimmed, user?.id);
      setUsernameStatus(res.available ? 'available' : 'taken');
    }, 320);

    return () => clearTimeout(timer);
  }, [username, profile?.username, user?.id, isOpen, activeTab]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) {
      setProfileError(nameCheck.error || 'Invalid full name.');
      return;
    }

    const cleanedUser = cleanUsername(username);
    const userCheck = validateUsernameFormat(cleanedUser);
    if (!userCheck.valid) {
      setProfileError(userCheck.error || 'Invalid username format.');
      return;
    }

    setProfileSaving(true);
    const res = await updateProfile({
      full_name: fullName.trim(),
      username: cleanedUser,
      avatar_url: avatarUrl || null,
      preferences: {
        ...profile?.preferences,
        theme,
        sound: soundEnabled,
        defaultWorkspaceId,
        notifyMentions,
        notifyInvites,
        notifyUpdates,
      },
    });
    setProfileSaving(false);

    if (res.error) {
      setProfileError(res.error);
    } else {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordStatus('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (user?.email) {
      const res = await resetPassword(user.email);
      if (res.error) {
        setPasswordError(res.error);
      } else {
        setPasswordStatus('Password reset link sent to your email.');
        setNewPassword('');
        setConfirmPassword('');
      }
    }
  };

  const isGoogleUser = user?.app_metadata?.provider === 'google' ||
    user?.identities?.some(id => id.provider === 'google');

  return (
    <div className="settings-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        className="settings-modal-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="settings-header">
          <div className="settings-header-title">
            <h2>Settings</h2>
            <span className="settings-header-user">
              {profile ? `@${profile.username}` : user?.email}
            </span>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        {/* Content Body: Sidebar + Main Panel */}
        <div className="settings-body">
          {/* Sidebar Tabs */}
          <nav className="settings-nav" aria-label="Settings categories">
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span className="settings-nav-icon">👤</span>
              Profile
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <span className="settings-nav-icon">🎨</span>
              Appearance
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'workspace' ? 'active' : ''}`}
              onClick={() => setActiveTab('workspace')}
            >
              <span className="settings-nav-icon">📁</span>
              Workspace
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <span className="settings-nav-icon">🔔</span>
              Notifications
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <span className="settings-nav-icon">🔒</span>
              Account & Security
            </button>
          </nav>

          {/* Main Panel */}
          <main className="settings-panel">
            {/* ─── Profile Tab ────────────────────────── */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="settings-form">
                <div className="settings-section-head">
                  <h3>Public Profile</h3>
                  <p>Manage your identity, handle, and avatar across VisioSpace.</p>
                </div>

                {/* Avatar Preview & Quick Picker */}
                <div className="settings-avatar-row">
                  <div className="settings-avatar-preview">
                    {avatarUrl ? (
                      avatarUrl.startsWith('http') || avatarUrl.startsWith('/') ? (
                        <img src={avatarUrl} alt={fullName} className="settings-avatar-img" />
                      ) : (
                        <span className="settings-avatar-emoji">{avatarUrl}</span>
                      )
                    ) : (
                      <span className="settings-avatar-initial">
                        {(fullName[0] || username[0] || 'U').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="settings-avatar-controls">
                    <span className="settings-avatar-label">Choose avatar badge</span>
                    <div className="settings-avatar-presets">
                      {PRESET_AVATARS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className={`settings-preset-btn ${avatarUrl === emoji ? 'selected' : ''}`}
                          onClick={() => setAvatarUrl(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                      {avatarUrl && (
                        <button
                          type="button"
                          className="settings-preset-clear"
                          onClick={() => setAvatarUrl('')}
                          title="Clear avatar"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Full Name Input */}
                <label className="settings-field">
                  <span className="settings-label-text">Full name</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Ada Lovelace"
                  />
                </label>

                {/* Username Input with Validation */}
                <label className="settings-field">
                  <div className="settings-label-row">
                    <span className="settings-label-text">Username (VisioSpace Handle)</span>
                    {usernameStatus === 'checking' && (
                      <span className="settings-status-tag checking">Checking…</span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="settings-status-tag available">✓ Available</span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="settings-status-tag taken">✕ Taken</span>
                    )}
                    {usernameStatus === 'invalid' && (
                      <span className="settings-status-tag invalid">✕ Invalid</span>
                    )}
                  </div>
                  <div className="settings-username-wrap">
                    <span className="settings-username-prefix">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      required
                      placeholder="username"
                      className={`settings-username-input ${
                        usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'error'
                          : usernameStatus === 'available'
                          ? 'success'
                          : ''
                      }`}
                    />
                  </div>
                  <span className="settings-hint">
                    3–20 characters. Letters, numbers, and underscores. Used for @mentions and boards.
                  </span>
                </label>

                {/* Save Feedback */}
                {profileError && (
                  <div className="settings-alert error">{profileError}</div>
                )}
                {profileSaved && (
                  <div className="settings-alert success">Saved ✓ Changes are live.</div>
                )}

                <div className="settings-form-actions">
                  <button
                    type="submit"
                    className="settings-save-btn"
                    disabled={profileSaving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                  >
                    {profileSaving ? 'Saving…' : profileSaved ? 'Saved ✓' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* ─── Appearance Tab ─────────────────────── */}
            {activeTab === 'appearance' && (
              <div className="settings-form">
                <div className="settings-section-head">
                  <h3>Appearance & Interface</h3>
                  <p>Customize the canvas palette, sound effects, and editor experience.</p>
                </div>

                <div className="settings-theme-grid">
                  <div
                    className={`settings-theme-card ${theme === 'dark-paper' ? 'selected' : ''}`}
                    onClick={() => selectTheme('dark-paper')}
                  >
                    <div className="settings-theme-swatch dark-paper" />
                    <span className="settings-theme-name">Dark Paper (Default)</span>
                    <span className="settings-theme-desc">Warm espresso background with paper-textured notes.</span>
                  </div>

                  <div
                    className={`settings-theme-card ${theme === 'parchment-light' ? 'selected' : ''}`}
                    onClick={() => selectTheme('parchment-light')}
                  >
                    <div className="settings-theme-swatch parchment-light" />
                    <span className="settings-theme-name">Parchment Light</span>
                    <span className="settings-theme-desc">Editorial newsprint with soft cream tones.</span>
                  </div>

                  <div
                    className={`settings-theme-card ${theme === 'high-contrast' ? 'selected' : ''}`}
                    onClick={() => selectTheme('high-contrast')}
                  >
                    <div className="settings-theme-swatch high-contrast" />
                    <span className="settings-theme-name">High Contrast</span>
                    <span className="settings-theme-desc">Deep carbon contrast with crisp geometric accents.</span>
                  </div>
                </div>

                <div className="settings-divider" />

                <div className="settings-toggle-row">
                  <div>
                    <span className="settings-toggle-title">Sound Effects</span>
                    <p className="settings-toggle-sub">Card placement and connection audio feedback.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={soundEnabled}
                    onChange={e => {
                      const next = e.target.checked;
                      setSoundEnabled(next);
                      if (user) {
                        updateProfile({ preferences: { ...profile?.preferences, theme, sound: next } });
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* ─── Workspace Tab ──────────────────────── */}
            {activeTab === 'workspace' && (
              <div className="settings-form">
                <div className="settings-section-head">
                  <h3>Workspace Preferences</h3>
                  <p>Configure your default workspace and board defaults.</p>
                </div>

                <label className="settings-field">
                  <span className="settings-label-text">Default Workspace</span>
                  <select
                    value={defaultWorkspaceId || workspaces[0]?.id || ''}
                    onChange={e => setDefaultWorkspaceId(e.target.value)}
                    className="settings-select"
                  >
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.role || 'member'})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="settings-field">
                  <span className="settings-label-text">Default Sticky Card Color</span>
                  <div className="settings-color-palette">
                    {['#fff8ea', '#ffe4e1', '#e8f4f8', '#eafaf1', '#fef9e7', '#f3e8fd'].map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`settings-color-dot ${defaultCardColor === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setDefaultCardColor(c)}
                      />
                    ))}
                  </div>
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-save-btn"
                    onClick={() => {
                      updateProfile({
                        preferences: { ...profile?.preferences, defaultWorkspaceId },
                      });
                      setProfileSaved(true);
                      setTimeout(() => setProfileSaved(false), 2500);
                    }}
                  >
                    Save Workspace Defaults
                  </button>
                </div>
              </div>
            )}

            {/* ─── Notifications Tab ──────────────────── */}
            {activeTab === 'notifications' && (
              <div className="settings-form">
                <div className="settings-section-head">
                  <h3>Notifications</h3>
                  <p>Choose which updates and collaborator alerts you receive.</p>
                </div>

                <div className="settings-toggle-row">
                  <div>
                    <span className="settings-toggle-title">Collaborator Mentions</span>
                    <p className="settings-toggle-sub">Notify when teammates @mention your handle in notes or comments.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={notifyMentions}
                    onChange={e => setNotifyMentions(e.target.checked)}
                  />
                </div>

                <div className="settings-toggle-row">
                  <div>
                    <span className="settings-toggle-title">Board Invitations</span>
                    <p className="settings-toggle-sub">Notify when you are invited to view or edit a board.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={notifyInvites}
                    onChange={e => setNotifyInvites(e.target.checked)}
                  />
                </div>

                <div className="settings-toggle-row">
                  <div>
                    <span className="settings-toggle-title">Workspace Activity Digest</span>
                    <p className="settings-toggle-sub">Weekly summaries of changes across your collaborative boards.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={notifyUpdates}
                    onChange={e => setNotifyUpdates(e.target.checked)}
                  />
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-save-btn"
                    onClick={() => {
                      updateProfile({
                        preferences: {
                          ...profile?.preferences,
                          notifyMentions,
                          notifyInvites,
                          notifyUpdates,
                        },
                      });
                      setProfileSaved(true);
                      setTimeout(() => setProfileSaved(false), 2500);
                    }}
                  >
                    Save Notifications
                  </button>
                </div>
              </div>
            )}

            {/* ─── Account & Security Tab ─────────────── */}
            {activeTab === 'security' && (
              <div className="settings-form">
                <div className="settings-section-head">
                  <h3>Account & Security</h3>
                  <p>Manage your login credentials, connected providers, and session status.</p>
                </div>

                {/* Account Type Badge */}
                <div className="settings-card-info">
                  <div className="settings-provider-badge">
                    {isGoogleUser ? (
                      <>
                        <span className="provider-icon">G</span>
                        <div>
                          <strong>Connected with Google</strong>
                          <p>{user?.email}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="provider-icon">✉</span>
                        <div>
                          <strong>Email & Password Account</strong>
                          <p>{user?.email}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Password reset for email users */}
                {!isGoogleUser && (
                  <form onSubmit={handlePasswordChange} className="settings-password-form">
                    <span className="settings-toggle-title">Reset Password</span>
                    <p className="settings-toggle-sub">
                      Request a secure password reset link to your email ({user?.email}).
                    </p>
                    {passwordStatus && <div className="settings-alert success">{passwordStatus}</div>}
                    {passwordError && <div className="settings-alert error">{passwordError}</div>}
                    <button type="submit" className="settings-secondary-btn">
                      Send Password Reset Email
                    </button>
                  </form>
                )}

                <div className="settings-divider" />

                {/* Danger Zone: Sign out and delete */}
                <div className="settings-danger-zone">
                  <div>
                    <span className="settings-danger-title">Sign Out</span>
                    <p className="settings-toggle-sub">Sign out from VisioSpace on this device.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
