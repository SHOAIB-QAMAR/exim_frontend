import { io } from 'socket.io-client';
import API_CONFIG from './api.config';

// SharedWebSocketService (Singleton)
// Instead of giving every chat tab its own WebSocket (which strains server limits),
// this class pools all active tabs into a single, global, multiplexed WebSocket connection.

class SharedWebSocketService {

    static instance = null;

    constructor() {
        if (SharedWebSocketService.instance) {
            return SharedWebSocketService.instance;
        }

        SharedWebSocketService.instance = this;

        // The single Socket.IO connection shared across the entire app
        this.socket = null;

        // Set of callback functions registered by React hooks (useWebSocket) to receive incoming data
        this.subscribers = new Set();

        // Set of all chat session IDs currently open in the UI that require the socket
        this.activeSessions = new Set();
    }

    // ==================== CONNECTION MANAGEMENT ====================

    /**
     * Creates the Socket.IO connection and registers event listeners.
     * Only creates a new socket if one doesn't already exist or isn't connected.
     */
    _createSocket() {
        if (this.activeSessions.size === 0) return;

        if (this.socket && (this.socket.connected || this.socket.connecting)) {
            return;
        }

        // If socket exists but is disconnected, just reconnect instead of creating a new one
        if (this.socket) {
            this.socket.connect();
            return;
        }

        try {
            const url = API_CONFIG.SOCKET_IO_URL;

            this.socket = io(url, {
                forceNew: true,
                multiplex: false,
                transports: ['polling', 'websocket'],
                withCredentials: true,
                timeout: 30000
            });

            this.socket.connect();

            this.socket.on('connect', () => {
                console.log('[WS] Connected');
            });

            this.socket.on('query_response', (data) => {
                console.log('[WS] ← query_response', data);
                this._handleMessage({ data });
            });

            this.socket.on('connect_error', (error) => {
                console.warn('[WS] Connection error:', error.message || error);
            });

            this.socket.on('disconnect', (reason) => {
                console.log(`[WS] Disconnected (${reason})`);
            });

        } catch {
            // Connection creation failed
        }
    }

    /**
     * Disconnects and destroys the socket instance.
     */
    _closeSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // ==================== MESSAGE HANDLING ====================

    /**
     * Master routing handler.
     * Parses incoming query_response data and routes it to all subscribed React hooks.
     */
    _handleMessage(event) {
        try {
            // Socket.IO already parses JSON, but we'll be defensive
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (!data) return;

            // Extract the target sessionId for multiplexing
            const sessionId = data.session_id || data.sessionId || data.threadId || data.thread_id || data.chat_id;

            // Notify all local React UI components subscribed to this Service
            this._notifySubscribers(sessionId, data);

        } catch {
            // Message handling failed silently
        }
    }

    /**
     * Iterates through all active React hooks listening to the socket
     * and passes the data chunk upwards.
     */
    _notifySubscribers(sessionId, message) {
        this.subscribers.forEach(callback => {
            try { callback(sessionId, message); }
            catch { /* Subscriber error */ }
        });
    }

    /**
     * Sends the structured gpt_query payload via Socket.IO.
     */
    _sendViaWebSocket(sessionId, payload) {
        let parsed;
        try {
            parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        } catch {
            parsed = { sessionId, content: payload };
        }

        if (this.socket?.connected) {
            console.log('[WS] → gpt_query');
            console.table(parsed);
            this.socket.emit('gpt_query', parsed);
            return true;
        }

        // If socket doesn't exist yet, create it (lazy initialization)
        if (!this.socket) this._createSocket();
        return false;
    }

    // ==================== PUBLIC API ====================

    /**
     * Register a session — signals that the UI needs an active WebSocket.
     * Creates the socket connection if it doesn't exist yet.
     */
    connectSession(sessionId) {
        this.activeSessions.add(sessionId);
        this._createSocket();
    }

    /**
     * Unregister a session — removes it from the active set.
     * If no sessions remain, closes the socket to free resources.
     */
    disconnectSession(sessionId) {
        this.activeSessions.delete(sessionId);
        if (this.activeSessions.size === 0) this._closeSocket();
    }

    /** Send a message via WebSocket */
    sendMessage(sessionId, text) {
        return this._sendViaWebSocket(sessionId, text);
    }

    /**
     * Subscribe a callback to receive incoming messages.
     * Returns an unsubscribe function for cleanup.
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Force-close the connection (e.g. on logout or context teardown).
     * Used by WebSocketContext.jsx during cleanup.
     */
    forceClose() {
        this.activeSessions.clear();
        this._closeSocket();
    }
}

export default SharedWebSocketService;