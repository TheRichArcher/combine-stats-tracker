import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './firebase';

export default function Login({ user }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/coaches" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : undefined);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/coaches', { replace: true });
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Coach Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div>
          <label>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember Me
          </label>
        </div>
        <button type="submit" disabled={loading}>Login</button>
        {error && <div className="error">{error}</div>}
      </form>
      <p style={{color: 'gray', fontSize: '0.9em'}}>Account creation is disabled. Contact admin for access.</p>
    </div>
  );
} 