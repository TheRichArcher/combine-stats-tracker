import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import App from './App';
import CoachesView from './CoachDashboard';
import Login from './Login';
import RequireAuth from './RequireAuth';
import SignUp from './SignUp';
// import PlayerDetail from './components/PlayerDetail';
// import UploadPlayers from './components/UploadPlayers';
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
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/coaches" element={
          <RequireAuth>
            <CoachesView />
          </RequireAuth>
        } />
        {/* Remove routes for components handled within App.jsx */}
        {/* <Route path="/players/:playerId" element={<PlayerDetail />} /> */}
        {/* <Route path="/upload-players" element={<UploadPlayers />} /> */}
      </Routes>
    </Router>
  </React.StrictMode>
); 