import React from 'react';
import './TextInput.css';

const TextInput = ({ ...props }) => (
  <input className="text-input" {...props} />
);

export default TextInput; 