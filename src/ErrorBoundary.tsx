import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  componentDidMount() {
    console.log('ErrorBoundary mounted successfully');
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          fontFamily: 'Arial, sans-serif',
          maxWidth: '800px',
          margin: '50px auto'
        }}>
          <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>
            ❌ Application Error
          </h1>
          <p style={{ marginBottom: '10px' }}>
            Something went wrong loading the application.
          </p>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '14px'
          }}>
            {this.state.error?.toString()}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;