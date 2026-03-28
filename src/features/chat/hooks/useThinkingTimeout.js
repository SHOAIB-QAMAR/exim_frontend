import { useEffect, useRef } from 'react';

/**
 * useThinkingTimeout Hook
 * 
 * Monitors the `isThinking` state across active sessions and triggers a timeout fallback.
 * If the backend fails to respond within a specified duration (default: 60s), this hook
 * injects an error message to prevent the UI from being stuck in a loading state.
 * 
 * @param {Array} activeSessions - Current list of chat sessions
 * @param {Function} setActiveSessions - State setter for sessions
 * @param {number} [timeoutMs=60000] - Maximum wait time before triggering fallback
 */
export const useThinkingTimeout = (activeSessions, setActiveSessions, timeoutMs = 60000) => {
    const timerRef = useRef(null);

    useEffect(() => {
        // Find the first session currently in a 'thinking' state
        const thinkingSession = activeSessions.find(s => s.isThinking);

        // 1. If a session just started thinking, and we haven't started a timer yet
        if (thinkingSession && !timerRef.current) {
            timerRef.current = setTimeout(() => {
                setActiveSessions(prev => prev.map(s => {
                    if (s.id === thinkingSession.id && s.isThinking) {
                        return {
                            ...s,
                            isThinking: false,
                            messages: [...s.messages, {
                                role: 'assistant',
                                content: '⚠️ Response timed out. The server may be busy or unavailable. Please try again.',
                                isNew: true,
                                timestamp: Date.now(),
                                isTimeout: true
                            }]
                        };
                    }
                    return s;
                }));
                timerRef.current = null; // Reset lock after execution
            }, timeoutMs);
        }

        // 2. If NO one is thinking anymore, but the timer is still running, clear it
        if (!thinkingSession && timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

    }, [activeSessions, setActiveSessions, timeoutMs]);

    /**
     * Component Lifecycle: Cleanup on unmount
     * Ensures any pending timeouts are canceled to avoid state updates on unmounted components.
     */
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);
};