import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import PrimaryButton from './PrimaryButton';
import TextInput from './TextInput';
import { Link } from 'react-router-dom';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess('Account created! You can now log in.');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSignUp} className="login-form">
        <h1 style={{ fontWeight: 600, fontSize: '2rem', marginBottom: 8 }}>Sign Up</h1>
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
        Already have an account? <Link to="/login">Sign in here</Link>
      </div>
    </>
  );
} 