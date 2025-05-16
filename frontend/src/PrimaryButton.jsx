import React from 'react';

export default function PrimaryButton({ children, loading, ...props }) {
  return (
    <button className="login-btn" disabled={loading || props.disabled} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  );
} 