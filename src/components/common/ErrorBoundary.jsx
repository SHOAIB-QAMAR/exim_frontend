import React from 'react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    /**
     * Updates state when an error is caught in a child component.
     * @param {Error} error - The caught error.
     * @returns {Object} Updated state.
     */
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Render the fallback UI when an error is caught
            return (
                <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] p-6 z-50">
                    <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                        {/* Error Message Header */}
                        <h2 className="text-2xl font-bold mb-2">Something Went Wrong</h2>
                        <p className="text-[var(--text-secondary)] mb-6">
                            We're sorry, but the application encountered an unexpected error.
                        </p>

                        {/* Technical Error Details (Only shown in Development) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg mb-6 text-left overflow-auto max-h-32 border border-[var(--border-color)]">
                                <code className="text-xs text-red-400 font-mono break-all">
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}

                        {/* Recovery Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full py-3 px-4 bg-[var(--brand-primary)] hover:opacity-90 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary)] focus:ring-offset-[var(--bg-card)]"
                            >
                                Reload Application
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="w-full py-3 px-4 border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary)]"
                            >
                                Return Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // If no error occurred, render children normally
        return this.props.children;
    }
}

export default GlobalErrorBoundary;