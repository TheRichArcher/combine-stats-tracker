import React from 'react';
import { useAuth } from '../context/AuthContext';
import PrimaryButton from './PrimaryButton';
import combineLogo from '../../public/combine-logo.png';

const Header = () => {
  const { user, logout } = useAuth();
  return (
    <header className="header">
      <img src={combineLogo} alt="Combine Logo" className="logo" />
      {user && (
        <div className="header-user">
          <span>{user.email}</span>
          <PrimaryButton onClick={logout}>Logout</PrimaryButton>
        </div>
      )}
    </header>
  );
};

export default Header; 