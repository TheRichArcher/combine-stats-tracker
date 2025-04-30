import React, { useState, useEffect } from 'react';
import './App.css'; // Reuse existing styles if possible

const PASSWORD_KEY = 'combine_access_granted';
const CORRECT_PASSWORD = 'combine!'; // Hardcoded password

function PasswordGate({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  // Check local storage on initial mount
  useEffect(() => {
    const accessGranted = localStorage.getItem(PASSWORD_KEY);
    if (accessGranted === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    if (passwordInput === CORRECT_PASSWORD) {
      localStorage.setItem(PASSWORD_KEY, 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  if (isAuthenticated) {
    return children; // Render the protected component
  }

  // Render password form if not authenticated
  return (
    <div className="password-gate-container container">
      <img src="/combine-logo.png" alt="Combine Stats Tracker Logo" className="logo" />
      <h1>Access Required</h1>
      <p>Please enter the password to access the Combine Stats Tracker.</p>
      <form onSubmit={handlePasswordSubmit} className="password-form">
        <div className="form-section" style={{maxWidth: '300px', margin: '20px auto'}}>
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setError(''); // Clear error on input change
              }}
              required
            />
           <button type="submit" style={{marginTop: '10px'}}>Unlock</button>
        </div>
        {error && <p className="message error">{error}</p>}
      </form>
      {/* Optional: Link to coaches view if needed, though it should work directly */}
      {/* <p><a href="/coaches">Access Coach View (No Password Required)</a></p> */}
    </div>
  );
}

export default PasswordGate; 