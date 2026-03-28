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

    // ── connectThread ─────────────────────────────────────────────────────
    describe('connectThread', () => {
        it('adds the thread to activeThreads', () => {
            service.connectThread('t1');
            expect(service.activeThreads.has('t1')).toBe(true);
        });

        it('schedules a WebSocket connection', () => {
            service.connectThread('t1');
            expect(service.connectTimer).not.toBeNull();
        });

        it('does not create duplicate entries for the same thread', () => {
            service.connectThread('t1');
            service.connectThread('t1');
            expect(service.activeThreads.size).toBe(1);
        });
    });

    // ── disconnectThread ──────────────────────────────────────────────────
    describe('disconnectThread', () => {
        it('removes the thread from activeThreads', () => {
            service.connectThread('t1');
            service.disconnectThread('t1');
            expect(service.activeThreads.has('t1')).toBe(false);
        });

        it('schedules disconnect when no threads remain', () => {
            service.connectThread('t1');
            service.disconnectThread('t1');
            expect(service.disconnectTimer).not.toBeNull();
        });

        it('does not schedule disconnect when other threads remain', () => {
            service.connectThread('t1');
            service.connectThread('t2');
            service.disconnectThread('t1');
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
        it('calls all registered subscribers with threadId and message', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            service.subscribe(cb1);
            service.subscribe(cb2);

            service._notifySubscribers('t1', { type: 'test' });

            expect(cb1).toHaveBeenCalledWith('t1', { type: 'test' });
            expect(cb2).toHaveBeenCalledWith('t1', { type: 'test' });
        });

        it('does not throw if a subscriber throws', () => {
            service.subscribe(() => { throw new Error('boom'); });
            expect(() => service._notifySubscribers('t1', {})).not.toThrow();
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
            const result = service.sendMessage('t1', { content: 'hello' });
            // _sendViaWebSocket queues and calls _scheduleConnect when socket is null
            expect(result).toBe(true);
            expect(service.messageQueue.length).toBeGreaterThan(0);
        });

        it('emits gpt_query via socket.emit when connected', () => {
            mockSocket.connected = true;
            service.socket = mockSocket;
            const payload = { question: 'hello', thread_id: 't1' };
            const result = service.sendMessage('t1', payload);

            expect(result).toBe(true);
            expect(mockEmit).toHaveBeenCalledWith('gpt_query', payload);
        });

        it('queues message when socket is not connected', () => {
            mockSocket.connected = false;
            service.socket = mockSocket;
            service.reconnectAttempts = 1;
            const payload = { question: 'hello' };
            const result = service.sendMessage('t1', payload);

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
            service.connectThread('t1');
            service.reconnectAttempts = 3;
            service.connectTimer = setTimeout(() => { }, 1000);
            service.disconnectTimer = setTimeout(() => { }, 1000);
            service.socket = mockSocket;

            service.forceClose();

            expect(service.isExplicitlyDisconnected).toBe(true);
            expect(service.activeThreads.size).toBe(0);
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
                data: { threadId: 't1', type: 'message_chunk', content: 'hi' }
            });

            expect(cb).toHaveBeenCalledWith('t1', expect.objectContaining({ type: 'message_chunk' }));
        });

        it('parses string JSON data and notifies subscribers', () => {
            const cb = vi.fn();
            service.subscribe(cb);

            service._handleMessage({
                data: JSON.stringify({ threadId: 't1', type: 'done' })
            });

            expect(cb).toHaveBeenCalledWith('t1', expect.objectContaining({ type: 'done' }));
        });

        it('parses backend-specific format (session_id and response)', () => {
            const cb = vi.fn();
            service.subscribe(cb);

            service._handleMessage({
                data: { session_id: 't1', response: 'hello chunk' }
            });

            expect(cb).toHaveBeenCalledWith('t1', expect.objectContaining({ response: 'hello chunk' }));
        });

        it('does not throw on null data', () => {
            expect(() => service._handleMessage({ data: null })).not.toThrow();
        });
    });

    // ── retryConnection ───────────────────────────────────────────────────
    describe('retryConnection', () => {
        it('resets reconnect attempts and schedules connect', () => {
            service.reconnectAttempts = 4;
            service.activeThreads.add('t1');

            service.retryConnection();

            expect(service.reconnectAttempts).toBe(0);
        });
    });

    // ── _createSocket ─────────────────────────────────────────────────────
    describe('_createSocket', () => {
        it('does not connect when no active threads', () => {
            service._createSocket();
            expect(service.socket).toBeNull();
        });

        it('creates a Socket.IO connection when threads exist', () => {
            const ioMock = vi.mocked(ioImport);
            ioMock.mockClear();
            service.activeThreads.add('t1');
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
            service.activeThreads.add('t1');
            service._createSocket();

            const callArgs = ioMock.mock.calls[0][1];
            expect(callArgs.auth).toBeUndefined();
            expect(callArgs.query).toBeUndefined();
        });
    });
});
