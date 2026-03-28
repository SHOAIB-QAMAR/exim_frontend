import React from 'react';
import { reportError } from '../../utils/errorMonitor';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        // Initialize state to track if an error has occurred and to store error details
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }


    /* Method invoked after an error has been thrown by a descendant component.
     * It receives the error that was thrown as a parameter and should return a value to update state.
     * @param {Error} error - The error that was thrown, @returns {Object} State update indicating an error occurred */
    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI instead of crashing the app
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to our centralized error reporting service for monitoring
        reportError({
            type: 'react_error_boundary',
            message: error?.message,
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
        });

        // Save the error info to state (optional, can be used for debugging UI)
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Render the fallback UI when an error is caught
            return (
                <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] p-6 z-50">
                    <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                        {/* Error Icon */}
                        <div className="mb-6 flex justify-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>

                        {/* Error Message Header */}
                        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
                        <p className="text-[var(--text-secondary)] mb-6">
                            We're sorry, but the application encountered an unexpected error.
                        </p>

                        {/* Technical Error Details (useful for developers/users reporting issues) */}
                        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg mb-6 text-left overflow-auto max-h-32 border border-[var(--border-color)]">
                            <code className="text-xs text-red-400 font-mono break-all">
                                {this.state.error && this.state.error.toString()}
                            </code>
                        </div>

                        {/* Recovery Action Button */}
                        <button
                            onClick={this.handleReload}
                            className="w-full py-3 px-4 bg-[var(--brand-primary)] hover:opacity-90 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary)] focus:ring-offset-[var(--bg-card)]"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        // If no error occurred, render children normally
        return this.props.children;
    }
}

export default GlobalErrorBoundary;