import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { initSupabase } from './lib/supabase';
import './index.css';

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);

function renderError(message: string) {
  root.render(
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: '#e5e7eb',
      background: '#0a0a0a',
    }}>
      <div>
        <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          DOCLIX couldn't start
        </p>
        <p style={{ color: '#9ca3af', maxWidth: 32 + 'rem' }}>{message}</p>
      </div>
    </div>
  );
}

initSupabase()
  .then(() => {
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Supabase runtime config:', err);
    renderError(
      err instanceof Error
        ? err.message
        : 'Failed to load runtime configuration from /api/config.'
    );
  });
