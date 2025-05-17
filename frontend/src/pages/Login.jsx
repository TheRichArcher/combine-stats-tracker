import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TextInput from '../components/TextInput';
import PrimaryButton from '../components/PrimaryButton';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };

  return (
    <div className="login-card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <TextInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <TextInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </PrimaryButton>
      </form>
      <div className="login-links">
        <a href="#">Forgot password?</a>
      </div>
      <div className="contact-note">
        Need help? <a href="mailto:support@woocombine.com">Contact us</a>
      </div>
      <div className="login-footer">
        Don&apos;t have an account? <a href="/signup">Sign up</a>
      </div>
    </div>
  );
};

export default Login; 