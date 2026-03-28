/**
 * Tests for SharedWebSocketService
 * Covers: connection lifecycle, messaging, reconnection, subscriber management, forceClose
 *
 * NOTE: The service uses Socket.IO (not raw WebSocket). Tests mock Socket.IO's `io()`.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioImport } from 'socket.io-client';

// ─── Mock dependencies ───────────────────────────────────────────────────────
vi.mock('../services/api.config', () => ({
    default: {
        BASE_URL: 'http://test-host',
        WS_BASE_URL: 'ws://test-host',
        endpoints: { CHAT_WS: '/ws/chat', THREAD: '/api/thread', UPLOAD: '/api/upload' },
        SOCKET_IO_URL: 'https://test-socketio-host'
    }
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), group: vi.fn(), groupEnd: vi.fn() }
}));



// Mock socket.io-client
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
const mockConnect = vi.fn();
const mockOn = vi.fn();
const mockOnAny = vi.fn();
const mockOnAnyOutgoing = vi.fn();

const mockSocket = {
    connected: false,
    connecting: false,
    emit: mockEmit,
    disconnect: mockDisconnect,
    connect: mockConnect,
    on: mockOn,
    onAny: mockOnAny,
    onAnyOutgoing: mockOnAnyOutgoing,
    io: {
        opts: { path: '/socket.io' },
        engine: {
            readyState: 'open',
            on: vi.fn(),
            transport: { name: 'websocket' }
        },
        on: vi.fn()
    }
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket)
}));

import SharedWebSocketService from '../services/SharedWebSocketService';

describe('SharedWebSocketService', () => {
    let service;

    beforeEach(() => {
        vi.useFakeTimers();
        SharedWebSocketService.instance = null;
        service = new SharedWebSocketService();
        // Reset mock socket state
        mockSocket.connected = false;
        mockSocket.connecting = false;
    });

    afterEach(() => {
        service.forceClose();
        vi.useRealTimers();
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── connectSession ────────────────────────────────────────────────────
    describe('connectSession', () => {
        it('adds the session to activeSessions', () => {
            service.connectSession('s1');
            expect(service.activeSessions.has('s1')).toBe(true);
        });

        it('schedules a WebSocket connection', () => {
            service.connectSession('s1');
            expect(service.connectTimer).not.toBeNull();
        });

        it('does not create duplicate entries for the same session', () => {
            service.connectSession('s1');
            service.connectSession('s1');
            expect(service.activeSessions.size).toBe(1);
        });
    });

    // ── disconnectSession ─────────────────────────────────────────────────
    describe('disconnectSession', () => {
        it('removes the session from activeSessions', () => {
            service.connectSession('s1');
            service.disconnectSession('s1');
            expect(service.activeSessions.has('s1')).toBe(false);
        });

        it('schedules disconnect when no sessions remain', () => {
            service.connectSession('s1');
            service.disconnectSession('s1');
            expect(service.disconnectTimer).not.toBeNull();
        });

        it('does not schedule disconnect when other sessions remain', () => {
            service.connectSession('s1');
            service.connectSession('s2');
            service.disconnectSession('s1');
            expect(service.disconnectTimer).toBeNull();
        });
    });

    // ── subscribe / unsubscribe ───────────────────────────────────────────
    describe('subscribe', () => {
        it('adds a callback and returns an unsubscribe function', () => {
            const cb = vi.fn();
            const unsub = service.subscribe(cb);

            expect(service.subscribers.has(cb)).toBe(true);
            unsub();
            expect(service.subscribers.has(cb)).toBe(false);
        });
    });

    describe('subscribeToErrors', () => {
        it('adds an error callback and returns an unsubscribe function', () => {
            const cb = vi.fn();
            const unsub = service.subscribeToErrors(cb);

            expect(service.errorSubscribers.has(cb)).toBe(true);
            unsub();
            expect(service.errorSubscribers.has(cb)).toBe(false);
        });
    });

    // ── _notifySubscribers ────────────────────────────────────────────────
    describe('_notifySubscribers', () => {
        it('calls all registered subscribers with sessionId and message', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            service.subscribe(cb1);
            service.subscribe(cb2);

            service._notifySubscribers('s1', { type: 'test' });

            expect(cb1).toHaveBeenCalledWith('s1', { type: 'test' });
            expect(cb2).toHaveBeenCalledWith('s1', { type: 'test' });
        });

        it('does not throw if a subscriber throws', () => {
            service.subscribe(() => { throw new Error('boom'); });
            expect(() => service._notifySubscribers('s1', {})).not.toThrow();
        });
    });

    // ── _notifyErrorSubscribers ───────────────────────────────────────────
    describe('_notifyErrorSubscribers', () => {
        it('calls all error subscribers with the error', () => {
            const cb = vi.fn();
            service.subscribeToErrors(cb);
            service._notifyErrorSubscribers('Connection lost');

            expect(cb).toHaveBeenCalledWith('Connection lost');
        });
    });

    // ── sendMessage ───────────────────────────────────────────────────────
    describe('sendMessage', () => {
        it('queues message and returns true when socket is null (triggers reconnect)', () => {
            service.socket = null;
            const result = service.sendMessage('s1', { content: 'hello' });
            // _sendViaWebSocket queues and calls _scheduleConnect when socket is null
            expect(result).toBe(true);
            expect(service.messageQueue.length).toBeGreaterThan(0);
        });

        it('emits gpt_query via socket.emit when connected', () => {
            mockSocket.connected = true;
            service.socket = mockSocket;
            const payload = { question: 'hello', session_id: 's1' };
            const result = service.sendMessage('s1', payload);

            expect(result).toBe(true);
            expect(mockEmit).toHaveBeenCalledWith('gpt_query', expect.objectContaining({ session_id: 's1' }));
        });

        it('queues message when socket is not connected', () => {
            mockSocket.connected = false;
            service.socket = mockSocket;
            service.reconnectAttempts = 1;
            const payload = { question: 'hello' };
            const result = service.sendMessage('s1', payload);

            expect(result).toBe(true);
            expect(service.messageQueue.length).toBeGreaterThan(0);
            expect(mockEmit).not.toHaveBeenCalled();
        });
    });

    // ── _flushMessageQueue ────────────────────────────────────────────────
    describe('_flushMessageQueue', () => {
        it('emits all queued messages when socket is connected', () => {
            mockSocket.connected = true;
            service.socket = mockSocket;
            service.messageQueue = [{ q: 'msg1' }, { q: 'msg2' }];

            service._flushMessageQueue();

            expect(mockEmit).toHaveBeenCalledTimes(2);
            expect(service.messageQueue).toHaveLength(0);
        });

        it('re-queues messages when socket is not connected', () => {
            mockSocket.connected = false;
            service.socket = mockSocket;
            service.messageQueue = [{ q: 'msg1' }];

            service._flushMessageQueue();

            expect(service.messageQueue).toHaveLength(1);
        });

        it('does nothing when queue is empty', () => {
            service.messageQueue = [];
            service._flushMessageQueue();
            expect(service.messageQueue).toHaveLength(0);
        });
    });

    // ── forceClose ────────────────────────────────────────────────────────
    describe('forceClose', () => {
        it('clears all timers and resets state', () => {
            service.connectSession('s1');
            service.reconnectAttempts = 3;
            service.connectTimer = setTimeout(() => { }, 1000);
            service.disconnectTimer = setTimeout(() => { }, 1000);
            service.socket = mockSocket;

            service.forceClose();

            expect(service.isExplicitlyDisconnected).toBe(true);
            expect(service.activeSessions.size).toBe(0);
            expect(service.reconnectAttempts).toBe(0);
            expect(service.connectTimer).toBeNull();
            expect(service.disconnectTimer).toBeNull();
            expect(service.reconnectTimer).toBeNull();
            expect(service.socket).toBeNull();
            expect(mockDisconnect).toHaveBeenCalled();
        });

        it('clears the message queue', () => {
            service.messageQueue = ['m1', 'm2'];
            service.forceClose();
            expect(service.messageQueue).toHaveLength(0);
        });
    });

    // ── _handleReconnection ───────────────────────────────────────────────
    describe('_handleReconnection', () => {
        it('notifies error subscribers when max attempts reached', () => {
            const cb = vi.fn();
            service.subscribeToErrors(cb);
            service.reconnectAttempts = 5;

            service._handleReconnection();

            expect(cb).toHaveBeenCalledWith(expect.stringContaining('Unable to connect'));
        });

        it('does not notify error subscribers when under max attempts', () => {
            const cb = vi.fn();
            service.subscribeToErrors(cb);
            service.reconnectAttempts = 2;

            service._handleReconnection();

            expect(cb).not.toHaveBeenCalled();
        });
    });

    // ── _handleMessage ────────────────────────────────────────────────────
    describe('_handleMessage', () => {
        it('parses object data and notifies subscribers', () => {
            const cb = vi.fn();
            service.subscribe(cb);

            service._handleMessage({
                data: { sessionId: 's1', type: 'message_chunk', content: 'hi' }
            });

            expect(cb).toHaveBeenCalledWith('s1', expect.objectContaining({ type: 'message_chunk' }));
        });

        it('parses string JSON data and notifies subscribers', () => {
            const cb = vi.fn();
            service.subscribe(cb);

            service._handleMessage({
                data: JSON.stringify({ sessionId: 's1', type: 'done' })
            });

            expect(cb).toHaveBeenCalledWith('s1', expect.objectContaining({ type: 'done' }));
        });

        it('parses backend-specific format (session_id and response)', () => {
            const cb = vi.fn();
            service.subscribe(cb);

            service._handleMessage({
                data: { session_id: 's1', response: 'hello chunk' }
            });

            expect(cb).toHaveBeenCalledWith('s1', expect.objectContaining({ response: 'hello chunk' }));
        });

        it('does not throw on null data', () => {
            expect(() => service._handleMessage({ data: null })).not.toThrow();
        });
    });

    // ── retryConnection ───────────────────────────────────────────────────
    describe('retryConnection', () => {
        it('resets reconnect attempts and schedules connect', () => {
            service.reconnectAttempts = 4;
            service.activeSessions.add('s1');

            service.retryConnection();

            expect(service.reconnectAttempts).toBe(0);
        });
    });

    // ── _createSocket ─────────────────────────────────────────────────────
    describe('_createSocket', () => {
        it('does not connect when no active sessions', () => {
            service._createSocket();
            expect(service.socket).toBeNull();
        });

        it('creates a Socket.IO connection when sessions exist', () => {
            const ioMock = vi.mocked(ioImport);
            ioMock.mockClear();
            service.activeSessions.add('s1');
            service._createSocket();

            expect(ioMock).toHaveBeenCalledWith(
                'https://test-socketio-host',
                expect.objectContaining({
                    forceNew: true,
                    transports: ['polling', 'websocket']
                })
            );
            expect(service.socket).not.toBeNull();
        });

        it('does not pass auth or query token', () => {
            const ioMock = vi.mocked(ioImport);
            ioMock.mockClear();
            service.activeSessions.add('s1');
            service._createSocket();

            const callArgs = ioMock.mock.calls[0][1];
            expect(callArgs.auth).toBeUndefined();
            expect(callArgs.query).toBeUndefined();
        });
    });
});
