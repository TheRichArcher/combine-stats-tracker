import React from 'react';

export default function AppLayout({ children }) {
  return (
    <div className="login-outer-container">
      <div className="login-card fade-in">
        <div className="login-logo">
          <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo" />
        </div>
        <div className="card-content">
          {children}
        </div>
      </div>
      <footer className="global-footer" style={{ marginTop: '2em' }}>
        <span>Woo-Combine &copy; {new Date().getFullYear()} | Questions? <a href="mailto:support@woo-combine.com">support@woo-combine.com</a></span>
      </footer>
    </div>
  );
} 