import React from 'react';

const PageWrapper = ({ children }) => (
  <div className="page-wrapper">
    {/* Header can be slotted here if needed */}
    {children}
    {/* Footer can be slotted here if needed */}
  </div>
);

export default PageWrapper; 