/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import API_CONFIG from '../../../services/api.config';

/* Global Context for Authentication state and methods.
 * Provides user information, JSON Web Token (JWT), and authentication actions (login, logout) to all nested components. */
const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    // ── STATE MANAGEMENT ──
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('authUser');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [token, setToken] = useState(() => localStorage.getItem('authToken'));
    const [isLoading] = useState(false);

    // ── AUTHENTICATION ACTIONS ──

    const login = useCallback(async (email, password) => {
        // Post to the external zipaworld customer login API
        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/auth/customer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyCode: "zworld_009",
                email,
                password,
                source: "Web",
                loginThrough: "webApp"
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // The external API might use 'message' or 'error' instead of 'detail'
            throw new Error(errorData.message || errorData.error || errorData.detail || 'Login failed');
        }

        const data = await response.json();

        // Extract the token and user info from the actual backend response structure
        const accessToken = data?.result?.authToken || data?.data?.token || data.access_token;
        const userData = data?.result?.customerData || data?.data?.user || { email };
        const userEmail = data?.result?.csBuddyData?.email || userData.email || email;
        const userId = data?.result?.customerBranchData?.customerId || userData._id || userData.id || userData.customerId;

        // Hydrate React state
        setToken(accessToken);
        setUser({ id: userId, email: userEmail, ...userData });

        // Persist session to local storage for persistence across reloads/tabs
        if (accessToken) {
            localStorage.setItem('authToken', accessToken);
        }

        // Store the full response from the external API as requested
        localStorage.setItem('customer', JSON.stringify(data));
        localStorage.setItem('authUser', JSON.stringify({ id: userData.id || userData.customerId, email: userData.email }));

        return data;
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('customer');
        localStorage.removeItem('CHATS_ACTIVE_SESSIONS');
        localStorage.removeItem('CHATS_ACTIVE_SESSION_ID');
    }, []);

    const value = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};