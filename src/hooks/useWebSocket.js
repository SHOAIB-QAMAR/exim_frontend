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

            setActiveSessions(prev => prev.map(s => {
                if (s.id !== threadId) return s;

                const messages = [...s.messages];
                const lastMsgIndex = messages.length - 1;
                let lastMsg = messages[lastMsgIndex];

                // Initialize thinking/metrics if not present
                const thinkingSteps = s.thinkingSteps || [];

                // Handle legacy format (backward compatibility)
                if (data.chunk || data.done || data.reply) {
                    const isStreaming = data.done !== undefined;
                    const isDone = data.done === true;

                    if (isStreaming) {
                        if (isDone) {
                            if (lastMsg?.isStreaming) {
                                messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: false };
                            }
                            return { ...s, isThinking: false, messages };
                        } else if (data.chunk) {
                            if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                                messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + data.chunk };
                            } else {
                                messages.push({
                                    role: 'assistant',
                                    content: data.chunk,
                                    isStreaming: true,
                                    isNew: false,
                                    timestamp: Date.now()
                                });
                            }
                            return { ...s, isThinking: false, messages };
                        }
                    } else if (data.reply) {
                        return {
                            ...s,
                            isThinking: false,
                            messages: [...messages, { role: 'assistant', content: data.reply, isNew: true, timestamp: Date.now() }]
                        };
                    }
                    return s;
                }

                // Handle Advanced Streaming Format (type: 'status' | 'message_chunk' | etc.)
                switch (data.type) {
                    case 'status': // Status updates with in-progress/completed
                        {
                            const isComplete = data.status === 'completed';
                            const newStep = {
                                message: data.message,
                                status: isComplete ? 'completed' : 'in-progress',
                                type: 'status',
                                time: data.time || null
                            };

                            const newThinking = [...thinkingSteps];

                            // If last step was in-progress and this one is completed, update instead of append
                            if (isComplete && newThinking.length > 0) {
                                const lastStep = newThinking[newThinking.length - 1];
                                if (lastStep.status === 'in-progress') {
                                    // Update the last step to completed
                                    newThinking[newThinking.length - 1] = newStep;
                                } else {
                                    newThinking.push(newStep);
                                }
                            } else {
                                newThinking.push(newStep);
                            }

                            return { ...s, isThinking: true, thinkingSteps: newThinking };
                        }

                    case 'phase_complete':
                        {
                            const phaseMap = {
                                analysis: 'Analysis',
                                param_extraction: 'Parameter Extraction',
                                tool_execution: 'Tool Execution',
                                response_generation: 'Response Generation'
                            };
                            if (phaseMap[data.phase]) {
                                const newStep = {
                                    message: `${phaseMap[data.phase]} complete`,
                                    status: 'completed',
                                    time: data.time,
                                    type: 'phase'
                                };
                                const newThinking = [...thinkingSteps, newStep];
                                return { ...s, isThinking: true, thinkingSteps: newThinking };
                            }
                            return s;
                        }

                    case 'tool_call':
                        {
                            const newStep = {
                                message: `Calling: ${data.name}`,
                                status: data.status || 'in-progress',
                                type: 'tool_call',
                                details: data.args
                            };
                            const newThinking = [...thinkingSteps, newStep];
                            return { ...s, isThinking: true, thinkingSteps: newThinking };
                        }

                    case 'tool_result':
                        {
                            const newStep = {
                                message: 'Tool output received',
                                status: 'completed',
                                type: 'tool_result',
                                time: data.time || null,
                                details: data.content
                            };
                            const newThinking = [...thinkingSteps, newStep];
                            return { ...s, isThinking: true, thinkingSteps: newThinking };
                        }


                    case 'message_start':
                        // Prepare for text streaming - maybe mark thinking as done?
                        return { ...s, isThinking: false }; // Switch to text mode

                    case 'message_chunk': {
                        // Text content
                        const content = data.content;
                        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + content };
                        } else {
                            messages.push({
                                role: 'assistant',
                                content: content,
                                isStreaming: true,
                                isNew: false,
                                timestamp: Date.now()
                            });
                        }
                        return { ...s, messages };
                    }

                    case 'message_end':
                    case 'done':
                        if (lastMsg?.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, isStreaming: false };
                        }
                        return { ...s, isThinking: false, messages };

                    case 'timing':
                        return { ...s, metrics: data.data };

                    case 'error':
                        messages.push({
                            role: 'assistant',
                            content: `Error: ${data.message}`,
                            isNew: true,
                            timestamp: Date.now()
                        });
                        return { ...s, isThinking: false, messages };

                    default:
                        return s;
                }

            }));

            // Auto-scroll
            if (threadId === activeSessionId && (data.type === 'message_chunk' || data.chunk)) {
                setTimeout(scrollToBottom, 10);
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