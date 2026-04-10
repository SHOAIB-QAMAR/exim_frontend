/**
 * Tests for useSessions hook
 * Covers: initial fetch, loadMore, pagination, deleteSession, error handling
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock ChatService ─────────────────────────────────────────────────────────
const { mockGetAllSessions, mockDeleteSession } = vi.hoisted(() => ({
    mockGetAllSessions: vi.fn(),
    mockDeleteSession: vi.fn(),
}));

vi.mock('../services/chat.service', () => ({
    default: {
        getAllSessions: mockGetAllSessions,
        deleteSession: mockDeleteSession,
    },
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useSessions } from '../features/chat/hooks/useSessions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSessions = (count, startId = 1) =>
    Array.from({ length: count }, (_, i) => ({
        sessionId: sessionIdPrefix + (startId + i),
        title: `Session ${startId + i}`,
    }));

const sessionIdPrefix = 'sess-';

describe('useSessions', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // ── Initial fetch ─────────────────────────────────────────────────────
    describe('initial fetch', () => {
        it('fetches sessions on mount and sets sessions state', async () => {
            const sessionsData = makeSessions(3);
            mockGetAllSessions.mockResolvedValueOnce({ sessions: sessionsData, hasMore: false });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.sessions).toEqual(sessionsData);
            expect(mockGetAllSessions).toHaveBeenCalledWith(0, 10);
        });

        it('sets sessions to empty on failure', async () => {
            mockGetAllSessions.mockRejectedValueOnce(new Error('Network error'));

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.sessions).toEqual([]);
        });
    });

    // ── loadMore ──────────────────────────────────────────────────────────
    describe('loadMore', () => {
        it('appends new sessions without duplicates', async () => {
            // First load: full page (20 items)
            const firstPage = makeSessions(20);
            mockGetAllSessions.mockResolvedValueOnce({ sessions: firstPage, hasMore: true });
            // Page 2 eager load
            mockGetAllSessions.mockResolvedValueOnce({ sessions: [], hasMore: true });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasMore).toBe(true);

            // Load more: 5 items
            const secondPage = makeSessions(5, 21);
            mockGetAllSessions.mockResolvedValueOnce({ sessions: secondPage, hasMore: false });

            await act(async () => {
                result.current.loadMore();
            });

            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });

            expect(result.current.sessions).toHaveLength(25);
            expect(result.current.hasMore).toBe(false);
        });

        it('does not fetch when already fetching more', async () => {
            mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(20), hasMore: true });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Start a slow second fetch
            let resolveFetch;
            mockGetAllSessions.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

            act(() => { result.current.loadMore(); });

            // Try to loadMore again while still fetching
            act(() => { result.current.loadMore(); });

            // Should only have called once for the load more after initial eager loads
            expect(mockGetAllSessions).toHaveBeenCalledTimes(3); 

            // Clean up
            resolveFetch({ sessions: makeSessions(5, 21), hasMore: false });
            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });
        });

        it('does not fetch when hasMore is false', async () => {
            mockGetAllSessions.mockResolvedValueOnce({ sessions: makeSessions(5), hasMore: false });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasMore).toBe(false);

            act(() => { result.current.loadMore(); });

            // Should not have called getAllSessions again beyond initial load
            expect(mockGetAllSessions).toHaveBeenCalledTimes(1);
        });

        it('handles loadMore failure gracefully', async () => {
            mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(20), hasMore: true });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            mockGetAllSessions.mockRejectedValueOnce(new Error('fail'));

            await act(async () => {
                result.current.loadMore();
            });

            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });
        });
    });

    // ── deleteSession ─────────────────────────────────────────────────────
    describe('deleteSession', () => {
        it('removes the session from state on success', async () => {
            const sessionsData = makeSessions(3);
            mockGetAllSessions.mockResolvedValue({ sessions: sessionsData, hasMore: false });
            mockDeleteSession.mockResolvedValue(true);

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteSession('sess-2');
            });

            expect(success).toBe(true);
            expect(result.current.sessions).toHaveLength(2);
            expect(result.current.sessions.some(s => s.sessionId === 'sess-2')).toBe(false);
            expect(mockDeleteSession).toHaveBeenCalledWith('sess-2');
        });

        it('returns false on failure without removing', async () => {
            mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(3), hasMore: false });
            mockDeleteSession.mockRejectedValue(new Error('Forbidden'));

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteSession('sess-1');
            });

            expect(success).toBe(false);
            expect(result.current.sessions).toHaveLength(3);
        });

        it('returns false for null sessionId', async () => {
            mockGetAllSessions.mockResolvedValue({ sessions: [], hasMore: false });

            const { result } = renderHook(() => useSessions());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteSession(null);
            });

            expect(success).toBe(false);
        });
    });
});
