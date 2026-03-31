/**
 * Tests for useThreads hook
 * Covers: initial fetch, loadMore, pagination, deleteThread, error handling
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock ChatService ─────────────────────────────────────────────────────────
const { mockGetAllThreads, mockDeleteThread } = vi.hoisted(() => ({
    mockGetAllThreads: vi.fn(),
    mockDeleteThread: vi.fn(),
}));

vi.mock('../services/chat.service', () => ({
    default: {
        getAllThreads: mockGetAllThreads,
        deleteThread: mockDeleteThread,
    },
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useThreads } from '../features/chat/hooks/useThreads';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeThreads = (count, startId = 1) =>
    Array.from({ length: count }, (_, i) => ({
        sessionId: sessionIdPrefix + (startId + i),
        objectId: 'mongo-' + (startId + i),
        title: `Thread ${startId + i}`,
    }));

const sessionIdPrefix = 'sess-';

describe('useThreads', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // ── Initial fetch ─────────────────────────────────────────────────────
    describe('initial fetch', () => {
        it('fetches threads on mount and sets threads state', async () => {
            const threads = makeThreads(3);
            mockGetAllThreads.mockResolvedValueOnce({ threads, hasMore: false });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.threads).toEqual(threads);
            expect(mockGetAllThreads).toHaveBeenCalledWith(0, 10);
        });

        it('sets fetchError on failure', async () => {
            mockGetAllThreads.mockRejectedValueOnce(new Error('Network error'));

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.fetchError).toBe('Failed to load chat history');
            expect(result.current.threads).toEqual([]);
        });
    });

    // ── loadMore ──────────────────────────────────────────────────────────
    describe('loadMore', () => {
        it('appends new threads without duplicates', async () => {
            // First load: full page (20 items)
            const firstPage = makeThreads(20);
            mockGetAllThreads.mockResolvedValueOnce({ threads: firstPage, hasMore: true });
            // Page 2 eager load
            mockGetAllThreads.mockResolvedValueOnce({ threads: [], hasMore: true });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasMore).toBe(true);

            // Load more: 5 items
            const secondPage = makeThreads(5, 21);
            mockGetAllThreads.mockResolvedValueOnce({ threads: secondPage, hasMore: false });

            await act(async () => {
                result.current.loadMore();
            });

            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });

            expect(result.current.threads).toHaveLength(25);
            expect(result.current.hasMore).toBe(false);
        });

        it('does not fetch when already fetching more', async () => {
            mockGetAllThreads.mockResolvedValue({ threads: makeThreads(20), hasMore: true });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Start a slow second fetch
            let resolveFetch;
            mockGetAllThreads.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

            act(() => { result.current.loadMore(); });

            // Try to loadMore again while still fetching
            act(() => { result.current.loadMore(); });

            // Should only have called once for the load more after initial eager loads
            expect(mockGetAllThreads).toHaveBeenCalledTimes(3); 

            // Clean up
            resolveFetch(makeThreads(5, 21));
            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });
        });

        it('does not fetch when hasMore is false', async () => {
            mockGetAllThreads.mockResolvedValueOnce({ threads: makeThreads(5), hasMore: false });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasMore).toBe(false);

            act(() => { result.current.loadMore(); });

            // Should not have called getAllThreads again beyond initial load
            expect(mockGetAllThreads).toHaveBeenCalledTimes(1);
        });

        it('sets fetchError on loadMore failure', async () => {
            mockGetAllThreads.mockResolvedValue({ threads: makeThreads(20), hasMore: true });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            mockGetAllThreads.mockRejectedValueOnce(new Error('fail'));

            await act(async () => {
                result.current.loadMore();
            });

            await waitFor(() => {
                expect(result.current.isFetchingMore).toBe(false);
            });

            expect(result.current.fetchError).toBe('Failed to load more chat history');
        });
    });

    // ── deleteThread ──────────────────────────────────────────────────────
    describe('deleteThread', () => {
        it('removes the thread from state on success', async () => {
            const threads = makeThreads(3);
            mockGetAllThreads.mockResolvedValue({ threads, hasMore: false });
            mockDeleteThread.mockResolvedValue(true);

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteThread('sess-2');
            });

            expect(success).toBe(true);
            expect(result.current.threads).toHaveLength(2);
            expect(result.current.threads.some(t => t.sessionId === 'sess-2')).toBe(false);
            expect(mockDeleteThread).toHaveBeenCalledWith('mongo-2');
        });

        it('returns false on failure without removing', async () => {
            mockGetAllThreads.mockResolvedValue({ threads: makeThreads(3), hasMore: false });
            mockDeleteThread.mockRejectedValue(new Error('Forbidden'));

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteThread('sess-1');
            });

            expect(success).toBe(false);
            expect(result.current.threads).toHaveLength(3);
        });

        it('returns false for null sessionId', async () => {
            mockGetAllThreads.mockResolvedValue({ threads: [], hasMore: false });

            const { result } = renderHook(() => useThreads());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let success;
            await act(async () => {
                success = await result.current.deleteThread(null);
            });

            expect(success).toBe(false);
        });
    });
});
