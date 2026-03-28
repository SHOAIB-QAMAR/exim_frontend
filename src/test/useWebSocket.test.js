/**
 * Tests for useWebSocket hook — focusing on handleMessage logic for each data.type.
 * The WebSocketContext is mocked so no real sockets are involved.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock WebSocket context ───────────────────────────────────────────────────
const mockSubscribe = vi.fn(() => vi.fn());   // returns an unsubscribe fn
const mockConnectSession = vi.fn();
const mockDisconnectSession = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('../features/chat/context/WebSocketContext', () => ({
    useWebSocketService: () => ({
        subscribe: mockSubscribe,
        connectSession: mockConnectSession,
        disconnectSession: mockDisconnectSession,
        sendMessage: mockSendMessage,
    }),
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useWebSocket } from '../features/chat/hooks/useWebSocket';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSession = (overrides = {}) => ({
    id: 'sess-1',
    messages: [],
    isThinking: false,
    thinkingSteps: [],
    ...overrides,
});

/**
 * Run handleMessage for a given data payload on a session and return
 * the resulting updated session.
 */
function runHandleMessage(sessionState, data) {
    vi.useFakeTimers();
    let capturedSessions = [sessionState];
    const setActiveSessions = vi.fn(updater => {
        capturedSessions = updater(capturedSessions);
    });

    renderHook(() =>
        useWebSocket(
            capturedSessions,
            setActiveSessions,
            'sess-1',
            vi.fn(),
            vi.fn(),
            vi.fn()
        )
    );

    // The subscribe callback is the handleMessage function
    const handleMessage = mockSubscribe.mock.calls[0][0];

    act(() => {
        handleMessage('sess-1', data);
    });

    // Advance timers to trigger debounced state updates if a chunk was received
    act(() => {
        vi.advanceTimersByTime(100);
    });

    const result = capturedSessions[0];
    vi.useRealTimers();
    return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useWebSocket — handleMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset subscribe mock to always return an unsubscribe function
        mockSubscribe.mockReturnValue(vi.fn());
    });

    // ── status ─────────────────────────────────────────────────────────────
    describe('type: status', () => {
        it('appends an in-progress thinking step', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'status',
                status: 'in-progress',
                message: 'Analysing query',
            });

            expect(session.isThinking).toBe(true);
            expect(session.thinkingSteps).toHaveLength(1);
            expect(session.thinkingSteps[0].status).toBe('in-progress');
            expect(session.thinkingSteps[0].message).toBe('Analysing query');
        });

        it('updates the last in-progress step to completed', () => {
            const initial = makeSession({
                isThinking: true,
                thinkingSteps: [{ message: 'Analysing', status: 'in-progress', type: 'status' }],
            });

            const session = runHandleMessage(initial, {
                type: 'status',
                status: 'completed',
                message: 'Analysing',
                time: 1.2,
            });

            expect(session.thinkingSteps).toHaveLength(1);
            expect(session.thinkingSteps[0].status).toBe('completed');
            expect(session.thinkingSteps[0].time).toBe(1.2);
        });
    });

    // ── phase_complete ──────────────────────────────────────────────────────
    describe('type: phase_complete', () => {
        it('appends a phase completed step', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'phase_complete',
                phase: 'analysis',
                time: 2.5,
            });

            expect(session.thinkingSteps).toHaveLength(1);
            expect(session.thinkingSteps[0].type).toBe('phase');
            expect(session.thinkingSteps[0].message).toBe('Analysis complete');
            expect(session.thinkingSteps[0].status).toBe('completed');
        });

        it('ignores unknown phase keys', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'phase_complete',
                phase: 'unknown_phase',
            });

            expect(session.thinkingSteps).toHaveLength(0);
        });
    });

    // ── tool_call ───────────────────────────────────────────────────────────
    describe('type: tool_call', () => {
        it('appends a tool_call thinking step', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'tool_call',
                name: 'search_database',
                args: { query: 'exim rates' },
                status: 'in-progress',
            });

            expect(session.thinkingSteps).toHaveLength(1);
            expect(session.thinkingSteps[0].type).toBe('tool_call');
            expect(session.thinkingSteps[0].message).toBe('Calling: search_database');
            expect(session.thinkingSteps[0].details).toEqual({ query: 'exim rates' });
        });
    });

    // ── tool_result ─────────────────────────────────────────────────────────
    describe('type: tool_result', () => {
        it('appends a tool_result thinking step', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'tool_result',
                content: { result: 'some data' },
                time: 0.8,
            });

            expect(session.thinkingSteps).toHaveLength(1);
            expect(session.thinkingSteps[0].type).toBe('tool_result');
            expect(session.thinkingSteps[0].status).toBe('completed');
            expect(session.thinkingSteps[0].details).toEqual({ result: 'some data' });
        });
    });

    // ── message_start ───────────────────────────────────────────────────────
    describe('type: message_start', () => {
        it('sets isThinking to false (switches to text mode)', () => {
            const session = runHandleMessage(makeSession({ isThinking: true }), {
                type: 'message_start',
            });

            expect(session.isThinking).toBe(false);
        });
    });

    // ── message_chunk ───────────────────────────────────────────────────────
    describe('type: message_chunk', () => {
        it('creates a new streaming assistant message bubble', () => {
            const session = runHandleMessage(makeSession(), {
                type: 'message_chunk',
                content: 'Hello',
            });

            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].role).toBe('assistant');
            expect(session.messages[0].content).toBe('Hello');
            expect(session.messages[0].isStreaming).toBe(true);
        });

        it('appends content to an existing streaming bubble', () => {
            const initial = makeSession({
                messages: [{ role: 'assistant', content: 'Hello', isStreaming: true }],
            });

            const session = runHandleMessage(initial, {
                type: 'message_chunk',
                content: ' World',
            });

            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].content).toBe('Hello World');
        });
    });

    // ── message_end / done ──────────────────────────────────────────────────
    describe('type: message_end / done', () => {
        it('marks the last message as no longer streaming', () => {
            const initial = makeSession({
                messages: [{ role: 'assistant', content: 'Hello', isStreaming: true }],
            });

            const session = runHandleMessage(initial, { type: 'message_end' });

            expect(session.messages[0].isStreaming).toBe(false);
            expect(session.messages[0].isNew).toBe(true);
            expect(session.isThinking).toBe(false);
        });

        it('works the same for type: done', () => {
            const initial = makeSession({
                messages: [{ role: 'assistant', content: 'Hi', isStreaming: true }],
            });

            const session = runHandleMessage(initial, { type: 'done' });

            expect(session.messages[0].isStreaming).toBe(false);
        });
    });

    // ── timing ──────────────────────────────────────────────────────────────
    describe('type: timing', () => {
        it('sets metrics on the session', () => {
            const timingData = { total: 1.5, llm: 1.0, tools: 0.5 };

            const session = runHandleMessage(makeSession(), {
                type: 'timing',
                data: timingData,
            });

            expect(session.metrics).toEqual(timingData);
        });
    });

    // ── error ───────────────────────────────────────────────────────────────
    describe('type: error', () => {
        it('appends an error message and clears thinking state', () => {
            const session = runHandleMessage(makeSession({ isThinking: true }), {
                type: 'error',
                message: 'Something went wrong',
            });

            expect(session.isThinking).toBe(false);
            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].content).toBe('Error: Something went wrong');
        });
    });

    // ── Legacy format ──────────────────────────────────────────────────────
    describe('legacy format (chunk / done / reply)', () => {
        it('creates assistant message for a new chunk', () => {
            const session = runHandleMessage(makeSession(), {
                chunk: 'streaming text',
                done: false,
            });

            expect(session.messages[0].content).toBe('streaming text');
            expect(session.messages[0].isStreaming).toBe(true);
        });

        it('finalises streaming on done: true', () => {
            const initial = makeSession({
                messages: [{ role: 'assistant', content: 'streaming text', isStreaming: true }],
            });

            const session = runHandleMessage(initial, { done: true });

            expect(session.messages[0].isStreaming).toBe(false);
            expect(session.isThinking).toBe(false);
        });

        it('appends a complete reply (non-streaming)', () => {
            const session = runHandleMessage(makeSession(), { reply: 'Full answer.' });

            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].content).toBe('Full answer.');
            expect(session.isThinking).toBe(false);
        });
    });

    // ── Unknown type ────────────────────────────────────────────────────────
    describe('unknown type', () => {
        it('returns the session unchanged', () => {
            const initial = makeSession({ messages: [{ role: 'user', content: 'hi' }] });
            const session = runHandleMessage(initial, { type: 'something_weird' });

            expect(session.messages).toHaveLength(1);
        });
    });

    // ── No sessionId ──────────────────────────────────────────────────────
    describe('missing sessionId', () => {
        it('returns without modifying sessions when sessionId is falsy', () => {
            let capturedSessions = [makeSession()];
            const setActiveSessions = vi.fn(updater => {
                capturedSessions = updater(capturedSessions);
            });

            renderHook(() =>
                useWebSocket(capturedSessions, setActiveSessions, 'sess-1', vi.fn(), vi.fn(), vi.fn())
            );

            const handleMessage = mockSubscribe.mock.calls[0][0];
            act(() => handleMessage(null, { type: 'message_chunk', content: 'hi' }));

            expect(setActiveSessions).not.toHaveBeenCalled();
        });
    });
});
