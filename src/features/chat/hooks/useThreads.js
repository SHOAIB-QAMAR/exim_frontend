import { useState, useEffect, useCallback, useRef } from 'react';
import ChatService from '../../../services/chat.service';

const DATA_LIMIT = 20;

export const useThreads = () => {
    const [threads, setThreads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    // Use ref to track current skip to avoid dependency loops if not needed
    const skipRef = useRef(0);

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
                    // Filter out duplicates just in case
                    const existingIds = new Set(prev.map(t => t.threadId));
                    const newThreads = newThreadsData.filter(t => !existingIds.has(t.threadId));
                    return [...prev, ...newThreads];
                });
            } else {
                setThreads(newThreadsData);
            }

            // Update skip and hasMore based on API response
            setHasMore(apiHasMore);
            if (apiHasMore) {
                skipRef.current = currentSkip + DATA_LIMIT;
            }
        } catch {

            setFetchError(loadingMore ? 'Failed to load more chat history' : 'Failed to load chat history');
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, []);

    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (hasLoadedRef.current) return; // Prevent StrictMode double-fire
        hasLoadedRef.current = true;

        const loadInitialPages = async () => {
            await fetchThreads(); // Load page 1
            // Immediately load page 2 after page 1 finishes
            if (skipRef.current > 0) { // Safety check to ensure page 1 loaded successfully
                await fetchThreads(true);
            }
        };

        loadInitialPages();
    }, [fetchThreads]);

    const loadMore = useCallback(() => {
        if (!isFetchingMore && hasMore) {
            fetchThreads(true);
        }
    }, [fetchThreads, isFetchingMore, hasMore]);

    const deleteThread = async (threadId) => {
        try {
            if (!threadId) return false;
            
            const threadToDel = threads.find(t => t.threadId === threadId);
            const objectId = threadToDel?.objectId || threadToDel?._id || threadId;

            await ChatService.deleteThread(objectId);
            setThreads(prev => prev.filter(t => t.threadId !== threadId));
            return true;
        } catch {

            return false;
        }
    };

    // Moves a thread to the top of the sidebar list locally (no API call)
    const moveThreadToTop = useCallback((threadId) => {
        setThreads(prev => {
            const idx = prev.findIndex(t => t.threadId === threadId);
            if (idx <= 0) return prev; // Already at top or not found
            const thread = prev[idx];
            return [thread, ...prev.filter((_, i) => i !== idx)];
        });
    }, []);

    return { threads, setThreads, fetchThreads, deleteThread, moveThreadToTop, isLoading, fetchError, loadMore, hasMore, isFetchingMore };
};