import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';
import { Dashboard } from './components/Dashboard/Dashboard';

function Root() {
  const { loading, user } = useAuth();
  const [guestAccess, setGuestAccess] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('visiospace_guest_mode') === 'true';
  });

  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#board/')) {
      const id = window.location.hash.replace('#board/', '');
      return id || null;
    }
    return null;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Sync with browser hash changes
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.startsWith('#board/')) {
        const id = window.location.hash.replace('#board/', '');
        setActiveBoardId(id || null);
      } else {
        setActiveBoardId(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) return <div className="auth-loading">Loading VisioSpace…</div>;

  if (user || guestAccess) {
    if (activeBoardId) {
      return (
        <>
          <App
            boardId={activeBoardId}
            onBackToDashboard={() => {
              setActiveBoardId(null);
              window.location.hash = '';
            }}
          />
          {authModalOpen && (
            <AuthScreen isModal onClose={() => setAuthModalOpen(false)} />
          )}
        </>
      );
    }

    return (
      <>
        <Dashboard
          onOpenBoard={id => {
            setActiveBoardId(id);
            window.location.hash = `board/${id}`;
          }}
          onOpenAuth={() => setAuthModalOpen(true)}
          onSignOut={() => {
            sessionStorage.removeItem('visiospace_guest_mode');
            setGuestAccess(false);
            setActiveBoardId(null);
            window.location.hash = '';
          }}
        />
        {authModalOpen && (
          <AuthScreen isModal onClose={() => setAuthModalOpen(false)} />
        )}
      </>
    );
  }

  return (
    <AuthScreen
      onContinueGuest={() => {
        sessionStorage.setItem('visiospace_guest_mode', 'true');
        setGuestAccess(true);
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
