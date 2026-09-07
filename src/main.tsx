import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthScreen } from './auth/AuthScreen'

function Root() {
  const { loading, user } = useAuth();
  const [guestAccess, setGuestAccess] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('visiospace_guest_mode') === 'true';
  });

  if (loading) return <div className="auth-loading">Loading VisioSpace…</div>;
  if (user || guestAccess) return <App />;
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
    <AuthProvider><Root /></AuthProvider>
  </StrictMode>,
)
