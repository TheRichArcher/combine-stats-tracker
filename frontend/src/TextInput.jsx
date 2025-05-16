import React from 'react';

export default function TextInput({ label, ...props }) {
  return (
    <div style={{ width: '100%', marginBottom: '1em' }}>
      {label && <label htmlFor={props.id || props.name} style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>{label}</label>}
      <input className="login-input" {...props} />
    </div>
  );
} 