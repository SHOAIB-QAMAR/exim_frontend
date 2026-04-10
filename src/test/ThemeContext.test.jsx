/**
 * Tests for ThemeContext
 * Covers: default theme, localStorage persistence, toggle, dark class
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from '../providers/ThemeContext';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('ThemeContext', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
    });

    it('defaults to light theme', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe('light');
    });

    it('reads initial theme from localStorage', () => {
        localStorage.setItem('theme', 'dark');

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe('dark');
    });

    it('toggleTheme switches between light and dark', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('dark');

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('light');
    });

    it('adds dark class to documentElement when theme is dark', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => result.current.toggleTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(true);

        act(() => result.current.toggleTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists theme to localStorage', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => result.current.toggleTheme());

        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('useTheme throws outside ThemeProvider', () => {
        expect(() => {
            renderHook(() => useTheme());
        }).toThrow('useTheme must be used within a ThemeProvider');
    });
});
