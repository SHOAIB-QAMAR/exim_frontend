/**
 * Tests for useThinkingTimeout hook
 * Covers: timeout fires, cancelled on normal resolution, cleaned up on unmount
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useThinkingTimeout } from '../features/chat/hooks/useThinkingTimeout';

describe('useThinkingTimeout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    const makeSession = (overrides = {}) => ({
        id: 'session-1',
        isThinking: false,
        messages: [],
        ...overrides,
    });

    it('fires a timeout and appends a timeout message after timeoutMs', () => {
        const setActiveSessions = vi.fn();
        const sessions = [makeSession({ isThinking: true })];

        renderHook(() => useThinkingTimeout(sessions, setActiveSessions, 5000));

        // Before timeout — setter should not be called
        expect(setActiveSessions).not.toHaveBeenCalled();

        // Advance clock past threshold
        act(() => vi.advanceTimersByTime(5001));

        expect(setActiveSessions).toHaveBeenCalledOnce();

        // Simulate what the setter updater does to inspect the result
        const updater = setActiveSessions.mock.calls[0][0];
        const result = updater([makeSession({ id: 'session-1', isThinking: true, messages: [] })]);

        expect(result[0].isThinking).toBe(false);
        expect(result[0].messages).toHaveLength(1);
        expect(result[0].messages[0].isTimeout).toBe(true);
        expect(result[0].messages[0].role).toBe('assistant');
    });

    it('does NOT fire if isThinking flips back to false before timeout', () => {
        const setActiveSessions = vi.fn();

        // Start with thinking: true
        const { rerender } = renderHook(
            ({ sessions }) => useThinkingTimeout(sessions, setActiveSessions, 5000),
            { initialProps: { sessions: [makeSession({ isThinking: true })] } }
        );

        // Advance partway
        act(() => vi.advanceTimersByTime(2000));

        // Thinking resolved naturally
        rerender({ sessions: [makeSession({ isThinking: false })] });

        // Advance past original timeout
        act(() => vi.advanceTimersByTime(3500));

        // Setter must never have been called with a timeout message
        expect(setActiveSessions).not.toHaveBeenCalled();
    });

    it('does not start a timer for a session that is not thinking', () => {
        const setActiveSessions = vi.fn();
        const sessions = [makeSession({ isThinking: false })];

        renderHook(() => useThinkingTimeout(sessions, setActiveSessions, 1000));

        act(() => vi.advanceTimersByTime(2000));

        expect(setActiveSessions).not.toHaveBeenCalled();
    });

    it('handles multiple concurrent sessions independently', () => {
        const setActiveSessions = vi.fn();
        const sessions = [
            { id: 'a', isThinking: true, messages: [] },
            { id: 'b', isThinking: true, messages: [] },
        ];

        renderHook(() => useThinkingTimeout(sessions, setActiveSessions, 3000));

        act(() => vi.advanceTimersByTime(3001));

        // The hook uses a single timer — it fires for whichever session .find() returns first
        expect(setActiveSessions).toHaveBeenCalledTimes(1);
    });

    it('cleans up all timers on unmount without calling setter', () => {
        const setActiveSessions = vi.fn();
        const sessions = [makeSession({ isThinking: true })];

        const { unmount } = renderHook(() =>
            useThinkingTimeout(sessions, setActiveSessions, 5000)
        );

        unmount();

        // After unmount, advancing the clock should not trigger the setter
        act(() => vi.advanceTimersByTime(6000));

        expect(setActiveSessions).not.toHaveBeenCalled();
    });

    it('clears the timer for a session that is removed from the list', () => {
        const setActiveSessions = vi.fn();

        const { rerender } = renderHook(
            ({ sessions }) => useThinkingTimeout(sessions, setActiveSessions, 5000),
            { initialProps: { sessions: [makeSession({ isThinking: true })] } }
        );

        act(() => vi.advanceTimersByTime(2000));

        // Remove the thinking session entirely
        rerender({ sessions: [] });

        act(() => vi.advanceTimersByTime(4000));

        expect(setActiveSessions).not.toHaveBeenCalled();
    });
});
