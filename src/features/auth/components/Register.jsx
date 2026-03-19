import React, { useState } from 'react';
import { FaShip } from 'react-icons/fa6';
import { useAuth } from '../context/AuthContext';

const Register = ({ onSwitchToLogin }) => {
    const { register, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            await register(email, password);
            await login(email, password);
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
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
                    <h1 className="auth-title">Create account</h1>
                    <p className="auth-subtitle">Get started with your EximGPT workspace</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            <span className="auth-error-icon">⚠</span>
                            {error}
                        </div>
                    )}

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="register-email">Email</label>
                        <input
                            id="register-email"
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
                        <label className="auth-label" htmlFor="register-password">Password</label>
                        <input
                            id="register-password"
                            type="password"
                            className="auth-input"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="register-confirm">Confirm Password</label>
                        <input
                            id="register-confirm"
                            type="password"
                            className="auth-input"
                            placeholder="Repeat password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                                Creating account...
                            </span>
                        ) : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <button className="auth-link" onClick={onSwitchToLogin}>
                        Sign in
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Register;
