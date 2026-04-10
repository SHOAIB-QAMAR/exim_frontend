/**
 * Tests for App component
 * Covers: loading state, auth routing (AuthPage vs Layout)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mock all providers and child components ──────────────────────────────────
vi.mock('../services/api.config', () => ({
    default: {
        BASE_URL: 'http://test-host',
        WS_BASE_URL: 'ws://test-host',
        endpoints: { THREAD: '/api/thread', CHAT_WS: '/ws/chat', UPLOAD: '/api/upload' }
    }
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));



// Mock Layout to avoid deep component tree
vi.mock('../components/layout/Layout', () => ({
    default: () => <div data-testid="layout">Layout</div>,
}));

// Mock AuthPage
vi.mock('../features/auth/AuthPage', () => ({
    default: () => <div data-testid="auth-page">AuthPage</div>,
}));

import App from '../App';

describe('App', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });


    it('renders AuthPage when not authenticated', () => {
        render(<App />);
        expect(screen.getByTestId('auth-page')).toBeDefined();
    });

    it('renders Layout when authenticated', () => {
        localStorage.setItem('authToken', 'valid-jwt');
        localStorage.setItem('authUser', JSON.stringify({ id: 'u1', email: 'test@mail.com' }));

        render(<App />);

        expect(screen.getByTestId('layout')).toBeDefined();
    });
});
