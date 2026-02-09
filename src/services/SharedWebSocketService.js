/**
 * @fileoverview Shared WebSocket Service
 * 
 * Singleton service managing a single multiplexed WebSocket connection.
 * Uses BroadcastChannel for cross-tab coordination with leader election.
 * 
 * Architecture:
 * - ONE WebSocket for ALL threads (multiplexed via threadId)
 * - Leader tab owns the WebSocket connection
 * - All messages include threadId for routing
 */

import API_CONFIG from './api.config';

// ==================== CONSTANTS ====================
const CHANNEL_NAME = 'exim-websocket-channel';
const LEADER_KEY = 'exim-ws-leader';
const LEADER_HEARTBEAT_MS = 2000;
const LEADER_TIMEOUT_MS = 5000;
const VISIBILITY_FAILOVER_MS = 3000;
const CONNECTION_DEBOUNCE_MS = 300;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

class SharedWebSocketService {
    constructor() {
        // Instance identity
        this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.isLeader = false;

        // WebSocket state
        this.socket = null;
        this.subscribers = new Set();
        this.errorSubscribers = new Set(); // New: Error listeners
        this.messageQueue = [];
        this.activeThreads = new Set();

        // Connection state
        this.reconnectAttempts = 0;
        this.isExplicitlyDisconnected = false;

        // Timers
        this.connectTimer = null;
        this.disconnectTimer = null;
        this.heartbeatInterval = null;
        this.reconnectTimer = null;

        // Cross-tab communication
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = this._handleBroadcast.bind(this);

        // Event listeners
        window.addEventListener('storage', this._handleStorageChange.bind(this));
        document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
        window.addEventListener('beforeunload', this._handleTabClose.bind(this));
        window.addEventListener('online', () => this._handleNetworkChange(true));
        window.addEventListener('offline', () => this._handleNetworkChange(false));

        // Start leader election
        this._attemptLeaderElection();
    }

    // ==================== LEADER ELECTION ====================

    _attemptLeaderElection() {
        const leaderData = localStorage.getItem(LEADER_KEY);
        const now = Date.now();

        if (leaderData) {
            const { tabId, timestamp } = JSON.parse(leaderData);
            if (now - timestamp < LEADER_TIMEOUT_MS && tabId !== this.tabId) {
                this.isLeader = false;
                return;
            }
        }
        this._becomeLeader();
    }

    _becomeLeader() {
        this.isLeader = true;
        this._updateLeaderHeartbeat();
        this.heartbeatInterval = setInterval(() => this._updateLeaderHeartbeat(), LEADER_HEARTBEAT_MS);

        this.channel.postMessage({ type: 'LEADER_ELECTED', tabId: this.tabId });

        if (this.activeThreads.size > 0) {
            this._scheduleConnect();
        }
    }

    _updateLeaderHeartbeat() {
        localStorage.setItem(LEADER_KEY, JSON.stringify({
            tabId: this.tabId,
            timestamp: Date.now()
        }));
    }

    _resignAsLeader() {
        if (!this.isLeader) return;
        this.isLeader = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        // Close socket as we are no longer leader
        this._closeWebSocket();
    }

    // ==================== EVENT HANDLERS ====================

    _handleStorageChange(event) {
        if (event.key !== LEADER_KEY) return;
        if (!event.newValue) {
            this._attemptLeaderElection();
        } else {
            const { tabId } = JSON.parse(event.newValue);
            if (tabId !== this.tabId && this.isLeader) {
                this._resignAsLeader();
            }
        }
    }

    _handleVisibilityChange() {
        if (document.hidden) return;

        if (this.isLeader) {
            this._updateLeaderHeartbeat();
            // Check connection health when becoming visible
            if (this.activeThreads.size > 0 &&
                (!this.socket || this.socket.readyState !== WebSocket.OPEN)) {
                this._scheduleConnect();
            }
            return;
        }

        // Aggressive election when tab becomes visible
        const leaderData = localStorage.getItem(LEADER_KEY);
        if (leaderData) {
            const { tabId, timestamp } = JSON.parse(leaderData);
            if (Date.now() - timestamp > VISIBILITY_FAILOVER_MS && tabId !== this.tabId) {
                this._becomeLeader();
            }
        } else {
            this._becomeLeader();
        }
    }

    _handleNetworkChange(isOnline) {
        this._broadcastError(isOnline ? null : 'No internet connection');
        if (isOnline && this.isLeader && this.activeThreads.size > 0) {
            this.reconnectAttempts = 0;
            this._scheduleConnect();
        }
    }

    _handleTabClose() {
        if (this.connectTimer) clearTimeout(this.connectTimer);
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        document.removeEventListener('visibilitychange', this._handleVisibilityChange);

        if (this.isLeader) {
            if (this.socket) this.socket.close();
            localStorage.removeItem(LEADER_KEY);
        }
        this.channel.close();
    }

    _handleBroadcast(event) {
        const { type, threadId, message, tabId, originTabId, error } = event.data;

        switch (type) {
            case 'LEADER_ELECTED':
                if (tabId !== this.tabId) this._resignAsLeader();
                break;
            case 'REGISTER_THREAD':
                if (this.isLeader) {
                    this.activeThreads.add(threadId);
                    this._scheduleConnect();
                }
                break;
            case 'UNREGISTER_THREAD':
                if (this.isLeader && originTabId !== this.tabId) {
                    this.activeThreads.delete(threadId);
                    if (this.activeThreads.size === 0) this._scheduleDisconnect();
                }
                break;
            case 'SEND_MESSAGE':
                if (this.isLeader) {
                    this._sendViaWebSocket(threadId, message);
                }
                break;
            case 'MESSAGE_RECEIVED':
                if (originTabId !== this.tabId) {
                    this._notifySubscribers(threadId, message);
                }
                break;
            case 'ERROR_EVENT':
                this._notifyErrorSubscribers(error);
                break;
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
        if (!this.isLeader || this.activeThreads.size === 0) return;
        if (this.socket?.readyState === WebSocket.OPEN ||
            this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        try {
            const wsUrl = `${API_CONFIG.WS_BASE_URL}${API_CONFIG.endpoints.CHAT_WS}`;
            console.log('[SharedWS] Connecting to:', wsUrl);
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('[SharedWS] Connected');
                this.reconnectAttempts = 0;
                this._broadcastError(null); // Clear errors
                this._flushMessageQueue();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (!data.threadId) return;

                    this._notifySubscribers(data.threadId, data);
                    this.channel.postMessage({
                        type: 'MESSAGE_RECEIVED',
                        threadId: data.threadId,
                        message: data,
                        originTabId: this.tabId
                    });
                } catch (err) {
                    console.error('[SharedWS] Error parsing message:', err);
                }
            };

            this.socket.onerror = (error) => {
                console.error('[SharedWS] WebSocket error observed');
                // Don't broadcast here, onclose will handle retry logic
            };

            this.socket.onclose = (event) => {
                this.socket = null;
                if (!this.isExplicitlyDisconnected && this.activeThreads.size > 0) {
                    this._broadcastError('Connection lost. Reconnecting...');
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
            this._broadcastError('Unable to connect to chat server. Please check your connection.');
            return;
        }

        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`[SharedWS] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.isLeader && this.activeThreads.size > 0) {
                this._createWebSocket();
            }
        }, delay);
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
        if (!this.isLeader) {
            // Forward attempt to leader if we accidentally got here
            return false;
        }

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

    _broadcastError(error) {
        this._notifyErrorSubscribers(error);
        if (this.isLeader) {
            this.channel.postMessage({ type: 'ERROR_EVENT', error, tabId: this.tabId });
        }
    }

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
        if (this.isLeader) {
            this._scheduleConnect();
        } else {
            this.channel.postMessage({ type: 'REGISTER_THREAD', threadId, originTabId: this.tabId });
        }
    }

    /** Send a message via WebSocket */
    sendMessage(threadId, text) {
        if (this.isLeader) {
            return this._sendViaWebSocket(threadId, text);
        }
        this.channel.postMessage({ type: 'SEND_MESSAGE', threadId, message: text, originTabId: this.tabId });
        return true; // We assume success for broadcast; errors will be fed back asynchronously
    }

    /** Subscribe to incoming messages */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /** Subscribe to connection errors */
    subscribeToErrors(callback) {
        this.errorSubscribers.add(callback);
        // Send current error state immediately if exists
        // (Not implementing currentError getter for brevity, but this would be good enhancement)
        return () => this.errorSubscribers.delete(callback);
    }

    /** Manually trigger reconnection */
    retryConnection() {
        if (this.isLeader) {
            this.reconnectAttempts = 0;
            this._scheduleConnect();
        } else {
            // Signal leader to retry could be added here, 
            // but for now simple page usage usually implies leader for single user
        }
    }

    /** Unregister a thread */
    disconnectThread(threadId) {
        this.activeThreads.delete(threadId);
        if (this.isLeader) {
            if (this.activeThreads.size === 0) this._scheduleDisconnect();
        } else {
            this.channel.postMessage({ type: 'UNREGISTER_THREAD', threadId, originTabId: this.tabId });
        }
    }

    /** Check if this tab is the leader */
    isLeaderTab() {
        return this.isLeader;
    }
}

export default new SharedWebSocketService();