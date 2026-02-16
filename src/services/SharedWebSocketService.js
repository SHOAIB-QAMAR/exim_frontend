import API_CONFIG from './api.config';

// ==================== CONSTANTS ====================
const CONNECTION_DEBOUNCE_MS = 300;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

class SharedWebSocketService {
    constructor() {
        // WebSocket state
        this.socket = null;
        this.subscribers = new Set();
        this.errorSubscribers = new Set();
        this.messageQueue = [];
        this.activeThreads = new Set();

        // Connection state
        this.reconnectAttempts = 0;
        this.isExplicitlyDisconnected = false;

        // Timers
        this.connectTimer = null;
        this.disconnectTimer = null;
        this.reconnectTimer = null;


        // Event listeners
        window.addEventListener('online', () => this._handleNetworkChange(true));
        window.addEventListener('offline', () => this._handleNetworkChange(false));
    }

    // ==================== EVENT HANDLERS ====================

    _handleNetworkChange(isOnline) {
        this._notifyErrorSubscribers(isOnline ? null : 'No internet connection');
        if (isOnline && this.activeThreads.size > 0) {
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

        if (this.socket?.readyState === WebSocket.OPEN ||
            this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = setTimeout(() => {
            this.connectTimer = null;
            this._createWebSocket();
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
            this._closeWebSocket();
        }, CONNECTION_DEBOUNCE_MS);
    }

    _createWebSocket() {
        if (this.activeThreads.size === 0) return;
        if (this.socket?.readyState === WebSocket.OPEN ||
            this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        try {
            const wsUrl = `http://98.70.52.193:8000${API_CONFIG.endpoints.CHAT_WS}`;
            // const wsUrl = `https://39d4-2407-c8c0-132-d400-8913-6343-f673-7c87.ngrok-free.app${API_CONFIG.endpoints.CHAT_WS}`;
            // const wsUrl = `${API_CONFIG.WS_BASE_URL}${API_CONFIG.endpoints.CHAT_WS}`;
            console.log(`[SharedWS] Connecting to: ${wsUrl} at ${new Date().toISOString()}`);
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('[SharedWS] Connected');
                this.reconnectAttempts = 0;
                this._notifyErrorSubscribers(null); // Clear errors
                this._flushMessageQueue();
            };

            this.socket.onmessage = (event) => {
                this._handleMessage(event);
            };

            this.socket.onerror = () => {
                console.error('[SharedWS] WebSocket error observed');
                // Don't broadcast here, onclose will handle retry logic
            };

            this.socket.onclose = () => {
                this.socket = null;
                if (!this.isExplicitlyDisconnected && this.activeThreads.size > 0) {
                    this._notifyErrorSubscribers('Connection lost. Reconnecting...');
                    this._handleReconnection();
                }
            };
        } catch (err) {
            console.error('[SharedWS] Failed to create WebSocket:', err);
            this._handleReconnection();
        }
    }

    _handleReconnection() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this._notifyErrorSubscribers('Unable to connect to chat server. Please check your connection.');
            return;
        }

        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`[SharedWS] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts}) at ${new Date().toISOString()}`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.activeThreads.size > 0) {
                this._createWebSocket();
            }
        }, delay);
    }

    _handleMessage(event) {
        console.log('[SharedWS] Received message:', event.data);

        try {
            let data;

            const rawData = event.data;

            // Check for SSE-style "data: {...}" format
            if (typeof rawData === 'string' && rawData.startsWith('data: ')) {
                const jsonStr = rawData.substring(6).trim();
                if (!jsonStr) return; // Skip empty heartbeats
                data = JSON.parse(jsonStr);
            } else {
                // Standard JSON message
                data = JSON.parse(rawData);
            }

            // Handle ping/pong
            if (data.type === 'pong') {
                return;
            }

            // Extract threadId from message (varies by backend format)
            const threadId = data.threadId || data.thread_id || data.chat_id || this.activeThreadId;

            // Notify local subscribers
            this._notifySubscribers(threadId, data);

        } catch (error) {
            console.error('[SharedWS] Failed to parse message:', error);
            console.error('[SharedWS] Raw message causing error:', event.data);
        }
    }

    _flushMessageQueue() {
        if (this.messageQueue.length === 0) return;
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        queue.forEach(msg => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(msg);
            } else {
                this.messageQueue.push(msg);
            }
        });
    }

    _sendViaWebSocket(threadId, payload) {
        let message;
        try {
            const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
            message = JSON.stringify({ ...parsed, threadId });
        } catch {
            message = JSON.stringify({ threadId, content: payload });
        }

        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(message);
            return true;
        }

        // Queue message if connecting
        if (this.socket?.readyState === WebSocket.CONNECTING || this.reconnectAttempts > 0) {
            this.messageQueue.push(message);
            // If offline/reconnecting, ensure we are trying to connect
            if (!this.socket) this._scheduleConnect();
            return true;
        }

        return false;
    }

    _closeWebSocket() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.messageQueue = [];
    }

    // ==================== ERROR HANDLING ====================

    _notifySubscribers(threadId, message) {
        this.subscribers.forEach(callback => {
            try { callback(threadId, message); }
            catch (err) { console.error('[SharedWS] Subscriber error:', err); }
        });
    }

    _notifyErrorSubscribers(error) {
        this.errorSubscribers.forEach(callback => {
            try { callback(error); }
            catch (err) { console.error('[SharedWS] Error subscriber error:', err); }
        });
    }

    // ==================== PUBLIC API ====================

    /** Register a thread (signals that we need the WebSocket) */
    connectThread(threadId) {
        this.activeThreads.add(threadId);
        this._scheduleConnect();
    }

    /** Send a message via WebSocket */
    sendMessage(threadId, text) {
        return this._sendViaWebSocket(threadId, text);
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

    /** Unregister a thread */
    disconnectThread(threadId) {
        this.activeThreads.delete(threadId);
        if (this.activeThreads.size === 0) this._scheduleDisconnect();
    }
}

export default new SharedWebSocketService();