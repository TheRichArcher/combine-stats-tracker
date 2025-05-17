import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Simple ErrorBoundary implementation
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    // Optionally log error
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 32, textAlign: 'center', color: 'red'}}>Something went wrong rendering this page.</div>;
    }
    return this.props.children;
  }
}

const Layout = ({ children }) => (
  <div className="global-layout">
    <Header />
    <ErrorBoundary>
      <main className="main-content">
        {children}
      </main>
    </ErrorBoundary>
    <Footer />
  </div>
);

export default Layout; 