import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import GlobalErrorBoundary from './components/common/ErrorBoundary';
import { initErrorMonitoring } from './utils/errorMonitor';

// Initialize global error monitoring before React renders
initErrorMonitoring();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
