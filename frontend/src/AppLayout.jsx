import React from 'react';

export default function AppLayout({ children }) {
  return (
    <div className="login-outer-container">
      <div style={{ width: '100%', maxWidth: 1100, margin: '40px auto 0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '2.5rem 2rem 2rem 2rem', minHeight: 500 }}>
        <div className="login-logo" style={{ marginBottom: '2rem' }}>
          <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo" />
        </div>
        {children}
      </div>
      <footer className="global-footer" style={{ marginTop: '2em' }}>
        <span>Woo-Combine &copy; {new Date().getFullYear()} | Questions? <a href="mailto:support@woo-combine.com">support@woo-combine.com</a></span>
      </footer>
    </div>
  );
} 