import React from 'react';
import './App.css';

export default function PageWrapper({ children, user, onLogout }) {
  if (user) {
    // Dashboard layout for authenticated users
    return (
      <div className="dashboard-outer-container">
        <aside className="dashboard-sidebar">
          <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo sidebar-logo" />
          <div className="sidebar-user-email">{user.email}</div>
          <button className="login-btn sidebar-logout" onClick={onLogout}>Logout</button>
        </aside>
        <main className="dashboard-main-content">
          <div className="dashboard-content-wrapper">
            {children}
          </div>
          <footer className="global-footer dashboard-footer">
            <span>Woo-Combine &copy; {new Date().getFullYear()} | Questions? <a href="mailto:support@woo-combine.com">support@woo-combine.com</a></span>
          </footer>
        </main>
      </div>
    );
  }
  // Centered card for unauthenticated users
  return (
    <div className="login-outer-container">
      <div className="login-card fade-in">
        <div className="login-logo">
          <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo" />
        </div>
        <div className="card-content">{children}</div>
        <footer className="global-footer" style={{ marginTop: '2em', textAlign: 'center', width: '100%' }}>
          <span>Woo-Combine &copy; {new Date().getFullYear()} | Questions? <a href="mailto:support@woo-combine.com">support@woo-combine.com</a></span>
        </footer>
      </div>
    </div>
  );
} 