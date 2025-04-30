// packages/popup/src/authMain.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthPage from './AuthPage'; // Your Auth component
import './auth.css'; // Import the new global CSS for the auth page

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthPage />
  </React.StrictMode>,
);
