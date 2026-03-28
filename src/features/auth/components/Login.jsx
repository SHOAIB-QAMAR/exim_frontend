import React, { useState } from 'react';
import { FaShip } from 'react-icons/fa6';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
        } catch (err) {
            const msg = err.message || 'Login failed. Please try again.';
            if (msg.toLowerCase().includes('not found')) {
                setError('User not found in Zipaworld.');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <span className="auth-logo-icon"><FaShip /></span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="auth-logo-text">EximGPT</span>
                            <span className="auth-logo-subtitle">Logistics AI</span>
                        </div>
                    </div>
                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-subtitle">Sign in to continue to your workspace</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            <span className="auth-error-icon">⚠</span>
                            {error}
                        </div>
                    )}

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="login-email">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            className="auth-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            className="auth-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-button"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="auth-button-loading">
                                <span className="auth-spinner"></span>
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default Login;
