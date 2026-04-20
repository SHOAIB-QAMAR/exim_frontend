import { useState, useEffect, useCallback, useRef } from 'react';
import ChatService from '../../../services/chat.service';

const DATA_LIMIT = 15;

/**
 * useSessions Hook
 * 
 * Manages the session history list, pagination, and deletion.
 * Implements a "look-ahead" loading strategy to prepopulate the sidebar.
 * 
 * @returns {Object} State and methods for session management
 */
export const useSessions = () => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    // skipRef tracks pagination offset without triggering re-renders
    const skipRef = useRef(0);

    /**
     * Fetches a batch of sessions from the server.
     * 
     * @param {boolean} [isLoadMore=false] - If true, appends results to the current list
     */
    const fetchSessions = useCallback(async (isLoadMore = false) => {
        const loadingMore = isLoadMore === true;

        if (loadingMore) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
            skipRef.current = 0;
            setHasMore(true);
        }

        try {
            const currentSkip = skipRef.current;
            const response = await ChatService.getAllSessions(currentSkip, DATA_LIMIT);
            const newSessionsData = response.sessions || [];
            const apiHasMore = response.hasMore || false;


            if (isLoadMore) {
                setSessions(prev => {
                    // Prevent duplicate session entries
                    const existingIds = new Set(prev.map(s => s.sessionId));
                    const newSessions = newSessionsData.filter(s => !existingIds.has(s.sessionId));
                    return [...prev, ...newSessions];
                });
            } else {
                setSessions(newSessionsData);
            }


            setHasMore(apiHasMore);
            if (apiHasMore) {
                skipRef.current = currentSkip + DATA_LIMIT;
            }

            return newSessionsData;
        } catch (error) {
            console.error('[useSessions] Fetch failed:', error);
            return null;
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, []);


    // Tracks initial mountain state for StrictMode compatibility
    const hasLoadedRef = useRef(false);

    /**
     * Initial Load: Fetches the first two pages of history to provide a better UX.
     */
    useEffect(() => {
        if (hasLoadedRef.current) return; // Prevent StrictMode double-fire
        hasLoadedRef.current = true;

        const loadInitialPages = async () => {
            await fetchSessions(); // Load page 1
        };

        loadInitialPages();
    }, [fetchSessions]);

    /**
     * Trigger for manual scroll-based pagination.
     */
    const loadMore = useCallback(() => {
        if (!isFetchingMore && hasMore) {
            fetchSessions(true);
        }
    }, [fetchSessions, isFetchingMore, hasMore]);

    /**
     * Deletes a session locally and on the server.
     * 
     * @param {string} sessionId - ID of the session to remove
     * @returns {Promise<boolean>} Success status
     */
    const deleteSession = useCallback(async (sessionId) => {
        try {
            if (!sessionId) return false;

            await ChatService.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
            return true;
        } catch (error) {
            console.error('[useSessions] Delete failed:', error);
            return false;
        }
    }, [sessions]);

    /**
     * Optimistically moves a session to the top of the list.
     * Often used when a message is sent in an existing session.
     */
    const moveSessionToTop = useCallback((sessionId) => {
        setSessions(prev => {
            const idx = prev.findIndex(s => s.sessionId === sessionId);
            if (idx <= 0) return prev;
            const session = prev[idx];
            return [session, ...prev.filter((_, i) => i !== idx)];
        });
    }, []);

    return {
        sessions,
        setSessions,
        fetchSessions,
        deleteSession,
        moveSessionToTop,
        isLoading,
        loadMore,
        hasMore,
        isFetchingMore
    };
};
