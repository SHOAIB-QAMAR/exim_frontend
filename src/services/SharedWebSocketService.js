import { io } from 'socket.io-client';
import API_CONFIG from './api.config';

// SharedWebSocketService (Singleton)
// Instead of giving every chat tab its own WebSocket (which strains server limits), this class pools all active tabs into a single, global, multiplexed WebSocket connection.
// It manages auto-reconnects, queueing offline messages, and measuring network latency (ping/pong).

class SharedWebSocketService {

    static instance = null;

    constructor() {

        if (SharedWebSocketService.instance) {
            return SharedWebSocketService.instance;
        }

        SharedWebSocketService.instance = this;

        // Socket.IO state
        this.socket = null;

        // Arrays/Sets mapping which UI components are currently listening
        this.subscribers = new Set();

        // A list of all chat tab IDs currently open in the UI that require the socket
        this.activeSessions = new Set();

        // State trackers
        this.isExplicitlyDisconnected = false; // True during logout or manual disconnects

        // Browser level listeners to detect if the laptop/phone completely loses WiFi
        window.addEventListener('online', () => this._handleNetworkChange(true));
        window.addEventListener('offline', () => this._handleNetworkChange(false));
    }

    // ==================== EVENT HANDLERS ====================

    _handleNetworkChange(isOnline) {
        console.log(`[WS] Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

        if (!isOnline) {
            // Explicitly disconnect to stop Socket.IO's internal retry loop and console errors
            if (this.socket) {
                console.log('[WS] Stopping connection due to offline status');
                this.socket.disconnect();
            }
        } else if (this.activeSessions.size > 0) {
            // Browser reported back 'online' - trigger an immediate reconnection attempt
            console.log('[WS] Network restored, attempting to reconnect...');
            if (this.socket && !this.socket.connected) {
                this.socket.connect();
            } else {
                this._scheduleConnect();
            }
        }
    }

    // ==================== CONNECTION MANAGEMENT ====================

    _scheduleConnect() {
        this.isExplicitlyDisconnected = false;
        if (this.socket?.connected) return;
        this._createSocket();
    }

    _scheduleDisconnect() {
        this.isExplicitlyDisconnected = true;
        this._closeSocket();
    }

    _createSocket() {
        if (this.activeSessions.size === 0) return;

        if (this.socket && (this.socket.connected || this.socket.connecting)) {
            return;
        }

        // If socket exists but is disconnected, just call connect() instead of creating a new one
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
                console.log('[WS] ✅ Connected');
            });

            this.socket.on('query_response', (data) => {
                console.log('[WS] ← query_response', data);
                this._handleMessage({ data });
            });

            this.socket.on('connect_error', (error) => {
                console.warn('[WS] ⚠️ Connection error:', error.message || error);
            });

            this.socket.on('disconnect', (reason) => {
                console.log(`[WS] ❌ Disconnected (${reason})`);
            });

        } catch {
            // Connection creation failed
        }
    }

    /**
     * Master sorting switchboard. 
     * Handles parsed data from query_response event.
     */
    _handleMessage(event) {
        try {
            // Socket.IO already parses JSON, but we'll be defensive
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (!data) return;

            // Extract the target sessionId for multiplexing
            // Backend sends session_id which contains the identifier
            let sessionId = data.session_id || data.sessionId || data.threadId || data.thread_id || data.chat_id;

            // Notify all local React UI components subscribed to this Service
            this._notifySubscribers(sessionId, data);

        } catch {
            // Message handling failed silently
        }
    }

    /**
     * Sends the structured gpt_query payload.
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

        if (!this.socket) this._scheduleConnect();
        return false;
    }

    _closeSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Public method to force-close the connection (e.g. on logout).
     */
    forceClose() {
        this.isExplicitlyDisconnected = true;
        this.activeSessions.clear();
        this._closeSocket();
    }

    // ==================== ERROR HANDLING ====================

    /** 
     * Iterates exactly through all active React hooks listening to the socket 
     * and passes the data chunk upwards. 
     */
    _notifySubscribers(sessionId, message) {
        this.subscribers.forEach(callback => {
            try { callback(sessionId, message); }
            catch { /* Subscriber error */ }
        });
    }

    // ==================== PUBLIC API ====================

    /** Register a session (signals that we need the WebSocket) */
    connectSession(sessionId) {
        this.activeSessions.add(sessionId);
        this._scheduleConnect();
    }

    /** Send a message via WebSocket */
    sendMessage(sessionId, text) {
        return this._sendViaWebSocket(sessionId, text);
    }

    /** Subscribe to incoming messages */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /** Manually trigger reconnection */
    retryConnection() {
        this._scheduleConnect();
    }

    /** Unregister a session */
    disconnectSession(sessionId) {
        this.activeSessions.delete(sessionId);
        if (this.activeSessions.size === 0) this._scheduleDisconnect();
    }
}

export default SharedWebSocketService;