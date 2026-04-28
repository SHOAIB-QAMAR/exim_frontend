import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketService } from '../context/WebSocketContext';

/**
 * useWebSocket Hook
 * 
 * The real-time communication between the UI and the backend.
 * Handles:
 * 1. Subscription to the shared WebSocket service.
 * 2. Processing incoming streaming chunks.
 * 3. Managing thinking steps, tool calls, and metrics display.
 * 4. Automatic connection/disconnection of sessions based on active tabs.
 * 5. Session management and sidebar synchronization.
 * 
 * ─── CHUNK LOSS BUGS IDENTIFIED & FIXED ───
 * 
 * BUG #1: React Strict Mode Double-Render Data Loss
 *   Problem:  React 18 Strict Mode runs state updater functions (setActiveSessions) TWICE during development. The old code was mutating refs (pendingChunkRef, hasSentMessageRef) INSIDE the state updater. On the 1st run, it read and deleted the buffered text. On the 2nd run (which React actually commits), the buffer was already empty, so the last chunks were permanently lost from the UI.
 *   Solution: All ref reads and mutations now happen BEFORE setActiveSessions is called. The extracted values are captured into local variables (flushText, wasSent) which are immutable closures — safe for React to run the updater any number of times.
 *
 * BUG #2: Post-Completion Timer Race Condition
 *   Problem:  When '@//done//@' arrived, the debounce timer (60ms) was not being cancelled. It would fire AFTER the stream was finalized, performing a stale state update that could overwrite the completed message or inject duplicate text.
 *   Solution: On receiving any completion signal, we immediately call clearTimeout() on the active timer and set it to null. Additionally, the timer callback itself contains a guard that checks if the message is already finalized (isStreaming: false) and aborts.
 *
 * BUG #3: Unflushed Buffer on Stream End
 *   Problem:  If the backend sent rapid chunks followed immediately by '@//done//@', text could be sitting in pendingChunkRef waiting for the 60ms timer. The completion handler would finalize the message WITHOUT that buffered text, causing the last few words/sentences to vanish from the UI.
 *   Solution: Before processing ANY non-chunk event (done, status, etc.), we synchronously extract whatever is in pendingChunkRef into a local 'flushText' variable and inject it into the message FIRST, before marking the stream as complete.
 *
 * @param {Array} activeSessions - List of open chat sessions
 * @param {Function} setActiveSessions - State setter for sessions
 * @param {string} activeSessionId - Current active session ID
 * @param {Function} onSessionsChanged - Callback to refresh session history
 * @param {Function} moveSessionToTop - Callback to reorder the session history in the sidebar
 * 
 * @returns {Object} { sendMessage }
 */
export const useWebSocket = (
    activeSessions,
    setActiveSessions,
    activeSessionId,
    onSessionsChanged,
    moveSessionToTop
) => {
    const webSocketService = useWebSocketService();

    // Tracks which sessions are currently connected to avoid redundant operations
    const connectedSessionsRef = useRef(new Set());

    // State to determine if we should trigger sidebar refreshes after a stream ends
    const hasSentMessageRef = useRef(false);

    // Buffering system for text chunks to reduce React render frequency (single session at a time)
    const pendingChunkRef = useRef('');
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

            let shouldRefreshSessions = false;
            let shouldMoveSessionToTop = false;
            let moveSessionToTopId = null;

            const isDoneMarker = typeof data.response === 'string' && data.response.includes('@//done//@');
            const isPureChunk = data.response && !isDoneMarker;

            if (isPureChunk) {
                const chunkToAppend = data.response;
                if (chunkToAppend) {
                    pendingChunkRef.current += chunkToAppend;

                    if (!streamTimerRef.current) {
                        streamTimerRef.current = setTimeout(() => {
                            const pending = pendingChunkRef.current;
                            pendingChunkRef.current = '';
                            streamTimerRef.current = null;

                            setActiveSessions(prev => prev.map(session => {
                                if (session.id !== sessionId) return session;
                                if (!pending) return session;

                                const msgs = [...session.messages];
                                const lastIdx = msgs.length - 1;
                                let lMsg = msgs[lastIdx];

                                // BUG #2 FIX — STALE TIMER GUARD
                                // If this timer fires AFTER '@//done//@' already finalized the message
                                // (e.g., timer was scheduled on the same millisecond as clearTimeout),
                                // the message will have isStreaming: false. Injecting text here would
                                // corrupt the completed message. So we silently discard the stale data.
                                if (lMsg?.role === 'assistant' && !lMsg.isStreaming) {
                                    return session;
                                }

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
                                return { ...session, isNew: false, messages: msgs };
                            }));
                        }, 60);
                    }
                }
                return; // Suppress immediate render as chunk is buffered
            }
            // ------------------------------------

            // ─── BUG #1 FIX — EXTRACT REFS BEFORE STATE UPDATER ───
            // All mutable ref reads/writes happen HERE, outside setActiveSessions.
            // This ensures React Strict Mode's double-invocation of the updater
            // doesn't cause data loss (both runs will use the same captured values).
            const isDoneSignal = isDoneMarker;
            let wasSent = false;

            if (isDoneSignal && hasSentMessageRef.current) {
                wasSent = true;
                hasSentMessageRef.current = false;
            }

            // ─── BUG #2 FIX — CANCEL TIMER ON COMPLETION ───
            // Without this, the 60ms debounce timer would fire AFTER the stream
            // is already finalized, causing a stale state update that could
            // overwrite the completed message or inject duplicate/orphan text.
            if (isDoneSignal) {
                if (streamTimerRef.current) {
                    clearTimeout(streamTimerRef.current);
                    streamTimerRef.current = null;
                }
            }

            // ─── BUG #3 FIX — SYNCHRONOUS BUFFER FLUSH ───
            // If chunks were buffered in pendingChunkRef waiting for the 60ms timer,
            // and '@//done//@' arrives before the timer fires, those chunks would be
            // permanently lost. We extract them HERE into a local variable so they
            // can be injected into the message inside setActiveSessions below.
            const flushText = pendingChunkRef.current || null;
            if (flushText) {
                pendingChunkRef.current = '';
                if (streamTimerRef.current) {
                    clearTimeout(streamTimerRef.current);
                    streamTimerRef.current = null;
                }
            }

            setActiveSessions(prev => {
                return prev.map(s => {
                    if (s.id !== sessionId) return s;

                    const messages = [...s.messages];
                    let lastMsgIndex = messages.length - 1;
                    let lastMsg = messages[lastMsgIndex];

                    // ─── BUG #3 FIX (continued) — INJECT FLUSHED TEXT ───
                    // Before processing the done/status event, append any text that was
                    // sitting in the buffer. Without this, those last words would vanish
                    // from the UI (though they exist in the DB, which is why reopening
                    // the chat from sidebar history showed the complete message).
                    if (flushText) {
                        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                            lastMsg = { ...lastMsg, content: lastMsg.content + flushText };
                            messages[lastMsgIndex] = lastMsg;
                        } else {
                            lastMsg = {
                                role: 'assistant',
                                content: flushText,
                                isStreaming: true,
                                isNew: false,
                                timestamp: Date.now()
                            };
                            messages.push(lastMsg);
                            lastMsgIndex = messages.length - 1;
                        }
                    }

                    // 1. RESPONSE FORMAT: { response: "text" } or { response: "@//done//@ " }
                    if (data.response !== undefined) {
                        if (isDoneMarker) {
                            // Stream complete — finalize the assistant message
                            if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                                messages[lastMsgIndex] = { ...lastMsg, isStreaming: false, isNew: false };
                            }

                            if (wasSent) {
                                if (s.isNew) {
                                    shouldRefreshSessions = true;
                                } else {
                                    shouldMoveSessionToTop = true;
                                    moveSessionToTopId = s.id;
                                }
                            }

                            return { ...s, isNew: false, isThinking: false, messages };
                        }
                        // Non-done response chunks that escaped the debouncer (shouldn't normally happen)
                        // are handled as a safety fallback
                        if (data.response) {
                            if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                                messages[lastMsgIndex] = { ...lastMsg, content: lastMsg.content + data.response };
                            } else {
                                messages.push({
                                    role: 'assistant',
                                    content: data.response,
                                    isStreaming: true,
                                    isNew: false,
                                    timestamp: Date.now()
                                });
                            }
                            return { ...s, isThinking: false, messages };
                        }
                        return s;
                    }

                    // Safety fallback for unexpected formats
                    return s;
                });
            });

            // EXECUTE SIDE EFFECTS OUTSIDE STATE SETTER
            if (shouldRefreshSessions && onSessionsChanged) {
                // Refresh sidebar with a slight delay to allow backend persistence to settle
                setTimeout(async () => {
                    await onSessionsChanged();       // page 1
                }, 800);
            } else if (shouldMoveSessionToTop) {
                moveSessionToTop?.(moveSessionToTopId);
            }

        } catch (err) {
            console.error('[useWebSocket] Message processing failed:', err);
        }
    }, [setActiveSessions, onSessionsChanged, moveSessionToTop]);

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
            if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
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