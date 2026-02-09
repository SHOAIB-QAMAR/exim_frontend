/**
 * @fileoverview WebSocket Hook for Chat Communication
 * 
 * Manages WebSocket connections for chat threads using the SharedWebSocketService.
 * Handles message sending, receiving, and real-time streaming updates.
 */

import { useEffect, useRef, useCallback } from 'react';
import webSocketService from '../services/SharedWebSocketService';

/**
 * Custom hook for WebSocket-based chat communication
 * 
 * @param {Array} activeSessions - Active chat sessions
 * @param {Function} setActiveSessions - State updater for sessions
 * @param {string} activeSessionId - Currently visible session ID
 * @param {Function} scrollToBottom - Callback to scroll chat view
 * @returns {{ sendMessage: Function }} WebSocket send function
 */
export const useWebSocket = (activeSessions, setActiveSessions, activeSessionId, scrollToBottom) => {
    const connectedThreadsRef = useRef(new Set());
    const activeThreadIds = activeSessions.map(s => s.id).join(',');

    /**
     * Handles incoming WebSocket messages (streaming chunks or complete messages)
     */
    const handleMessage = useCallback((threadId, data) => {
        try {
            if (!threadId) return;

            const isStreaming = data.done !== undefined;
            const isDone = data.done === true;
            const { chunk, reply } = data;

            if (isStreaming) {
                // Handle streaming message chunks
                setActiveSessions(prev => prev.map(s => {
                    if (s.id !== threadId) return s;

                    const messages = [...s.messages];
                    const lastMsgIndex = messages.length - 1;
                    const lastMsg = messages[lastMsgIndex];
                    const hasStreamingMsg = lastMsg?.role === 'assistant' && lastMsg.isStreaming;

                    if (isDone) {
                        // Finalize streaming message
                        if (hasStreamingMsg) {
                            messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: false };
                        }
                        return { ...s, isThinking: false, messages };
                    } else if (chunk) {
                        // Append chunk to existing or create new streaming message
                        if (hasStreamingMsg) {
                            messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + chunk };
                        } else {
                            messages.push({
                                role: 'assistant',
                                content: chunk,
                                isStreaming: true,
                                isNew: false,
                                timestamp: Date.now()
                            });
                        }
                        return { ...s, isThinking: false, messages };
                    }
                    return s;
                }));

                // Auto-scroll during streaming
                if (threadId === activeSessionId && !isDone) {
                    setTimeout(scrollToBottom, 10);
                }
            } else if (reply !== undefined) {
                // Handle complete message (backward compatibility)
                setActiveSessions(prev => prev.map(s => s.id === threadId ? {
                    ...s,
                    isThinking: false,
                    messages: [...s.messages, { role: 'assistant', content: reply, isNew: true, timestamp: Date.now() }]
                } : s));

                if (threadId === activeSessionId) {
                    setTimeout(scrollToBottom, 50);
                }
            }
        } catch (error) {
            console.error('[useWebSocket.handleMessage] Error:', error.message);
        }
    }, [activeSessionId, setActiveSessions, scrollToBottom]);

    // Subscribe to WebSocket service
    useEffect(() => {
        const unsubscribe = webSocketService.subscribe(handleMessage);
        return () => unsubscribe();
    }, [handleMessage]);

    // Manage thread connections based on active sessions
    useEffect(() => {
        const currentThreadIds = activeThreadIds.split(',').filter(Boolean);
        const currentSet = new Set(currentThreadIds);

        // Connect new threads
        currentThreadIds.forEach(threadId => {
            if (!connectedThreadsRef.current.has(threadId)) {
                webSocketService.connectThread(threadId);
                connectedThreadsRef.current.add(threadId);
            }
        });

        // Disconnect removed threads
        connectedThreadsRef.current.forEach(threadId => {
            if (!currentSet.has(threadId)) {
                webSocketService.disconnectThread(threadId);
                connectedThreadsRef.current.delete(threadId);
            }
        });
    }, [activeThreadIds]);

    // Cleanup on unmount
    useEffect(() => {
        // Capture ref value for cleanup
        const connectedThreads = connectedThreadsRef.current;

        return () => {
            connectedThreads.forEach(threadId => {
                webSocketService.disconnectThread(threadId);
            });
            connectedThreads.clear();
        };
    }, []);

    /**
     * Sends a message via WebSocket
     * @param {string} threadId - Target thread ID
     * @param {string} text - Message content (text or JSON string)
     * @returns {boolean} Success status
     */
    const sendMessage = useCallback((threadId, text) => {
        try {
            if (!threadId) return false;
            return webSocketService.sendMessage(threadId, text);
        } catch (error) {
            console.error('[useWebSocket.sendMessage] Error:', error.message);
            return false;
        }
    }, []);

    return { sendMessage };
};