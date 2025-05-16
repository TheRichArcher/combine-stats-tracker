import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // Import Link and BrowserRouter
import Select from 'react-select'; // <-- Import react-select
import './App.css'; // Basic styling
import PageWrapper from './PageWrapper';
import PrimaryButton from './PrimaryButton';
import TextInput from './TextInput';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';

// --- Define Custom Error Class ---
class HttpError extends Error {
  constructor(status, detail, message) {
    super(message || `HTTP error! status: ${status}`);
    this.status = status;
    this.detail = detail || "Unknown server error.";
    this.name = "HttpError";
  }
}

// Consistent with backend Enum
const DRILL_TYPES = {
  FORTY_M_DASH: "40m_dash",
  VERTICAL_JUMP: "vertical_jump",
  CATCHING: "catching",
  THROWING: "throwing",
  AGILITY: "agility",
};

// --- NEW: Define Drill Categories ---
const DRILL_CATEGORIES = {
  'Speed': ['40m_dash'],
  'Power': ['vertical_jump'],
  'Skill': ['catching', 'throwing', 'agility']
  // Add more drills to categories as needed
};

// Helper to get all drill keys from categories
const ALL_DRILL_KEYS = Object.values(DRILL_CATEGORIES).flat();

// Helper function to get category name from drill key
const getCategoryForDrill = (drillKey) => {
  for (const category in DRILL_CATEGORIES) {
    if (DRILL_CATEGORIES[category].includes(drillKey)) {
      return category;
    }
  }
  return 'Other'; // Fallback category
};
// --- END NEW Drill Categories ---

// Add this line at the top, outside the App function
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Spinner() {
  return <div className="spinner"><div></div><div></div><div></div></div>;
}

const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/players"
          element={
            <RequireAuth>
              <Players />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App; 