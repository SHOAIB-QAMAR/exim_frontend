/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

/**
 * ThemeContext
 * Provides global theme state ('light' | 'dark') and a toggle function.
 */
const ThemeContext = createContext();

/**
 * ThemeProvider Component
 * 
 * Manages the application's appearance theme. Persists the selection 
 * to localStorage and updates the document root class for CSS styling.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to be wrapped
 */
export const ThemeProvider = ({ children }) => {
    // Initialize theme from localStorage or default to 'light'
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });

    // Update document class and localStorage whenever theme changes
    useEffect(() => {
        localStorage.setItem('theme', theme);

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    /**
     * Toggles between 'light' and 'dark' themes.
     */
    const toggleTheme = useCallback(() => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * useTheme Hook
 * 
 * Custom hook to consume the ThemeContext.
 * @returns {{ theme: string, toggleTheme: Function }} Current theme and toggle function
 * @throws {Error} If used outside of a ThemeProvider
 */
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};