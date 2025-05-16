import React from 'react';
import './App.css';

export default function PageWrapper({ children, user, onLogout }) {
  return (
    <div className="login-outer-container">
      {/* Fixed Header Bar: Only for authenticated users */}
      {user && (
        <header className="app-header">
          <div className="header-left">
            <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo header-logo" />
          </div>
          <div className="header-right">
            <span className="user-email">{user.email}</span>
            <button className="login-btn header-logout" onClick={onLogout}>Logout</button>
          </div>
        </header>
      )}
      {/* Centered Card */}
      <div className="login-card fade-in" style={{ marginTop: user ? '80px' : undefined }}>
        {/* Show logo inside card only if not authenticated */}
        {!user && (
          <div className="login-logo">
            <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo" />
          </div>
        )}
        <div className="card-content">{children}</div>
        <footer className="global-footer" style={{ marginTop: '2em', textAlign: 'center', width: '100%' }}>
          <span>Woo-Combine &copy; {new Date().getFullYear()} | Questions? <a href="mailto:support@woo-combine.com">support@woo-combine.com</a></span>
        </footer>
      </div>
    </div>
  );
} 