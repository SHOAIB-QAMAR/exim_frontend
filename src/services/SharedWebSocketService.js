import { io } from 'socket.io-client';
import API_CONFIG from './api.config';

// ==================== CONSTANTS ====================
const CONNECTION_DEBOUNCE_MS = 300;     // Delay before opening/closing sockets to prevent UI flicker spam
const MAX_RECONNECT_ATTEMPTS = 5;       // Total retry limit before showing a hard error to the user
const INITIAL_RETRY_DELAY_MS = 1000;    // Exponential backoff starting interval

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
        this.errorSubscribers = new Set();

        // A queue holding messages the user tried to send while offline/reconnecting
        this.messageQueue = [];

        // A list of all chat tab IDs currently open in the UI that require the socket
        this.activeSessions = new Set();

        // State trackers
        this.reconnectAttempts = 0;
        this.isExplicitlyDisconnected = false; // True during logout or manual disconnects

        // Timers for managing debounce
        this.connectTimer = null;
        this.disconnectTimer = null;
        this.reconnectTimer = null;

        // Browser level listeners to detect if the laptop/phone completely loses WiFi
        window.addEventListener('online', () => this._handleNetworkChange(true));
        window.addEventListener('offline', () => this._handleNetworkChange(false));
    }

    // ==================== EVENT HANDLERS ====================

    _handleNetworkChange(isOnline) {
        this._notifyErrorSubscribers(isOnline ? null : 'No internet connection');
        if (isOnline && this.activeSessions.size > 0) {
            this.reconnectAttempts = 0;
            this._scheduleConnect();
        }
    }

    // ==================== CONNECTION MANAGEMENT ====================

    _scheduleConnect() {
        this.isExplicitlyDisconnected = false;

        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = null;
        }

        if (this.socket?.connected || this.connectTimer) {
            return;
        }

        this.connectTimer = setTimeout(() => {
            this.connectTimer = null;
            this._createSocket();
        }, CONNECTION_DEBOUNCE_MS);
    }

    _scheduleDisconnect() {
        if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
        }

        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => {
            this.disconnectTimer = null;
            this.isExplicitlyDisconnected = true;
            this._closeSocket();
        }, CONNECTION_DEBOUNCE_MS);
    }

    _createSocket() {
        if (this.activeSessions.size === 0) return;

        if (this.socket && (this.socket.connected || this.socket.connecting || this.socket.io.engine)) {
            return;
        }

        try {
            const url = API_CONFIG.SOCKET_IO_URL;

            this.socket = io(url, {
                forceNew: true,
                multiplex: false,
                transports: ['polling', 'websocket'],
                withCredentials: true,
                reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay: INITIAL_RETRY_DELAY_MS,
                timeout: 30000
            });

            this.socket.connect();

            this.socket.on('connect', () => {
                this.reconnectAttempts = 0;
                this._notifyErrorSubscribers(null);
                this._flushMessageQueue();
            });

            this.socket.on('query_response', (data) => {
                console.log('[WS] ← query_response', data);
                this._handleMessage({ data });
            });

            this.socket.on('connect_error', () => {
                this._notifyErrorSubscribers('Connection error. Reconnecting...');
            });

            this.socket.on('disconnect', () => {
                if (!this.isExplicitlyDisconnected && this.activeSessions.size > 0) {
                    this._notifyErrorSubscribers('Connection lost. Reconnecting...');
                }
            });

        } catch {
            // Connection creation failed
        }
    }



    /**
     * Implements basic alerting if Socket.IO fails to reconnect after all attempts.
     */
    _handleReconnection() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this._notifyErrorSubscribers('Unable to connect to chat server. Please check your connection.');
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
            let sessionId = data.sessionId || data.threadId || data.thread_id || data.session_id || data.chat_id;

            // For new chats, backend returns a new session_id that doesn't match
            // the local UUID. Use questionAnswer to route to the correct local session.
            if (!this.pendingRequests) this.pendingRequests = new Map();
            if (data.questionAnswer && this.pendingRequests.has(data.questionAnswer)) {
                const requestInfo = this.pendingRequests.get(data.questionAnswer);
                const localSessionId = typeof requestInfo === 'object' ? requestInfo.sessionId : requestInfo;
                if (localSessionId !== sessionId) {
                    sessionId = localSessionId;
                }

                // --- METRICS ---
                if (typeof requestInfo === 'object' && requestInfo.startTime && !requestInfo.hasLoggedLatency) {
                    const latency = performance.now() - requestInfo.startTime;
                    const resSizeBytes = new Blob([typeof event.data === 'string' ? event.data : JSON.stringify(event.data)]).size;
                    console.groupCollapsed(`📊 [Metrics] WebSocket Response: ${Math.round(latency)}ms`);
                    console.log(`Latency: ${latency.toFixed(2)} ms`);
                    console.log(`Payload Size: ${(resSizeBytes / 1024).toFixed(2)} KB (${resSizeBytes} bytes)`);
                    console.groupEnd();
                    requestInfo.hasLoggedLatency = true;
                }
                // ---------------

                // Clean up once the stream is complete
                const isDone = data.done === true ||
                    data.TextCompleted === true ||
                    data.type === 'done' ||
                    data.type === 'message_end' ||
                    (typeof data.response === 'string' && data.response.includes('@//done//@'));
                if (isDone) {
                    this.pendingRequests.delete(data.questionAnswer);
                }
            }

            // Notify all local React UI components subscribed to this Service
            this._notifySubscribers(sessionId, data);

        } catch {
            // Message handling failed silently
        }
    }

    /**
     * Loops through any offline messages sent by the user during an outage 
     * and pushes them correctly onto the newly re-established Socket.IO pipe.
     */
    _flushMessageQueue() {
        if (this.messageQueue.length === 0) return;

        const queue = [...this.messageQueue];
        this.messageQueue = [];

        queue.forEach(msg => {
            if (this.socket?.connected) {
                this.socket.emit('gpt_query', msg);
            } else {
                this.messageQueue.push(msg);
            }
        });
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

            // Track questionAnswer → local sessionId for routing responses back
            if (!this.pendingRequests) this.pendingRequests = new Map();
            if (parsed.questionAnswer) {
                this.pendingRequests.set(parsed.questionAnswer, { sessionId, startTime: performance.now() });
            }

            // --- METRICS ---
            const reqSizeBytes = new Blob([JSON.stringify(parsed)]).size;
            console.groupCollapsed(`📊 [Metrics] WebSocket Request`);
            console.log(`Payload Size: ${(reqSizeBytes / 1024).toFixed(2)} KB (${reqSizeBytes} bytes)`);
            console.groupEnd();
            // ---------------

            console.log('[WS] → gpt_query', parsed);
            this.socket.emit('gpt_query', parsed);
            return true;
        }

        this.messageQueue.push(parsed);
        if (!this.socket) this._scheduleConnect();
        return true;
    }

    _closeSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.messageQueue = [];
    }

    /**
     * Public method to force-close the connection (e.g. on logout).
     */
    forceClose() {
        this.isExplicitlyDisconnected = true;
        clearTimeout(this.connectTimer);
        clearTimeout(this.disconnectTimer);
        clearTimeout(this.reconnectTimer);

        this.connectTimer = null;
        this.disconnectTimer = null;
        this.reconnectTimer = null;
        this.activeSessions.clear();
        this.reconnectAttempts = 0;
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

    _notifyErrorSubscribers(error) {
        this.errorSubscribers.forEach(callback => {
            try { callback(error); }
            catch { /* Error subscriber error */ }
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

    /** Subscribe to connection errors */
    subscribeToErrors(callback) {
        this.errorSubscribers.add(callback);
        return () => this.errorSubscribers.delete(callback);
    }

    /** Manually trigger reconnection */
    retryConnection() {
        this.reconnectAttempts = 0;
        this._scheduleConnect();
    }

    /** Unregister a session */
    disconnectSession(sessionId) {
        this.activeSessions.delete(sessionId);
        if (this.activeSessions.size === 0) this._scheduleDisconnect();
    }
}

export default SharedWebSocketService;