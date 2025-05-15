import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { auth } from './firebase';

export default function RequireAuth({ children }) {
  const [user, setUser] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return React.cloneElement(children, { user });
} 