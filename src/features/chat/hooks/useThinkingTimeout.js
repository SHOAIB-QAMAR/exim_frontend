import { useEffect, useRef } from 'react';

// Monitors `isThinking` state and triggers a timeout fallback. If the backend never sends a response (e.g. crash, network drop), this prevents the UI from being stuck in "Thinking..." forever.
// @param {Array} activeSessions - Current session list || @param {Function} setActiveSessions - State setter || @param {number} timeoutMs - Max wait time (default: 60s). 

export const useThinkingTimeout = (activeSessions, setActiveSessions, timeoutMs = 60000) => {
    // Just a single variable instead of a Map
    const timerRef = useRef(null);

    useEffect(() => {
        const thinkingSession = activeSessions.find(s => s.isThinking);

        // 1. If someone just started thinking, and we haven't started a timer yet
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
                timerRef.current = null; // reset lock
            }, timeoutMs);
        }

        // 2. If NO ONE is thinking, but the timer is still running, kill it
        if (!thinkingSession && timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

    }, [activeSessions, setActiveSessions, timeoutMs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);
};