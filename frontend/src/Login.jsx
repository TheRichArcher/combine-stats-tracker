import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './firebase';

// Map Firebase error codes to friendly messages
const errorMap = {
  'auth/user-not-found': 'Email not recognized.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
};

export default function Login({ user }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/coaches" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/coaches', { replace: true });
    } catch (err) {
      let msg = err.message.replace('Firebase: ', '');
      if (err.code && errorMap[err.code]) {
        msg = errorMap[err.code];
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-outer-container">
      <div className="login-card fade-in">
        <div className="login-logo">
          <img src="/combine-logo.png" alt="Woo-Combine Logo" className="logo" />
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="login-input"
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="login-input"
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <div className="login-links">
            <a href="#" className="forgot-link">Forgot password?</a>
          </div>
          {error && <div className="login-error">{error}</div>}
        </form>
        <div className="login-footer">
          Don't have an account? Contact us at <a href="mailto:support@woo-combine.com">support@woo-combine.com</a>.
        </div>
      </div>
    </div>
  );
} 