import { useState, useEffect, useCallback } from 'react';
import ChatService from '../services/chat.service';

export const useThreads = () => {
    const [threads, setThreads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchThreads = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await ChatService.getAllThreads();
            setThreads(data);
        } catch (err) {
            console.error('[useThreads.fetchThreads] Error:', err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    const deleteThread = async (threadId) => {
        try {
            if (!threadId) return false;
            await ChatService.deleteThread(threadId);
            setThreads(prev => prev.filter(t => t.threadId !== threadId));
            return true;
        } catch (err) {
            console.error('[useThreads.deleteThread] Error:', err.message);
            return false;
        }
    };

    return { threads, setThreads, fetchThreads, deleteThread, isLoading };
};