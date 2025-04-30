import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import CoachDashboard from './CoachDashboard';
import PasswordGate from './PasswordGate';
import './App.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered', reg))
      .catch(err => console.log('SW registration failed', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <PasswordGate>
              <App />
            </PasswordGate>
          }
        />
        <Route path="/coaches" element={<CoachDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
); 