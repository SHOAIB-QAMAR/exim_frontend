import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketService } from '../context/WebSocketContext';

export const useWebSocket = (activeSessions, setActiveSessions, activeSessionId, onThreadsChanged, promoteSession, moveThreadToTop) => {
    const webSocketService = useWebSocketService();
    const connectedThreadsRef = useRef(new Set());
    const hasSentMessageRef = useRef(false); // Only refresh thread list after user sends a new message
    const pendingChunksRef = useRef({}); // Buffer for debouncing text streams
    const streamTimerRef = useRef(null);
    const activeThreadIds = activeSessions.map(s => s.id).join(',');

    // Handles incoming WebSocket messages (streaming chunks or complete messages)

    const handleMessage = useCallback((threadId, data) => {

        try {
            if (!threadId) {
                return;
            }

            // Collect promotion info OUTSIDE the updater to avoid nested setState
            let promotionInfo = null;
            let shouldRefreshThreads = false;
            let shouldMoveToTop = false;
            let moveToTopId = null;

            // --- PENDING CHUNK INTERCEPT FOR UI DEBOUNCING ---
            const legacyDoneCondition = data.done === true || data.TextCompleted === true || (typeof data.response === 'string' && data.response.includes('@//done//@'));
            const isPureLegacyChunk = (data.chunk || data.response) && !legacyDoneCondition && !data.reply;
            const isPureAdvancedChunk = data.type === 'message_chunk';

            if (isPureLegacyChunk || isPureAdvancedChunk) {
                const legacyChunkText = data.chunk || data.response || '';
                const cleanLegacyChunk = typeof legacyChunkText === 'string' ? legacyChunkText.replace('@//done//@', '') : legacyChunkText;
                
                const chunkToAppend = isPureAdvancedChunk ? data.content : cleanLegacyChunk;

                if (chunkToAppend) {
                    pendingChunksRef.current[threadId] = (pendingChunksRef.current[threadId] || '') + chunkToAppend;

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
                return; // Defers render entirely until timer fires
            }
            // ------------------------------------------------

            setActiveSessions(prev => prev.map(s => {
                if (s.id !== threadId) return s;

                const messages = [...s.messages];
                let lastMsgIndex = messages.length - 1;
                let lastMsg = messages[lastMsgIndex];

                // Drain any pending chunks synchronously first
                if (pendingChunksRef.current[threadId]) {
                    const pending = pendingChunksRef.current[threadId];
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
                    delete pendingChunksRef.current[threadId];
                }

                // Initialize thinking/metrics if not present
                const thinkingSteps = s.thinkingSteps || [];

                // Handle legacy and backend specific formats (response, chunk, done, reply)
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

                        // Collect promotion info — don't call promoteSession here
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

                // Handle Advanced Streaming Format (type: 'status' | 'message_chunk' | etc.)
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

                    case 'phase_metric':
                        {
                            const newStep = {
                                message: data.phase === 'response_ttft' ? `Time to first token: ${data.time}ms` : `Metric phase: ${data.phase}`,
                                status: 'completed',
                                type: 'phase_metric',
                                time: data.time || null
                            };
                            const newThinking = [...thinkingSteps, newStep];
                            return { ...s, isThinking: true, thinkingSteps: newThinking };
                        }


                    case 'message_start':
                        return { ...s, isThinking: false };

                    case 'message_chunk': {
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
                    case 'done': {
                        if (lastMsg?.isStreaming) {
                            messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: true };
                        }

                        const isNewChatAdvanced = s.isNew;
                        const backendIdAdvanced = data.threadId || data.thread_id || data.session_id;

                        // Collect promotion info — don't call promoteSession here
                        if (isNewChatAdvanced && backendIdAdvanced && backendIdAdvanced !== s.id) {
                            promotionInfo = { oldId: s.id, newId: backendIdAdvanced };
                        }

                        if (hasSentMessageRef.current) {
                            hasSentMessageRef.current = false;
                            if (isNewChatAdvanced) {
                                shouldRefreshThreads = true;
                            } else {
                                shouldMoveToTop = true;
                                moveToTopId = s.id;
                            }
                        }

                        // If promoting, update id and isNew directly
                        if (promotionInfo) {
                            return { ...s, id: backendIdAdvanced, sessionId: backendIdAdvanced, isNew: true, isThinking: false, messages };
                        }
                        return { ...s, isThinking: false, messages };
                    }

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

            // Call promoteSession OUTSIDE the updater — only needs to update activeSessionId
            if (promotionInfo) {

                promoteSession?.(promotionInfo.oldId, promotionInfo.newId);
            }

            // Sidebar updates
            if (shouldRefreshThreads && onThreadsChanged) {
                // New chat: refresh sidebar (load 2 pages, same as initial load)
                setTimeout(async () => {
                    await onThreadsChanged();       // page 1
                    await onThreadsChanged(true);   // page 2
                }, 800);
            } else if (shouldMoveToTop) {
                moveThreadToTop?.(moveToTopId);
            }

        } catch {
            // Message handling failed
        }
    }, [setActiveSessions, onThreadsChanged, promoteSession, moveThreadToTop]);

    // Subscribe to WebSocket service
    useEffect(() => {
        const unsubscribe = webSocketService.subscribe(handleMessage);
        return () => unsubscribe();
    }, [handleMessage, webSocketService]);

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
    }, [activeThreadIds, webSocketService]);

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
    }, [webSocketService]);


    const sendMessage = useCallback((threadId, text) => {
        try {
            if (!threadId) return false;
            hasSentMessageRef.current = true; // Mark that user initiated a message
            return webSocketService.sendMessage(threadId, text);
        } catch {

            return false;
        }
    }, [webSocketService]);

    return { sendMessage };
};