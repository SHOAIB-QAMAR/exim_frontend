import { useState, useEffect, useCallback, useRef } from 'react';
import ChatService from '../../../services/chat.service';

const DATA_LIMIT = 10;

/**
 * useThreads Hook
 * 
 * Manages the thread history list, pagination, and deletion.
 * Implements a "look-ahead" loading strategy to prepopulate the sidebar.
 * 
 * @returns {Object} State and methods for thread management
 */
export const useThreads = () => {
    const [threads, setThreads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    // skipRef tracks pagination offset without triggering re-renders
    const skipRef = useRef(0);

    /**
     * Fetches a batch of threads from the server.
     * 
     * @param {boolean} [isLoadMore=false] - If true, appends results to the current list
     */
    const fetchThreads = useCallback(async (isLoadMore = false) => {
        const loadingMore = isLoadMore === true;

        if (loadingMore) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
            skipRef.current = 0;
            setHasMore(true);
        }
        setFetchError(null);

        try {
            const currentSkip = skipRef.current;
            const response = await ChatService.getAllThreads(currentSkip, DATA_LIMIT);
            const newThreadsData = response.threads || [];
            const apiHasMore = response.hasMore || false;

            if (isLoadMore) {
                setThreads(prev => {
                    // Prevent duplicate thread entries
                    const existingIds = new Set(prev.map(t => t.sessionId));
                    const newThreads = newThreadsData.filter(t => !existingIds.has(t.sessionId));
                    return [...prev, ...newThreads];
                });
            } else {
                setThreads(newThreadsData);
            }

            setHasMore(apiHasMore);
            if (apiHasMore) {
                skipRef.current = currentSkip + DATA_LIMIT;
            }
        } catch (error) {
            console.error('[useThreads] Fetch failed:', error);
            setFetchError(loadingMore ? 'Failed to load more chat history' : 'Failed to load chat history');
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
            await fetchThreads(); // Load page 1
            // Immediately load page 2 after page 1 finishes to prepopulate sidebar
            if (skipRef.current > 0) {
                await fetchThreads(true);
            }
        };

        loadInitialPages();
    }, [fetchThreads]);

    /**
     * Trigger for manual scroll-based pagination.
     */
    const loadMore = useCallback(() => {
        if (!isFetchingMore && hasMore) {
            fetchThreads(true);
        }
    }, [fetchThreads, isFetchingMore, hasMore]);

    /**
     * Deletes a thread locally and on the server.
     * 
     * @param {string} sessionId - ID of the thread to remove
     * @returns {Promise<boolean>} Success status
     */
    const deleteThread = useCallback(async (sessionId) => {
        try {
            if (!sessionId) return false;

            const threadToDel = threads.find(t => t.sessionId === sessionId);
            const objectId = threadToDel?.objectId || threadToDel?._id || sessionId;

            await ChatService.deleteThread(objectId);
            setThreads(prev => prev.filter(t => t.sessionId !== sessionId));
            return true;
        } catch (error) {
            console.error('[useThreads] Delete failed:', error);
            return false;
        }
    }, [threads]);

    /**
     * Optimistically moves a thread to the top of the list.
     * Often used when a message is sent in an existing thread.
     */
    const moveThreadToTop = useCallback((sessionId) => {
        setThreads(prev => {
            const idx = prev.findIndex(t => t.sessionId === sessionId);
            if (idx <= 0) return prev;
            const thread = prev[idx];
            return [thread, ...prev.filter((_, i) => i !== idx)];
        });
    }, []);

    return {
        threads,
        setThreads,
        fetchThreads,
        deleteThread,
        moveThreadToTop,
        isLoading,
        fetchError,
        loadMore,
        hasMore,
        isFetchingMore
    };
};