/**
 * Tests for useChatSessions hook
 * Covers: new chat, load (success/failure), close (single/multi), LRU eviction
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock uuid ────────────────────────────────────────────────────────────────
// Use a module-level counter; the factory runs in the hoisted scope so a plain
// let is fine here (it's not inside a vi.mock factory).
let idCounter = 0;
vi.mock('uuid', () => ({
    v1: () => `mock-id-${++idCounter}`,
}));

// ─── Mock ChatService ─────────────────────────────────────────────────────────
// vi.hoisted() ensures the variable is created before vi.mock() hoisting runs.
const { mockGetThreadMessages } = vi.hoisted(() => ({
    mockGetThreadMessages: vi.fn(),
}));

vi.mock('../services/chat.service', () => ({
    default: { getThreadMessages: mockGetThreadMessages },
}));

// ─── Mock logger (suppress noise) ────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useChatSessions } from '../features/chat/hooks/useChatSessions';

describe('useChatSessions', () => {
    beforeEach(() => {
        idCounter = 0;
        localStorage.clear();
        vi.clearAllMocks();
    });

    // ── handleNewChat ───────────────────────────────────────────────────────
    describe('handleNewChat', () => {
        it('creates a new session and makes it active', () => {
            const { result } = renderHook(() => useChatSessions());

            act(() => result.current.handleNewChat());

            expect(result.current.activeSessions).toHaveLength(2);
            expect(result.current.activeSessionId).toBe(result.current.activeSessions[1].id);
        });

        it('calls closeMobileSidebar if provided', () => {
            const close = vi.fn();
            const { result } = renderHook(() => useChatSessions([], close));

            act(() => result.current.handleNewChat());

            expect(close).toHaveBeenCalledOnce();
        });
    });

    // ── LRU eviction ──────────────────────────────────────────────────────
    describe('LRU eviction', () => {
        it('evicts the oldest session when limit (6) is reached', async () => {
            const { result } = renderHook(() => useChatSessions());

            // Open 5 more tabs (total = 6)
            for (let i = 0; i < 5; i++) {
                act(() => result.current.handleNewChat());
            }
            expect(result.current.activeSessions).toHaveLength(6);

            // The first session was created with id "mock-id-1"
            const firstId = 'mock-id-1';
            expect(result.current.activeSessions.some(s => s.id === firstId)).toBe(true);

            // Open one more — should evict the LRU (first session)
            act(() => result.current.handleNewChat());

            expect(result.current.activeSessions).toHaveLength(6);
            expect(result.current.activeSessions.some(s => s.id === firstId)).toBe(false);
        });
    });

    // ── handleTabClose ────────────────────────────────────────────────────
    describe('handleTabClose', () => {
        it('resets to a fresh session when the only tab is closed', () => {
            const { result } = renderHook(() => useChatSessions());
            const originalId = result.current.activeSessionId;

            act(() => result.current.handleTabClose(originalId));

            expect(result.current.activeSessions).toHaveLength(1);
            // A brand-new session should have been created
            expect(result.current.activeSessionId).not.toBe(originalId);
        });

        it('removes a tab (not active) without changing the active session', () => {
            const { result } = renderHook(() => useChatSessions());
            act(() => result.current.handleNewChat());   // now 2 sessions

            const [firstSession] = result.current.activeSessions;
            const activeId = result.current.activeSessionId; // second session

            act(() => result.current.handleTabClose(firstSession.id));

            expect(result.current.activeSessions).toHaveLength(1);
            expect(result.current.activeSessionId).toBe(activeId);
        });

        it('switches to last remaining session when active tab is closed', () => {
            const { result } = renderHook(() => useChatSessions());
            act(() => result.current.handleNewChat());   // now 2 sessions

            const secondId = result.current.activeSessionId;

            act(() => result.current.handleTabClose(secondId));

            expect(result.current.activeSessions).toHaveLength(1);
            expect(result.current.activeSessionId).toBe(result.current.activeSessions[0].id);
        });
    });

    // ── handleLoadChat ────────────────────────────────────────────────────
    describe('handleLoadChat', () => {
        it('fetches messages and updates the session on success', async () => {
            const fakeMessages = [{ role: 'user', content: 'hello' }];
            mockGetThreadMessages.mockResolvedValue({ messages: fakeMessages, hasMore: false });

            const threads = [{ threadId: 'thread-abc', title: 'My Thread' }];
            const { result } = renderHook(() => useChatSessions(threads));

            await act(async () => {
                await result.current.handleLoadChat('thread-abc');
            });

            const session = result.current.activeSessions.find(s => s.id === 'thread-abc');
            expect(session).toBeDefined();
            expect(session.messages).toEqual(fakeMessages);
            expect(session.title).toBe('My Thread');
            expect(session.isThinking).toBe(false);
        });

        it('sets title to "Failed to load" when fetch throws', async () => {
            mockGetThreadMessages.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useChatSessions());

            await act(async () => {
                await result.current.handleLoadChat('thread-xyz');
            });

            const session = result.current.activeSessions.find(s => s.id === 'thread-xyz');
            expect(session).toBeDefined();
            expect(session.title).toBe('Failed to load');
            expect(session.isThinking).toBe(false);
        });

        it('switches to an already-open session without fetching again', async () => {
            const { result } = renderHook(() => useChatSessions());
            const existingId = result.current.activeSessionId;

            // Put some messages in the existing session
            act(() => result.current.setActiveSessions(prev =>
                prev.map(s => s.id === existingId ? { ...s, messages: [{ role: 'user', content: 'hi' }] } : s)
            ));

            // Open a second session so existing isn't active
            act(() => result.current.handleNewChat());

            await act(async () => {
                await result.current.handleLoadChat(existingId);
            });

            expect(mockGetThreadMessages).not.toHaveBeenCalled();
            expect(result.current.activeSessionId).toBe(existingId);
        });

        it('does nothing when called with null', async () => {
            const { result } = renderHook(() => useChatSessions());
            const before = result.current.activeSessions.length;

            await act(async () => { await result.current.handleLoadChat(null); });

            expect(result.current.activeSessions).toHaveLength(before);
        });
    });
});
