import React from 'react';
import './PrimaryButton.css';

const PrimaryButton = ({ children, ...props }) => (
  <button className="primary-btn" {...props}>
    {children}
  </button>
);

export default PrimaryButton; 