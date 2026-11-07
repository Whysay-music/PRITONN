import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global crash protection for Android WebView & Desktop
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Handled uncaught error to prevent WebView crash:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Handled unhandled promise rejection to prevent WebView crash:', event.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
