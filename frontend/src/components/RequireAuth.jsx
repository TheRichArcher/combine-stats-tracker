import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RequireAuth = ({ children, fallback = null }) => {
  const { user, loading } = useAuth();
  if (loading) return fallback;
  return user ? children : <Navigate to="/login" replace />;
};

export default RequireAuth; 