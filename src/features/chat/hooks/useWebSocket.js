import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketService } from '../context/WebSocketContext';

/**
 * useWebSocket Hook
 * 
 * Orchestrates the real-time communication between the UI and the backend.
 * Handles:
 * 1. Subscription to the shared WebSocket service.
 * 2. Processing incoming streaming chunks (legacy & advanced formats).
 * 3. Managing thinking steps, tool calls, and metrics display.
 * 4. Automatic connection/disconnection of threads based on active tabs.
 * 5. Session promotion (local UUID to backend ID) and sidebar synchronization.
 * 
 * @param {Array} activeSessions - List of open chat sessions
 * @param {Function} setActiveSessions - State setter for sessions
 * @param {string} activeSessionId - Current active session ID
 * @param {Function} onThreadsChanged - Callback to refresh thread history
 * @param {Function} promoteSession - Callback to finalize a new session ID
 * @param {Function} moveThreadToTop - Callback to reorder the sidebar
 * 
 * @returns {Object} { sendMessage }
 */
export const useWebSocket = (
    activeSessions,
    setActiveSessions,
    activeSessionId,
    onThreadsChanged,
    promoteSession,
    moveThreadToTop
) => {
    const webSocketService = useWebSocketService();

    // Tracks which sessions are currently connected to avoid redundant operations
    const connectedSessionsRef = useRef(new Set());

    // State to determine if we should trigger sidebar refreshes after a stream ends
    const hasSentMessageRef = useRef(false);

    // Buffering system for text chunks to reduce React render frequency
    const pendingChunksRef = useRef({});
    const streamTimerRef = useRef(null);

    // Memoized key for active session IDs to trigger connection effects
    const activeSessionIds = activeSessions.map(s => s.id).join(',');

    /**
     * Primary message dispatcher for incoming WebSocket data.
     * Decodes multiple backend formats and updates the relevant session state.
     */
    const handleMessage = useCallback((sessionId, data) => {
        try {
            if (!sessionId) return;

            let promotionInfo = null;
            let shouldRefreshThreads = false;
            let shouldMoveToTop = false;
            let moveToTopId = null;

            // --- DEBOUNCED STREAMING HANDLER ---
            // Consolidates rapid-fire text chunks into a single periodic update
            const legacyDoneCondition = data.done === true ||
                data.TextCompleted === true ||
                (typeof data.response === 'string' && data.response.includes('@//done//@'));
            const isPureLegacyChunk = (data.chunk || data.response) && !legacyDoneCondition && !data.reply;
            const isPureAdvancedChunk = data.type === 'message_chunk';

            if (isPureLegacyChunk || isPureAdvancedChunk) {
                const legacyChunkText = data.chunk || data.response || '';
                const cleanLegacyChunk = typeof legacyChunkText === 'string' ? legacyChunkText.replace('@//done//@', '') : legacyChunkText;
                const chunkToAppend = isPureAdvancedChunk ? data.content : cleanLegacyChunk;

                if (chunkToAppend) {
                    pendingChunksRef.current[sessionId] = (pendingChunksRef.current[sessionId] || '') + chunkToAppend;

                    if (!streamTimerRef.current) {
                        streamTimerRef.current = setTimeout(() => {
                            const snapshot = { ...pendingChunksRef.current };
                            pendingChunksRef.current = {};
                            streamTimerRef.current = null;

                            setActiveSessions(prev => prev.map(session => {
                                const pending = snapshot[session.id];
                                if (!pending) return session;

                                const msgs = [...session.messages];
                                const lastIdx = msgs.length - 1;
                                let lMsg = msgs[lastIdx];

                                if (lMsg?.role === 'assistant' && lMsg.isStreaming) {
                                    msgs[lastIdx] = { ...lMsg, content: lMsg.content + pending };
                                } else {
                                    msgs.push({
                                        role: 'assistant',
                                        content: pending,
                                        isStreaming: true,
                                        isNew: false,
                                        timestamp: Date.now()
                                    });
                                }
                                return { ...session, messages: msgs };
                            }));
                        }, 60);
                    }
                }
                return; // Suppress immediate render as chunk is buffered
            }
            // ------------------------------------

            setActiveSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;

                const messages = [...s.messages];
                let lastMsgIndex = messages.length - 1;
                let lastMsg = messages[lastMsgIndex];

                // Flush any buffered chunks before processing a terminal or status event
                if (pendingChunksRef.current[sessionId]) {
                    const pending = pendingChunksRef.current[sessionId];
                    if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                        lastMsg = { ...lastMsg, content: lastMsg.content + pending };
                        messages[lastMsgIndex] = lastMsg;
                    } else {
                        lastMsg = {
                            role: 'assistant',
                            content: pending,
                            isStreaming: true,
                            isNew: false,
                            timestamp: Date.now()
                        };
                        messages.push(lastMsg);
                        lastMsgIndex = messages.length - 1;
                    }
                    delete pendingChunksRef.current[sessionId];
                }

                const thinkingSteps = s.thinkingSteps || [];

                // 1. LEGACY & SIMPLE FORMATS (chunk, done, reply, response)
                if (data.chunk || data.done !== undefined || data.reply || data.response !== undefined || data.TextCompleted !== undefined) {
                    const isDone = data.done === true ||
                        data.TextCompleted === true ||
                        (typeof data.response === 'string' && data.response.includes('@//done//@'));

                    const chunk = data.chunk || data.response || '';
                    const cleanChunk = typeof chunk === 'string' ? chunk.replace('@//done//@', '') : chunk;

                    if (isDone) {
                        if (lastMsg?.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: false };
                        }

                        const isNewChat = s.isNew;
                        const backendSessionId = data.threadId || data.thread_id || data.session_id;

                        // Identify if this local session needs to be promoted to a backend thread
                        if (isNewChat && backendSessionId && backendSessionId !== s.id) {
                            promotionInfo = { oldId: s.id, newId: backendSessionId };
                        }

                        if (hasSentMessageRef.current) {
                            hasSentMessageRef.current = false;
                            if (isNewChat) {
                                shouldRefreshThreads = true;
                            } else {
                                shouldMoveToTop = true;
                                moveToTopId = s.id;
                            }
                        }

                        // If promoting, update id and isNew directly in the return
                        if (promotionInfo) {
                            return { ...s, id: backendSessionId, sessionId: backendSessionId, isNew: false, isThinking: false, messages };
                        }
                        return { ...s, isThinking: false, messages };
                    } else if (cleanChunk) {
                        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + cleanChunk };
                        } else {
                            messages.push({
                                role: 'assistant',
                                content: cleanChunk,
                                isStreaming: true,
                                isNew: false,
                                timestamp: Date.now()
                            });
                        }
                        return { ...s, isThinking: false, messages };
                    } else if (data.reply) {
                        return {
                            ...s,
                            isThinking: false,
                            messages: [...messages, { role: 'assistant', content: data.reply, isNew: true, timestamp: Date.now() }]
                        };
                    }
                    return s;
                }

                // 2. ADVANCED STREAMING FORMATS (type-based status and execution steps)
                switch (data.type) {
                    case 'status':
                        {
                            const isComplete = data.status === 'completed';
                            const newStep = {
                                message: data.message,
                                status: isComplete ? 'completed' : 'in-progress',
                                type: 'status',
                                time: data.time || null
                            };
                            const newThinking = [...thinkingSteps];
                            if (isComplete && newThinking.length > 0) {
                                const lastStep = newThinking[newThinking.length - 1];
                                if (lastStep.status === 'in-progress') {
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
                                const newThinking = [...thinkingSteps, {
                                    message: `${phaseMap[data.phase]} complete`,
                                    status: 'completed',
                                    time: data.time,
                                    type: 'phase'
                                }];
                                return { ...s, isThinking: true, thinkingSteps: newThinking };
                            }
                            return s;
                        }

                    case 'tool_call':
                        return {
                            ...s,
                            isThinking: true,
                            thinkingSteps: [...thinkingSteps, {
                                message: `Calling: ${data.name}`,
                                status: data.status || 'in-progress',
                                type: 'tool_call',
                                details: data.args
                            }]
                        };

                    case 'tool_result':
                        return {
                            ...s,
                            isThinking: true,
                            thinkingSteps: [...thinkingSteps, {
                                message: 'Tool output received',
                                status: 'completed',
                                type: 'tool_result',
                                time: data.time || null,
                                details: data.content
                            }]
                        };

                    case 'phase_metric':
                        return {
                            ...s,
                            isThinking: true,
                            thinkingSteps: [...thinkingSteps, {
                                message: data.phase === 'response_ttft' ? `Time to first token: ${data.time}ms` : `Metric phase: ${data.phase}`,
                                status: 'completed',
                                type: 'phase_metric',
                                time: data.time || null
                            }]
                        };

                    case 'message_start':
                        return { ...s, isThinking: false };

                    case 'message_chunk': {
                        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + data.content };
                        } else {
                            messages.push({
                                role: 'assistant',
                                content: data.content,
                                isStreaming: true,
                                isNew: false,
                                timestamp: Date.now()
                            });
                        }
                        return { ...s, messages };
                    }

                    case 'message_end':
                    case 'done': {
                        if (lastMsg?.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: true };
                        }

                        const isNewChatAdv = s.isNew;
                        const backendIdAdv = data.threadId || data.thread_id || data.session_id;

                        if (isNewChatAdv && backendIdAdv && backendIdAdv !== s.id) {
                            promotionInfo = { oldId: s.id, newId: backendIdAdv };
                        }

                        if (hasSentMessageRef.current) {
                            hasSentMessageRef.current = false;
                            if (isNewChatAdv) {
                                shouldRefreshThreads = true;
                            } else {
                                shouldMoveToTop = true;
                                moveToTopId = s.id;
                            }
                        }

                        if (promotionInfo) {
                            return { ...s, id: backendIdAdv, sessionId: backendIdAdv, isNew: true, isThinking: false, messages };
                        }
                        return { ...s, isThinking: false, messages };
                    }

                    case 'timing':
                        return { ...s, metrics: data.data };

                    case 'error':
                        console.error('[useWebSocket] Backend reported error:', data.message);
                        messages.push({
                            role: 'assistant',
                            content: `Error: ${data.message || 'The server encountered an issue processing your request.'}`,
                            isNew: true,
                            timestamp: Date.now()
                        });
                        return { ...s, isThinking: false, messages };

                    default:
                        return s;
                }
            }));

            // EXECUTE SIDE EFFECTS OUTSIDE STATE SETTER
            if (promotionInfo) {
                promoteSession?.(promotionInfo.oldId, promotionInfo.newId);
            }

            if (shouldRefreshThreads && onThreadsChanged) {
                // Refresh sidebar with a slight delay to allow backend persistence to settle
                setTimeout(async () => {
                    await onThreadsChanged();       // page 1
                    await onThreadsChanged(true);   // page 2
                }, 800);
            } else if (shouldMoveToTop) {
                moveThreadToTop?.(moveToTopId);
            }

        } catch (err) {
            console.error('[useWebSocket] Message processing failed:', err);
        }
    }, [setActiveSessions, onThreadsChanged, promoteSession, moveThreadToTop]);

    /**
     * Effect: Subscribe to the singleton WebSocket service.
     */
    useEffect(() => {
        const unsubscribe = webSocketService.subscribe(handleMessage);
        return () => unsubscribe();
    }, [handleMessage, webSocketService]);

    /**
     * Effect: Proactively manage WebSocket session connections.
     * Ensures we only maintain active listeners for tabs currently open in the UI.
     */
    useEffect(() => {
        const currentSessionIds = activeSessionIds.split(',').filter(Boolean);
        const currentSet = new Set(currentSessionIds);

        // Connect new sessions
        currentSessionIds.forEach(sessionId => {
            if (!connectedSessionsRef.current.has(sessionId)) {
                webSocketService.connectSession(sessionId);
                connectedSessionsRef.current.add(sessionId);
            }
        });

        // Disconnect removed sessions
        connectedSessionsRef.current.forEach(sessionId => {
            if (!currentSet.has(sessionId)) {
                webSocketService.disconnectSession(sessionId);
                connectedSessionsRef.current.delete(sessionId);
            }
        });
    }, [activeSessionIds, webSocketService]);

    /**
     * Effect: Cleanup lifecycle.
     * Forcefully disconnects all listeners when the hook is unmounted.
     */
    useEffect(() => {
        const connectedSessions = connectedSessionsRef.current;
        return () => {
            connectedSessions.forEach(sessionId => {
                webSocketService.disconnectSession(sessionId);
            });
            connectedSessions.clear();
        };
    }, [webSocketService]);

    /**
     * Transmits a message through the WebSocket service.
     * 
     * @param {string} sessionId - Target session
     * @param {Object} payload - Message content and metadata
     * @returns {boolean} Success status of the transmit operation
     */
    const sendMessage = useCallback((sessionId, payload) => {
        try {
            if (!sessionId) return false;
            hasSentMessageRef.current = true;
            return webSocketService.sendMessage(sessionId, payload);
        } catch (err) {
            console.error('[useWebSocket] Send failed:', err);
            return false;
        }
    }, [webSocketService]);

    return { sendMessage };
};