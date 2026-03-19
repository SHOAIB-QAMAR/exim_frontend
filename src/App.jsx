import { ThemeProvider } from './providers/ThemeContext'
import { UIProvider } from './providers/UIContext'
import { AuthProvider, useAuth } from './features/auth/context/AuthContext'
import { WebSocketProvider } from './features/chat/context/WebSocketContext'

import Layout from './components/layout/Layout'
import AuthPage from './features/auth/AuthPage'

/**
 * Inner component that reads auth state and decides what to show.
 * Must be INSIDE AuthProvider to use useAuth().
 */
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show a minimal loading state while we verify the stored token
  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner-large"></div>
      </div>
    );
  }

  // Not logged in → show Login/Register
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Logged in → show the main app
  return (
    <WebSocketProvider>
      <UIProvider>
        <Layout />
      </UIProvider>
    </WebSocketProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App