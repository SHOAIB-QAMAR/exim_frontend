/**
 * Tests for AuthContext
 * Covers: initial state, token verification, login, logout
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mock dependencies ───────────────────────────────────────────────────────
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

import { AuthProvider, useAuth } from '../features/auth/context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

const mockFetchResponse = (ok, body, status = 200) =>
    vi.fn().mockResolvedValue({
        ok,
        status,
        json: () => Promise.resolve(body),
    });

describe('AuthContext', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── Initial state ─────────────────────────────────────────────────────
    describe('initial state', () => {
        it('starts with isLoaded true and unauthenticated with no token', () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
        });
    });

    // ── Session verification ────────────────────────────────────────────────
    describe('session verification', () => {
        it('hydrates user synchronously when stored token and user exist', () => {
            localStorage.setItem('authToken', 'valid-jwt');
            localStorage.setItem('authUser', JSON.stringify({ id: 'u1', email: 'test@mail.com' }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.user).toEqual({ id: 'u1', email: 'test@mail.com' });
        });

        it('clears state when stored user data is invalid JSON', () => {
            localStorage.setItem('authToken', 'valid-jwt');
            localStorage.setItem('authUser', 'bad-json');

            const { result } = renderHook(() => useAuth(), { wrapper });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
        });
    });

    // ── login ─────────────────────────────────────────────────────────────
    describe('login', () => {
        it('sets token and user on success', async () => {
            // No stored token → verifyToken won't fetch → all mocks go to login
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'new-jwt',
                    user_id: 'u2',
                    email: 'user@test.com'
                }),
            }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            let loginResult;
            await act(async () => {
                loginResult = await result.current.login('user@test.com', 'password');
            });

            expect(loginResult.access_token).toBe('new-jwt');
            expect(result.current.isAuthenticated).toBe(true);
            expect(localStorage.getItem('authToken')).toBe('new-jwt');
        });

        it('throws with error detail on failure', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ detail: 'Invalid credentials' }),
            }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await expect(
                act(async () => {
                    await result.current.login('wrong@test.com', 'bad');
                })
            ).rejects.toThrow('Invalid credentials');
        });
    });


    // ── logout ────────────────────────────────────────────────────────────
    describe('logout', () => {
        it('clears token, user, and localStorage', async () => {
            localStorage.setItem('authToken', 'jwt');
            localStorage.setItem('authUser', '{"id":"u1"}');
            vi.stubGlobal('fetch', mockFetchResponse(true, { id: 'u1', email: 'x@y.com' }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            act(() => result.current.logout());

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
            expect(localStorage.getItem('authToken')).toBeNull();
            expect(localStorage.getItem('authUser')).toBeNull();
        });
    });

    // ── Context Guard ─────────────────────────────────────────────────────
    describe('context guard', () => {
        it('useAuth throws outside AuthProvider', () => {
            expect(() => {
                renderHook(() => useAuth());
            }).toThrow('useAuth must be used within an AuthProvider');
        });
    });
});
