import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import PrimaryButton from './PrimaryButton';
import TextInput from './TextInput';
import Layout from './layout/Layout';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess('Account created! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      let msg = err.message.replace('Firebase: ', '');
      if (msg.includes('email-already-in-use')) msg = 'Email already in use.';
      if (msg.includes('weak-password')) msg = 'Password should be at least 6 characters.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="login-card">
        <h2 style={{ textAlign: 'center', marginBottom: '1em' }}>Sign Up</h2>
        <form onSubmit={handleSignUp} className="login-form">
          <TextInput
            id="email"
            type="email"
            label="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <TextInput
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <PrimaryButton type="submit" loading={loading}>
            Sign Up
          </PrimaryButton>
          {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
          {success && <div className="login-footer" style={{ color: '#388e3c', marginTop: 8 }}>{success}</div>}
        </form>
        <div className="login-footer">
          Already have an account? <a href="/login">Sign in here</a>
        </div>
      </div>
    </Layout>
  );
} 